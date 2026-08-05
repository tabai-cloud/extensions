# claude-mitm

A [mitmproxy](https://mitmproxy.org/) addon + committed CA keypair, run as a
sidecar container in ai-cloud-operator's `chromium-tracker` workload pod,
that reports Claude message counts (per model) to that workload's own
operator — the same job `claude-tracker`'s browser extension used to do,
plus one thing the extension structurally cannot: message counts from
Anthropic's own official "Claude for Chrome" sidebar extension. Usage-limit
percentage reporting is split with `claude-tracker`: this addon reports it
passively when it happens to observe it, but the guaranteed-cadence
heartbeat lives in the extension — see "How it works" below for why.

## Why this exists

`claude-tracker` detects message sends via `chrome.webRequest`, matching
claude.ai's own webapp completion endpoints. That works great for the
webapp, but Chrome's `webRequest` API does not let one extension observe
network requests initiated from **another extension's own privileged
context** — a background service worker, side panel, or popup. Only
requests happening in a real tab/page are visible cross-extension.

Anthropic's own "Claude for Chrome" extension (Chrome Web Store id
`fcoeoabgfenejglbffodgkkbkcdhcgfn`) sends every message from its side
panel's own JS context, straight to the public Messages API
(`POST https://api.anthropic.com/v1/messages`) — never through claude.ai's
webapp endpoints at all. We confirmed this is a hard platform limitation,
not a URL-pattern bug: a diagnostic `chrome.webRequest` listener matching
`*://api.anthropic.com/*` with no method/body restriction observed **zero**
requests during a real sidebar send, while the exact same send showed up
immediately in a `chrome://net-export` capture and in this addon's own
mitmproxy log. Real prior art (`w3c/webextensions#369`) documents this same
boundary from the other direction — Chromium's own `declarativeNetRequest`
gained the ability to *block* another extension's background requests in MV3
specifically because `webRequest` still can't *see* them, which the spec
discussion itself calls an inconsistency.

A TLS-intercepting proxy sits below the extension permission model
entirely, so it sees both sources uniformly. This addon is now the single
source of truth for per-model message counts — `claude-tracker`'s own
`chrome.webRequest`-based detection was removed to avoid double-reporting
the same metric from two places. Usage-limit percentages ended up split
differently (see below): the extension kept its heartbeat rather than this
addon growing an equivalent active one.

## How it works

- `addon.py` hooks mitmproxy's `request`/`response` events.
- **claude.ai webapp** (`.../chat_conversations/*/completion` and
  `.../retry_completion`): one POST is one send, counted immediately on the
  request — same semantics `claude-tracker`'s own `handleMessageSent` used.
- **Claude for Chrome sidebar** (`api.anthropic.com/v1/messages`): messier.
  One user-initiated send produces *multiple* `/v1/messages` round-trips —
  confirmed empirically via a real captured session: an internal
  `turn_answer_start` tool-use step first, then the actual reply, plus
  occasional `overloaded_error` responses the client silently retries.
  Counting every POST would badly overcount. This addon only counts a
  stream whose **final SSE event reports `stop_reason: "end_turn"`** — the
  model actually finishing its turn with nothing more to do, the closest
  equivalent this API's shape has to "the user got a reply." This is a
  heuristic derived from one real capture, not a documented Anthropic
  contract — expect to revisit if the sidebar's internal protocol changes.
- **Usage percentages**: reported passively only — whenever claude.ai or the
  sidebar happens to call `GET https://claude.ai/api/organizations/{orgId}/
  usage` on their own, this addon observes and reports the response. Parsing
  mirrors `claude-tracker`'s own `lib/claude-api.ts#parseUsage` (the
  `limits` array shape, with the older `five_hour`/`seven_day`/etc.
  top-level-field shape as fallback). An earlier version of this addon also
  ran its own active heartbeat — a background thread polling `/usage`
  directly via `urllib`, using a session cookie + orgId opportunistically
  captured off observed traffic, to guarantee a reporting cadence the way
  passive observation alone can't (confirmed live, 2026-08-04: a real
  workload where 3 real messages went in and out over ~15 minutes without
  the browser ever organically calling `/usage`, so passive-only reported
  zero `claude.usage.*` samples the entire session). That was reverted,
  also confirmed live, 2026-08-04: claude.ai sits behind Cloudflare bot
  detection, and the active poll got HTTP 403'd even after replaying a
  captured session cookie AND a real User-Agent/Referer — a script-
  originated request from this sidecar's own process has a different
  network origin and TLS fingerprint than a real browser tab, and that's
  not a gap headers alone can close. The guaranteed-cadence heartbeat lives
  back in `claude-tracker`'s own `chrome.alarms` instead — see that
  package's README — since a genuine in-browser `fetch()` doesn't have
  this problem at all.
- Reports via the exact same wire contract `@ai-cloud-tracker/shared`'s
  `reportSamples` already uses — `POST {operatorApiBaseUrl}/workloads/
  {workloadName}/extension/report`, `Authorization: Bearer {localSecret}`,
  same `claude.messages.{model}` / `claude.usage.*` metric names — so
  nothing downstream (the operator's `metrics.ExtensionCache`, Convex,
  dashboards) needed to change.

## Privacy

This addon has technical access to full plaintext request/response bodies —
system prompts, message text, tool inputs/outputs, assistant replies. It
never logs, stores, or forwards any of that. Only `model`, `stop_reason`,
and usage-limit percentages are ever extracted; everything else is
discarded the moment it's read. This is a deliberate design constraint, not
an accident of what happened to be easy — keep it that way in any change to
`addon.py`.

## CA keypair

`ca/mitmproxy-ca.pem` (cert + private key, mitmdump's own combined confdir
format) and `ca/mitmproxy-ca-cert.pem` (cert only, for importing into a
browser's trust store) are committed deliberately, generated once and never
rotated in the ordinary course — same convention `claude-tracker`'s own
`signing-key.pem` already uses. **Unlike that key, this one is
security-sensitive**: it's not just pinning an identity, it's what makes
TLS interception *trusted*. Anyone holding it could MITM any workload's
Claude traffic that trusts this CA, given network position. Committing it
was a deliberate, discussed tradeoff (simplicity + consistency with existing
convention, for an internal-only interception scope) — rotate it (and
re-import into every deployed workload's NSS trust store) if it's ever
suspected of leaking beyond this repo.

## Development

No build step — this is plain Python, run directly by `mitmdump`:

```
mitmdump -s addon.py --set confdir=./ca --allow-hosts 'anthropic\.com|claude\.ai|claudeusercontent\.com' --listen-port 8080
```

`EXTENSION_API_BASE_URL` / `EXTENSION_WORKLOAD_NAME` / `EXTENSION_LOCAL_SECRET`
env vars configure reporting — same three values ai-cloud-operator already
injects into `claude-tracker`'s `chrome.storage.managed`, delivered here as
plain env vars instead since this isn't a browser extension. See
ai-cloud-operator's `internal/catalog/tracker.go` for how the sidecar is
wired up in the real deployed pod.
