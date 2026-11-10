# NovaBot: lessons from OpenMausBot (reference only)

Reference: https://github.com/milind-soni/OpenMausBot (reviewed 2026-11-10).

## Adopted in this branch

- Agent continuity contract: preserve the user's original objective across a human takeover.
- Post-handoff verification: read live browser state, verify authentication, then continue.
- Bounded recovery: distinguish transient startup failures from rate limits or access refusals.
- Clear operational result: actual success, partial progress and a concrete blocker are distinct.

These are behavioral instructions, not an automatic durable queue. Existing hosted browser profiles and per-agent isolation remain intact. No code from the external repository was copied.

## Not adopted

- Meta APIs and OAuth integrations: excluded from this initiative by product decision.
- Cloud desktop providers, local-first/desktop dependency, and upstream hosted licensing: not imported.
- Evasion of authentication, CAPTCHA, account security controls, or network rate limits: prohibited.

## Commercial rollout requirements (future separate implementation)

1. Persist a typed execution checkpoint on durable storage, keyed by tenant + agent + job, with bounded retries and idempotency checks.
2. Model `requires_human_login`, `rate_limited`, `blocked_by_policy`, `recoverable_error`, `done` as separate statuses, rather than treating a request to sign in as success.
3. Keep each client's browser profile, secrets and network authorizations isolated; audit access and explicitly destroy sessions on revocation.
4. Provide approved session login through the customer's *hosted* browser with human takeover and provider-compliant access. Do not assume IP changes will fix Instagram's HTTP 429 responses.
5. End-to-end test on staging against a permitted test account before enabling any production login automation.
6. Review OpenMausBot LICENSE and `enterprise/LICENSE` before reusing any upstream source. The upstream OSS core is Apache 2.0; hosted/white-label enterprise features are not freely licensed.

## Phase 2: persistent checkpoint storage (implemented in the draft PR)

`server/src/agents/task-checkpoints.ts` stores a typed, tenant- and agent-scoped
checkpoint in the existing `work_items` PostgreSQL table under the dedicated
`novabot.task-checkpoint` kind. No new migration is required; this kind has no
worker and a far-future `runAt` so it cannot accidentally run as a task.

- `begin`: create checkpoint idempotently (owner + agent + task digest).
- `read`: enforce owner, agent and task scope on every lookup.
- `transition`: compare-and-swap version/status; explicit permissible states.
- Saves only a site *origin*, not URL paths, query strings, cookies or passwords.
- `completed` is terminal; no transition can automatically replay side effects.

Status model: `in_progress`, `awaiting_human`, `ready_to_resume`,
`rate_limited`, `blocked`, `completed`.

The storage layer is independently tested, including live PostgreSQL tests against
an isolated staging test database. It is **not connected to live job execution or
browser release hooks yet**. The next integration must attach checkpoints to
an authenticated run, update state on handoff/release and use the existing
lease-based queue to resume only approved, idempotent work. A database checkpoint
by itself neither resumes the original run nor fixes Instagram login.

## Phase 3: computer gateway handoff event integration (draft)

`createComputerGateway` now accepts an optional `handoffCheckpoint` adapter.
Both model/headless and manual help requests pass through this gateway, so a
waiting control request creates an `awaiting_human` checkpoint. Only a matching,
completed release advances it to `ready_to_resume` via revision-checked writes.
It never declares a login successful, replays browser actions, or retries HTTP 429.
Checkpoint persistence is best-effort: an unavailable checkpoint database does
not lock a human out of returning the browser. Production activation requires
merging, deployment and end-to-end authorised login validation; none done here.

## Phase 4: exactly-one continuation claim for live AG-UI chats (draft)

When a person's browser control is returned, the **same restored conversation**
now attempts its outstanding `computer_request_help` tool automatically, but
only if the browser reports a completed request with its original `toolCallId`
and the original thread still holds the unanswered tool call. The original
live frontend tool follows the same claim protocol, so another tab cannot
resume the same pending tool while the original tab is also resuming.

The new `/api/computers/:botId/control/resume-claim` endpoint is protected by
the session's computer permissions and validates the control state by reading
it from the computer. A matching `model` handoff + tenant-owned PostgreSQL
checkpoint must be `ready_to_resume`; an atomic revision transition grants a
single caller its right to complete the original tool result. Nothing here
replays clicks, publishes a post or stores credentials. A fresh snapshot is
required before the claim. A rate limit/CAPTCHA never triggers auto-login.

**Explicit limitations:** this auto-continues interactive AG-UI conversations
that are still open or are later reopened by their owner. It does **not** yet
resume fully unattended jobs when every browser/chat tab is closed; those need
a durable server-side continuation snapshot and worker. Browser-generated
challenges without a model tool-call checkpoint still use the existing manual
handoff path. If a tab crashes after claiming but before executing a run, the
claim stays held to avoid duplicate external side effects; a reviewed recovery
workflow is needed before a retry. Instagram HTTP 429 is unaffected. No Meta API.
