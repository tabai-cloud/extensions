"""claude-mitm — a mitmproxy addon that reports Claude message counts (per
model) to this workload's own ai-cloud-operator, the same metric
claude-tracker's browser extension already reported.

WHY: docs/notes/webrequest-cross-extension-blindspot.md#webrequest-cross-extension-blindspot — exists alongside (and now instead of, for message-send detection) claude-tracker's own chrome.webRequest-based detection, which cannot see the "Claude for Chrome" sidebar's own cross-extension traffic.

WHY: docs/notes/mitm-allow-hosts-trust.md#mitm-allow-hosts-trust — --allow-hosts scoping is trusted to the launch configuration, not enforced by this addon itself.

WHY: docs/notes/mitm-privacy-posture.md#mitm-privacy-posture — deliberately extracts only model/stop_reason/usage percentages, never conversation content, despite having full plaintext access.

WHY: docs/notes/cloudflare-blocks-sidecar-polling.md#cloudflare-blocks-sidecar-polling — usage percentages are reported passively off whatever /usage responses the browser makes on its own; active polling from this process was tried and reverted (Cloudflare 403).
"""

import json
import os
import threading
import time
import urllib.error
import urllib.request

from mitmproxy import http

OPERATOR_API_BASE_URL = os.environ.get("EXTENSION_API_BASE_URL", "")
WORKLOAD_NAME = os.environ.get("EXTENSION_WORKLOAD_NAME", "")
LOCAL_SECRET = os.environ.get("EXTENSION_LOCAL_SECRET", "")

# WHY: docs/notes/claude-message-send-url-sync.md#claude-message-send-url-sync — kept in sync by hand with claude-tracker's own URL matching, not shared code.
WEBAPP_COMPLETION_SUFFIXES = ("/completion", "/retry_completion")
MESSAGES_API_PATH = "/v1/messages"
USAGE_PATH_SUFFIX = "/usage"

MODEL_FAMILIES = ("opus", "sonnet", "haiku", "fable")
SCOPED_MODEL_KEY = {"sonnet": "weeklySonnet", "opus": "weeklyOpus", "fable": "weeklyFable"}
USAGE_METRIC_KEY = {
    "session": "claude.usage.session",
    "weekly": "claude.usage.weekly",
    "weeklySonnet": "claude.usage.weekly_sonnet",
    "weeklyOpus": "claude.usage.weekly_opus",
    "weeklyFable": "claude.usage.weekly_fable",
}

# WHY: docs/notes/mitm-counter-lifecycle.md#mitm-counter-lifecycle — a plain in-memory dict is enough since this process lives for the pod's whole lifetime, no MV3-style suspend/resume to worry about.
_message_counts_lock = threading.Lock()
_message_counts = {}

# flow.id -> requested model, recorded in request() and consumed in
# response() once we know how the /v1/messages stream actually ended.
_pending_sidebar_sends = {}


def _report_samples(samples):
    if not samples or not (OPERATOR_API_BASE_URL and WORKLOAD_NAME and LOCAL_SECRET):
        return
    body = json.dumps({"samples": samples}).encode("utf-8")
    req = urllib.request.Request(
        f"{OPERATOR_API_BASE_URL}/workloads/{WORKLOAD_NAME}/extension/report",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {LOCAL_SECRET}"},
    )
    try:
        urllib.request.urlopen(req, timeout=5).close()
    except urllib.error.URLError:
        pass  # best-effort — same swallow-and-move-on semantics as reportSamples in report.ts


def _model_slug(model_version):
    slug = (model_version or "").lower()
    for family in MODEL_FAMILIES:
        if family in slug:
            return family
    return "unknown"


def _record_message(model_version):
    slug = _model_slug(model_version)
    with _message_counts_lock:
        _message_counts[slug] = _message_counts.get(slug, 0) + 1
        count = _message_counts[slug]
    _report_samples([{"metric": f"claude.messages.{slug}", "value": count, "sampledAt": _now_ms()}])


def _now_ms():
    return int(time.time() * 1000)


def _parse_and_report_usage(raw_body):
    try:
        raw = json.loads(raw_body)
    except (ValueError, TypeError):
        return

    values = {"session": None, "weekly": None, "weeklySonnet": None, "weeklyOpus": None, "weeklyFable": None}

    limits = raw.get("limits")
    if isinstance(limits, list) and limits:
        for entry in limits:
            percent = entry.get("percent")
            if not isinstance(percent, (int, float)):
                continue
            kind = entry.get("kind")
            if kind == "session":
                values["session"] = percent
            elif kind == "weekly_all":
                values["weekly"] = percent
            elif kind == "weekly_scoped":
                model = ((entry.get("scope") or {}).get("model") or {}).get("display_name")
                key = SCOPED_MODEL_KEY.get((model or "").lower())
                if key:
                    values[key] = percent
    else:
        # older response shape — mirrors claude-api.ts#parseUsage's own fallback
        values["session"] = (raw.get("five_hour") or {}).get("utilization")
        values["weekly"] = (raw.get("seven_day") or {}).get("utilization")
        values["weeklySonnet"] = (raw.get("seven_day_sonnet") or {}).get("utilization")
        values["weeklyOpus"] = (raw.get("seven_day_opus") or {}).get("utilization")

    now = _now_ms()
    samples = [
        {"metric": USAGE_METRIC_KEY[key], "value": value, "sampledAt": now}
        for key, value in values.items()
        if isinstance(value, (int, float))
    ]
    _report_samples(samples)


def _terminal_stop_reason(response):
    # WHY: docs/notes/sidebar-stop-reason-heuristic.md#sidebar-stop-reason-heuristic — scans an SSE response for
    # how the stream actually ended; a heuristic derived from one captured session, not a documented contract.
    if response is None:
        return None
    try:
        text = response.get_text()
    except Exception:
        return None

    stop_reason = None
    for line in text.splitlines():
        if not line.startswith("data:"):
            continue
        try:
            data = json.loads(line[len("data:"):].strip())
        except (ValueError, TypeError):
            continue
        if data.get("type") == "error":
            return None
        delta = data.get("delta")
        if isinstance(delta, dict) and "stop_reason" in delta:
            stop_reason = delta["stop_reason"]
    return stop_reason


def request(flow: http.HTTPFlow) -> None:
    if flow.request.method != "POST":
        return
    host = flow.request.host
    url = flow.request.pretty_url

    if host == "claude.ai" and url.endswith(WEBAPP_COMPLETION_SUFFIXES):
        # One POST here is one send, full stop — same semantics background.ts's
        # handleMessageSent relies on; fires on the request, not the response.
        try:
            body = json.loads(flow.request.content)
        except (ValueError, TypeError):
            body = {}
        _record_message(body.get("model"))
        return

    if host == "api.anthropic.com" and flow.request.path.startswith(MESSAGES_API_PATH):
        try:
            body = json.loads(flow.request.content)
        except (ValueError, TypeError):
            body = {}
        _pending_sidebar_sends[flow.id] = body.get("model")


def response(flow: http.HTTPFlow) -> None:
    host = flow.request.host
    url = flow.request.pretty_url

    if flow.request.method == "GET" and host == "claude.ai" and url.endswith(USAGE_PATH_SUFFIX):
        _parse_and_report_usage(flow.response.content)
        return

    model_version = _pending_sidebar_sends.pop(flow.id, None)
    if model_version is None:
        return
    if _terminal_stop_reason(flow.response) == "end_turn":
        _record_message(model_version)
