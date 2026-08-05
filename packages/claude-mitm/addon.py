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

This addon also enforces chat ownership: multiple separate per-user
workloads can share one underlying claude.ai account, but Anthropic's own
API has no concept of "workload" — only "account" — so without this,
anything one workload's user's browser can address (by guessing or simply
observing another workload's traffic land on the same account) it can
read, leaking every OTHER workload's chat history to a user who should
never see it. _owned_chat_ids (hydrated from this workload's own operator,
never Convex directly — same rule every other operator interaction in this
codebase follows) is this addon's source of truth for which conversation
ids belong to THIS workload; see _enforce_chat_ownership,
_bootstrap_owned_chat_ids, and _claude_chats_poll_loop below.
"""

import json
import os
import random
import re
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

# Matches the conversation id out of any .../chat_conversations/{id}[/...]
# path — both the webapp's POST .../completion (a send, handled in
# request()'s POST branch below) and a bare GET .../chat_conversations/{id}
# (a read, gated by _enforce_chat_ownership) share this exact URL shape.
# Deliberately requires the literal "/chat_conversations/" segment (not a
# prefix match) so it does NOT match .../chat_conversations_v2 (the account-
# wide chat list — see _enforce_chat_ownership's own comment on why that's
# untouched here) or unrelated resources like .../artifacts/{id}/versions.
CONVERSATION_ID_PATTERN = re.compile(r"/chat_conversations/([^/?]+)")

# Jittered, not fixed — same reasoning OPA's own bundle-polling min/max
# delay convention exists for: every sidecar in a fleet importing this
# module within the same second of a rollout (a Deployment restart, a mass
# node drain) would otherwise poll the operator in lockstep forever, since
# nothing here ever resyncs their phase. A random interval each tick
# spreads that out with no coordination needed. See _claude_chats_poll_loop.
CLAUDE_CHATS_POLL_MIN_SECONDS = 45
CLAUDE_CHATS_POLL_MAX_SECONDS = 75

# The operator's /workloads/{name}/integrations/ownership route (and the
# Convex table behind it) is deliberately generic across resource kinds —
# a Claude "Project" page is a concrete near-term second case — so every
# call this addon makes states its own source/type explicitly rather than
# the operator/Convex assuming "claude"/"chat" on our behalf.
INTEGRATION_SOURCE = "claude"
INTEGRATION_TYPE = "chat"

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

# This workload's own set of owned conversation ids, hydrated from the
# operator (see _bootstrap_owned_chat_ids) and kept fresh by
# _claude_chats_poll_loop. Guards both reads (_enforce_chat_ownership) and
# writes (new-conversation detection in request()'s POST branch) — same
# thread-safety shape as _message_counts_lock above: mitmproxy calls
# request()/response() from multiple worker threads, and the poll loop
# below replaces this set wholesale from its own daemon thread.
_owned_chat_ids_lock = threading.Lock()
_owned_chat_ids = set()


def _operator_url(path):
    return f"{OPERATOR_API_BASE_URL}/workloads/{WORKLOAD_NAME}{path}"


def _operator_configured():
    # Mirrors loadConfig's "not yet enrolled" case elsewhere in this
    # monorepo (packages/shared/src/config.ts) — this workload's template
    # may never have had the extension/operator wiring finished, or this
    # is a manual/dev run with no operator around at all. Every caller
    # treats "not configured" as a normal, retry-later state, never an
    # error worth raising.
    return bool(OPERATOR_API_BASE_URL and WORKLOAD_NAME and LOCAL_SECRET)


def _operator_post(path, body, timeout=5):
    """Best-effort, fire-and-forget POST to this workload's own operator —
    the shared HTTP-posting helper _report_samples used to inline itself;
    generalized here so the new chat-registration POST (see
    _detect_new_conversation) doesn't duplicate it. Swallows every failure:
    a dropped sample or an unregistered chat id both get another chance on
    the very next event (another message, another poll tick) rather than
    ever blocking or crashing the proxy over a reporting hiccup.
    """
    if not body or not _operator_configured():
        return
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        _operator_url(path),
        data=data,
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {LOCAL_SECRET}"},
    )
    try:
        urllib.request.urlopen(req, timeout=timeout).close()
    except Exception:
        # Deliberately broad, not just urllib.error.URLError: a timeout or
        # a connection reset mid-read (TimeoutError, RemoteDisconnected,
        # ssl.SSLError, ...) propagates raw from urlopen, not wrapped —
        # same swallow-and-move-on semantics as reportSamples in report.ts,
        # but this must never surface past this function either way.
        pass


def _operator_get(path, timeout=5):
    """Blocking GET to this workload's own operator. Returns the parsed
    JSON response body, or None on ANY failure (not configured yet, network
    error, non-2xx, unparseable body) — callers (_fetch_owned_chat_ids) are
    responsible for treating None as "no new information" rather than
    "empty", so a transient failure here never wipes out previously-good
    state. Exceptions are caught broadly and never raised, same reasoning
    as _operator_post — this is called once at module import time (see
    _bootstrap_owned_chat_ids), where letting anything escape would kill
    mitmdump's own startup before it ever proxies a single request.
    """
    if not _operator_configured():
        return None
    req = urllib.request.Request(
        _operator_url(path),
        headers={"Authorization": f"Bearer {LOCAL_SECRET}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except Exception as exc:
        print(f"[claude-mitm] GET {path} failed: {exc!r}")
        return None


def _report_samples(samples):
    if not samples:
        return
    _operator_post("/extension/report", {"samples": samples})


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


def _fetch_owned_chat_ids():
    """Blocking GET .../integrations/ownership?source=claude&type=chat.
    Returns a fresh set on success, or None on any failure (not configured,
    network error, malformed body) — used by both the module-load bootstrap
    and every poll tick, both of which need to tell "the operator says this
    workload owns nothing" (a real, empty set — replace) apart from "we
    don't know right now" (None — keep whatever we already had). Conflating
    the two would mean a single dropped request revokes every chat this
    workload's user can see.
    """
    result = _operator_get(f"/integrations/ownership?source={INTEGRATION_SOURCE}&type={INTEGRATION_TYPE}")
    if result is None:
        return None
    resource_ids = result.get("resourceIds")
    if not isinstance(resource_ids, list):
        return None
    return set(resource_ids)


def _bootstrap_owned_chat_ids():
    """Runs once at module import (see the bottom of this file), before the
    poll thread starts, so _owned_chat_ids is never accessed by a live
    request()/response() call while still at its initial empty default —
    every chat would 403 until the first poll tick otherwise. Blocking is
    fine here: mitmdump imports this module once, synchronously, before it
    starts serving any flow, same as any other one-time setup cost.

    Not (yet) enrolled, or the fetch fails outright: log and fall through
    with an empty set (the module-level default) rather than block forever
    — same best-effort posture as _report_samples elsewhere in this file.
    Wrapped in its own try/except: nothing raised here may propagate past
    module import, or mitmdump itself never starts and every OTHER metric
    this addon reports (message counts, usage) silently dies with it.
    """
    global _owned_chat_ids
    try:
        if not _operator_configured():
            print("[claude-mitm] operator not configured yet (not enrolled) — starting with an empty owned-chat set")
            return
        fetched = _fetch_owned_chat_ids()
        if fetched is None:
            print("[claude-mitm] failed to bootstrap owned chat ids from operator — starting with an empty set")
            return
        with _owned_chat_ids_lock:
            _owned_chat_ids = fetched
        print(f"[claude-mitm] bootstrapped {len(fetched)} owned chat id(s) from operator")
    except Exception as exc:
        # Whatever _owned_chat_ids already was (the empty module-level
        # default, in the real one-shot-at-import call this function is
        # meant for) is left untouched here, same "never wipe out
        # previously-good state on a transient failure" rule
        # _claude_chats_poll_loop's own docstring spells out.
        print(f"[claude-mitm] unexpected error bootstrapping owned chat ids: {exc!r} — leaving owned-chat set unchanged")


def _claude_chats_poll_loop():
    """Background daemon thread, re-fetching the owned-chat set roughly
    every minute (jittered — see CLAUDE_CHATS_POLL_MIN/MAX_SECONDS above)
    for as long as this process lives. Mirrors the now-reverted
    _heartbeat_loop's daemon-thread-startup shape (see git history on this
    file, commit 1719030) — started once at module scope, daemon=True so it
    never blocks mitmdump's own shutdown.

    A successful fetch REPLACES _owned_chat_ids wholesale, not merges: a
    chat this workload's ownership was revoked for upstream (or that
    another workload registered, if that were ever possible) must
    disappear locally too, not linger because it was once seen. A FAILED
    fetch (None — see _fetch_owned_chat_ids) intentionally does nothing,
    leaving the previous set untouched — a single dropped request must
    never lock this workload's user out of their own chat history.

    The ENTIRE tick body below runs inside one try/except, not just the
    fetch — same shape as the reverted _heartbeat_loop's own guard. An
    exception anywhere in here (the fetch, the lock, the assignment) must
    never escape the while loop: an uncaught one would silently kill this
    daemon thread for the rest of the process's life, freezing
    _owned_chat_ids at whatever it last held with no recovery and nothing
    logged to explain why refreshes stopped.
    """
    global _owned_chat_ids
    while True:
        time.sleep(random.uniform(CLAUDE_CHATS_POLL_MIN_SECONDS, CLAUDE_CHATS_POLL_MAX_SECONDS))
        try:
            fetched = _fetch_owned_chat_ids()
            if fetched is None:
                continue
            with _owned_chat_ids_lock:
                _owned_chat_ids = fetched
        except Exception:
            pass  # never let a poll-tick error kill the whole loop


def _enforce_chat_ownership(flow: http.HTTPFlow) -> None:
    """Hard-blocks a GET read of a conversation this workload doesn't own,
    by short-circuiting with a 403 before the request ever reaches
    claude.ai. Only ever called for GET requests (see request() below) —
    the POST .../completion and .../retry_completion endpoints match this
    same URL shape but are sends, not reads, and are handled separately in
    request()'s POST branch (see _detect_new_conversation).

    Deliberately narrow in scope: only .../chat_conversations/{id} itself
    is gated. .../chat_conversations_v2 (the account-wide chat list) is
    NOT filtered here — see the comment on that in request() below, it's a
    deliberately deferred follow-up, not an oversight. Nor is
    .../chat_conversations/{id}/title (a rename) or
    .../artifacts/{id}/versions (a different resource entirely, keyed by
    its own id) — both are also technically account-scoped and out of
    scope for this pass; note them here so they don't look forgotten.
    """
    match = CONVERSATION_ID_PATTERN.search(flow.request.path)
    if not match:
        return
    conv_id = match.group(1)
    with _owned_chat_ids_lock:
        owned = conv_id in _owned_chat_ids
    if owned:
        return
    flow.response = http.Response.make(
        403,
        json.dumps({"error": "chat not owned by this workload", "chatId": conv_id}).encode("utf-8"),
        {"Content-Type": "application/json"},
    )


def _detect_new_conversation(path, body):
    """A create_conversation_params key present in a webapp .../completion
    request body is only ever true on the FIRST message of a brand-new
    conversation (confirmed against a real captured session) — that's the
    moment claude.ai mints a fresh conversation id for this workload's
    user, so it's the moment this addon needs to claim it as owned.

    Adapted from the prototype at
    scratchpad/tracker-rig/addon_ownership_test.py, with the prototype's
    local-only in-memory set replaced by the real operator-backed
    _owned_chat_ids (see module docstring). Claims the id two ways: locally
    and immediately (so an ownership check on the very next request — e.g.
    the browser re-fetching the conversation it just created — doesn't
    false-negative while waiting on a round trip), and via a best-effort
    POST to the operator (so it's still owned after this process restarts
    and re-bootstraps, and so other workloads' operators never see it).

    The optimistic local add is NOT durable on its own: if the register
    POST is one of the ones this addon's best-effort posture swallows (a
    dropped connection, an operator restart mid-request), the very next
    successful _claude_chats_poll_loop tick replaces _owned_chat_ids
    wholesale from the operator's own (still-unaware) view — silently
    dropping this id again, with no retry anywhere in this file. A brand-
    new conversation could 403 its own creator a minute later. Both halves
    of that (best-effort POST, replace-not-merge poll) are deliberate,
    spec-mandated tradeoffs, not bugs — the operator is meant to be the
    durable store, this local set is only ever a cache of it.

    Sidebar (Claude for Chrome, api.anthropic.com/v1/messages) sends are
    NOT covered by this function — confirmed against a real captured
    session, those requests carry no conversation id anywhere in the URL,
    and never include a create_conversation_params field in the body
    either. Claude for Chrome apparently creates its conversation through
    some other call this addon doesn't currently see, which means a
    sidebar-originated new chat is a real, known coverage gap in ownership
    enforcement, not something this function silently ignores.
    """
    if body.get("create_conversation_params") is None:
        return
    match = CONVERSATION_ID_PATTERN.search(path)
    if not match:
        return
    conv_id = match.group(1)
    with _owned_chat_ids_lock:
        _owned_chat_ids.add(conv_id)
    _operator_post("/integrations/ownership", {"source": INTEGRATION_SOURCE, "type": INTEGRATION_TYPE, "resourceId": conv_id})


def request(flow: http.HTTPFlow) -> None:
    host = flow.request.host

    # Ownership enforcement runs on every GET, ahead of (and independent
    # of) the POST-only tracking logic below — a read of an unowned
    # conversation must be blocked regardless of whether this flow ends up
    # mattering for message counting at all. NOT applied to
    # .../chat_conversations_v2 (the account-wide chat list): we don't yet
    # know the real endpoint the webapp's chat list actually renders from
    # (live investigation so far suggests it's bundled into some bootstrap
    # payload, not a dedicated list call) — filtering the wrong endpoint,
    # or guessing at response shape for one we haven't confirmed, would be
    # worse than leaving it alone. Deliberately deferred, not forgotten.
    if flow.request.method == "GET" and host == "claude.ai":
        _enforce_chat_ownership(flow)

    if flow.request.method != "POST":
        return
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
        _detect_new_conversation(flow.request.path, body)
        return

    if host == "api.anthropic.com" and flow.request.path.startswith(MESSAGES_API_PATH):
        # New-conversation detection (_detect_new_conversation) does NOT
        # run for sidebar sends — see that function's own doc comment for
        # why (no conversation id in the URL, no create_conversation_params
        # in the body, confirmed against a real captured session). A known
        # gap, not a silent omission.
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


# Run once, at module load — mitmdump imports this file exactly once per
# process lifetime (unlike request()/response(), which mitmproxy calls
# per-flow), so this is the right place for one-time setup with no
# equivalent hook of its own in the mitmproxy addon API. Bootstrap runs
# BEFORE the poll thread starts so _owned_chat_ids is never read by a live
# request() while still at its empty module-level default.
_bootstrap_owned_chat_ids()

# daemon=True so this thread never blocks mitmdump's own process shutdown —
# same pattern the now-reverted _heartbeat_loop used (git history, commit
# 1719030b21af6619f8e1ae11f7dea627e58c7a90).
threading.Thread(target=_claude_chats_poll_loop, daemon=True).start()
