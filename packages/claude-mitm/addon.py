"""claude-mitm — a mitmproxy addon that reports Claude message counts (per
model) to this workload's own ai-cloud-operator, the same metric
claude-tracker's browser extension already reported.

Why this exists alongside (and now instead of, for message-send detection)
claude-tracker's own chrome.webRequest-based detection: Chrome's webRequest
API does not let one extension observe network requests initiated from
ANOTHER extension's own privileged context (background service worker, side
panel, popup) — only requests happening in a real tab/page are visible
cross-extension. Anthropic's own "Claude for Chrome" sidebar extension sends
messages via api.anthropic.com/v1/messages entirely from its own side
panel's JS context, so claude-tracker could never see it no matter what URL
pattern it registered — confirmed empirically with a diagnostic webRequest
listener that saw zero requests to api.anthropic.com while a
chrome://net-export capture of the same session showed the sidebar's
traffic clearly happening. A TLS-intercepting proxy sits below the
extension permission model entirely, so it sees both claude.ai's own webapp
traffic AND the sidebar's, uniformly — see this package's own README for
the full investigation.

--allow-hosts (set by whoever launches mitmdump with this addon, see
ai-cloud-operator's internal/catalog/tracker.go) should be scoped to
anthropic.com/claude.ai/claudeusercontent.com specifically — this addon does
not enforce that itself, it trusts the launch configuration to keep every
other host in the browser passing through undecrypted.

Deliberately extracts only the fields it needs (model, stop_reason, usage
percentages) and never logs, stores, or forwards conversation content —
system prompts, message text, tool inputs/outputs, or response text. Despite
having technical access to full plaintext (that's the whole point of the
proxy), this addon's privacy posture is meant to match claude-tracker's own:
counts and percentages only, never content.

Usage-limit percentages are reported passively here — off whatever /usage
responses the browser happens to make on its own (response(), cheap and
immediate when it happens) — but NOT actively polled from this process.
That was tried (an earlier version of this file ran its own background
heartbeat thread hitting /usage directly via urllib) and reverted: claude.ai
sits behind Cloudflare bot detection, and a script-originated request from
this sidecar's own process — not a real browser tab, different network
origin, different TLS fingerprint — got flagged even after replaying a
captured session cookie AND a real User-Agent/Referer (confirmed live,
2026-08-04: HTTP 403). A genuine `fetch()` from inside the browser itself
sails through for free, with the right origin/fingerprint/headers by
construction, and doesn't have to fight an arms race we don't control
either side of. So the guaranteed-cadence usage heartbeat lives back in
claude-tracker's own chrome.alarms — see that package's background.ts —
since it's a general, account-level, non-sidebar-specific metric, there's
no coverage gap left by keeping it there: claude-tracker's extension is
force-installed unconditionally whenever claude-mitm is (see tracker.go),
so it's always present to do this half of the job.
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

# Matches claude-tracker's own MESSAGE_SEND_URL_PATTERNS (background.ts) —
# kept in sync by hand, not shared code, since one's a TS webRequest filter
# and the other's a Python path check.
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

# module-scope cumulative counters, mirroring @ai-cloud-tracker/shared's
# incrementMessageCount — this process lives for the pod's whole lifetime
# (no MV3-style suspend/resume to worry about), so a plain in-memory dict
# is enough; nothing here needs to survive a restart any more than the
# extension's own chrome.storage.local counters did.
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
    """Scans a /v1/messages SSE response for how the stream actually ended.

    Returns "end_turn" only for a real, successfully-completed reply.
    Returns None for anything else — an internal tool_use round-trip (e.g.
    the turn_answer_start step every sidebar turn seems to start with), a
    server-side error event (e.g. overloaded_error, which the client
    silently retries), or a response we can't parse. This is a heuristic
    derived from one real captured session (see README), not something
    Anthropic documents as a stable contract — expect to revisit if Claude
    for Chrome's internal orchestration protocol changes shape.
    """
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
        # One POST here is one send, full stop — same semantics
        # background.ts's own handleMessageSent already relied on, so this
        # fires on the request itself rather than waiting for a response.
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
