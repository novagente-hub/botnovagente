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
