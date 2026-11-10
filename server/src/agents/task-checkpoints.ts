/**
 * NovaBot's durable checkpoint for a single agent task.
 *
 * Uses the existing `work_items` table, but a dedicated non-consumed kind. It is NOT
 * an executable queue entry: no worker claims it and no tool is re-run from it.
 * Actual resume execution must validate permissions and external idempotency first.
 *
 * The key is derived from the three identity dimensions. Every database read and
 * update additionally checks the stored owner and agent; knowing a task ID or a
 * digest never grants access to another tenant's checkpoint.
 */
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { workItems } from "../db/schema";

const KIND = "novabot.task-checkpoint";
const NON_CLAIMABLE_UNTIL = new Date("9999-12-31T00:00:00.000Z");
const MAX_SUMMARY = 500;

export type TaskCheckpointStatus =
  | "in_progress"
  | "awaiting_human"
  | "ready_to_resume"
  | "rate_limited"
  | "blocked"
  | "completed";

export type TaskCheckpointScope = {
  ownerUserId: string;
  agentId: string;
  taskId: string;
};

export type TaskCheckpoint = TaskCheckpointScope & {
  status: TaskCheckpointStatus;
  goal: string;
  lastVerifiedStep: string;
  /** Only origin: no cookies, passwords, page content, URL queries or fragments. */
  siteOrigin: string | null;
  blocker: "none" | "authentication" | "rate_limit" | "policy" | "other";
  revision: number;
};

export class CheckpointConflictError extends Error {
  constructor() {
    super("Task checkpoint changed or cannot make that transition.");
    this.name = "CheckpointConflictError";
  }
}

export class CheckpointNotFoundError extends Error {
  constructor() {
    super("Task checkpoint was not found for this owner and agent.");
    this.name = "CheckpointNotFoundError";
  }
}

const transitions: Record<
  TaskCheckpointStatus,
  readonly TaskCheckpointStatus[]
> = {
  in_progress: ["awaiting_human", "rate_limited", "blocked", "completed"],
  awaiting_human: ["ready_to_resume", "blocked"],
  ready_to_resume: ["in_progress", "rate_limited", "blocked", "completed"],
  rate_limited: ["ready_to_resume", "blocked"],
  blocked: ["ready_to_resume"],
  completed: [],
};

export function mayTransition(
  from: TaskCheckpointStatus,
  to: TaskCheckpointStatus,
): boolean {
  return transitions[from].includes(to);
}

function checkedScope(scope: TaskCheckpointScope) {
  for (const [label, value] of Object.entries(scope)) {
    if (typeof value !== "string" || !value.trim() || value.length > 200)
      throw new TypeError(`${label} must identify one owner, agent or task.`);
  }
  return scope;
}

function checkpointKey(scope: TaskCheckpointScope): string {
  checkedScope(scope);
  return createHash("sha256")
    .update(JSON.stringify([scope.ownerUserId, scope.agentId, scope.taskId]))
    .digest("hex");
}

function summary(value: string, label: string): string {
  if (!value.trim() || value.length > MAX_SUMMARY)
    throw new TypeError(`${label} must contain 1–${MAX_SUMMARY} characters.`);
  return value.trim();
}

function origin(value: string | null | undefined): string | null {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new TypeError("A site origin must be HTTP or HTTPS.");
  if (url.username || url.password)
    throw new TypeError("A site origin cannot contain credentials.");
  return url.origin;
}

function isCheckpoint(value: unknown): value is TaskCheckpoint {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<TaskCheckpoint>;
  return (
    typeof record.ownerUserId === "string" &&
    typeof record.agentId === "string" &&
    typeof record.taskId === "string" &&
    typeof record.goal === "string" &&
    typeof record.lastVerifiedStep === "string" &&
    typeof record.revision === "number" &&
    Number.isSafeInteger(record.revision) &&
    record.revision >= 1 &&
    typeof record.status === "string" &&
    Object.hasOwn(transitions, record.status)
  );
}

/** Reader and compare-and-swap writer for a single owner's task. */
export function createTaskCheckpointStore(database: Database) {
  const belongsTo = (scope: TaskCheckpointScope) =>
    and(
      eq(workItems.kind, KIND),
      eq(workItems.key, checkpointKey(scope)),
      sql`${workItems.payload}->>'ownerUserId' = ${scope.ownerUserId}`,
      sql`${workItems.payload}->>'agentId' = ${scope.agentId}`,
      sql`${workItems.payload}->>'taskId' = ${scope.taskId}`,
    );

  return {
    async read(scope: TaskCheckpointScope): Promise<TaskCheckpoint | null> {
      const [row] = await database
        .select({ payload: workItems.payload })
        .from(workItems)
        .where(belongsTo(scope))
        .limit(1);
      return isCheckpoint(row?.payload) ? row.payload : null;
    },

    async begin(
      scope: TaskCheckpointScope,
      input: { goal: string; siteUrl?: string },
    ): Promise<TaskCheckpoint> {
      const checkpoint: TaskCheckpoint = {
        ...checkedScope(scope),
        goal: summary(input.goal, "goal"),
        lastVerifiedStep: "Task registered; no external action verified.",
        siteOrigin: origin(input.siteUrl),
        status: "in_progress",
        blocker: "none",
        revision: 1,
      };
      await database
        .insert(workItems)
        .values({
          kind: KIND,
          key: checkpointKey(scope),
          runAt: NON_CLAIMABLE_UNTIL,
          payload: checkpoint,
        })
        .onConflictDoNothing();
      const saved = await this.read(scope);
      if (!saved) throw new CheckpointConflictError();
      return saved;
    },

    async transition(
      scope: TaskCheckpointScope,
      input: {
        expectedRevision: number;
        status: TaskCheckpointStatus;
        lastVerifiedStep: string;
        blocker?: TaskCheckpoint["blocker"];
      },
    ): Promise<TaskCheckpoint> {
      const before = await this.read(scope);
      if (!before) throw new CheckpointNotFoundError();
      if (
        before.revision !== input.expectedRevision ||
        !mayTransition(before.status, input.status)
      )
        throw new CheckpointConflictError();
      const checkpoint: TaskCheckpoint = {
        ...before,
        status: input.status,
        lastVerifiedStep: summary(input.lastVerifiedStep, "lastVerifiedStep"),
        blocker: input.blocker ?? "none",
        revision: before.revision + 1,
      };
      // Optimistic concurrency: a stale worker cannot overwrite a new human decision.
      const [written] = await database
        .update(workItems)
        .set({ payload: checkpoint, updatedAt: new Date() })
        .where(
          and(
            belongsTo(scope),
            sql`(${workItems.payload}->>'revision')::integer = ${before.revision}`,
            sql`${workItems.payload}->>'status' = ${before.status}`,
          ),
        )
        .returning({ key: workItems.key });
      if (!written) throw new CheckpointConflictError();
      return checkpoint;
    },
  };
}
