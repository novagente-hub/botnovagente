import { afterAll, beforeAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  CheckpointConflictError,
  CheckpointNotFoundError,
  createTaskCheckpointStore,
} from "../src/agents/task-checkpoints";
import { createDatabase } from "../src/db/client";
import { workItems } from "../src/db/schema";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const store = createTaskCheckpointStore(database);
const prefix = `checkpoint-${randomUUID()}`;
const owner = `${prefix}-owner`;
const agent = `${prefix}-agent`;
const task = `${prefix}-task`;
const scope = { ownerUserId: owner, agentId: agent, taskId: task };

beforeAll(async () => {
  // A dedicated test database is supplied by TEST_DATABASE_URL; no production data is used.
  const [present] = await database.execute(
    sql`select to_regclass('public.work_items')::text as name`,
  );
  expect(present?.name).toBe("work_items");
});

afterAll(async () => {
  await database
    .delete(workItems)
    .where(
      and(
        eq(workItems.kind, "novabot.task-checkpoint"),
        sql`${workItems.payload}->>'ownerUserId' = ${owner}`,
      ),
    );
  await database.$client.close();
});

test("durable task checkpoint keeps tenant isolation, identity and version", async () => {
  const saved = await store.begin(scope, {
    goal: "Finish the approved social-post draft",
    siteUrl: "https://www.instagram.com/accounts/login/?query=secret",
  });
  expect(saved.status).toBe("in_progress");
  expect(saved.siteOrigin).toBe("https://www.instagram.com");
  expect(saved.revision).toBe(1);
  expect(await store.begin(scope, { goal: "unrelated duplicate" })).toEqual(
    saved,
  );
  expect(
    await store.read({ ...scope, ownerUserId: "somebody-else" }),
  ).toBeNull();
  expect(await store.read({ ...scope, agentId: "another-agent" })).toBeNull();

  const waiting = await store.transition(scope, {
    expectedRevision: 1,
    status: "awaiting_human",
    lastVerifiedStep: "Login page opened; human sign-in requested",
    blocker: "authentication",
  });
  expect(waiting.revision).toBe(2);
  await expect(
    store.transition(scope, {
      expectedRevision: 1,
      status: "completed",
      lastVerifiedStep: "Never happened",
    }),
  ).rejects.toBeInstanceOf(CheckpointConflictError);
  await expect(
    store.transition(
      { ...scope, ownerUserId: "somebody-else" },
      {
        expectedRevision: 2,
        status: "ready_to_resume",
        lastVerifiedStep: "No ownership",
      },
    ),
  ).rejects.toBeInstanceOf(CheckpointNotFoundError);
  const continued = await store.transition(scope, {
    expectedRevision: 2,
    status: "ready_to_resume",
    lastVerifiedStep: "Control returned; authentication not yet confirmed",
  });
  expect(continued.revision).toBe(3);

  const raced = await Promise.allSettled([
    store.transition(scope, {
      expectedRevision: 3,
      status: "in_progress",
      lastVerifiedStep: "Fresh browser read confirmed task may resume",
    }),
    store.transition(scope, {
      expectedRevision: 3,
      status: "blocked",
      lastVerifiedStep: "Policy denied further actions",
      blocker: "policy",
    }),
  ]);
  expect(raced.filter((result) => result.status === "fulfilled")).toHaveLength(
    1,
  );
  expect(raced.filter((result) => result.status === "rejected")).toHaveLength(
    1,
  );

  const afterRestart = createTaskCheckpointStore(database);
  const recovered = await afterRestart.read(scope);
  expect(recovered?.revision).toBe(4);
  expect(["in_progress", "blocked"]).toContain(recovered?.status);
  expect(
    await database
      .select()
      .from(workItems)
      .where(eq(workItems.kind, "novabot.task-checkpoint")),
  ).toHaveLength(1);
});

test("gateway handoff becomes resumable only when a person returns control", async () => {
  const { createTaskCheckpointHandoff } = await import(
    "../src/agents/task-checkpoint-handoff"
  );
  const { personSeat } = await import("../src/computer/computer-key");
  const handoff = createTaskCheckpointHandoff(store);
  const seat = personSeat(owner, agent);
  const actor = { id: owner };
  const requestId = `${prefix}-human-handoff`;
  const requested = {
    holder: "bot" as const,
    since: "2026-11-10T00:00:00Z",
    requested: true,
    transitioning: false,
    resumeSnapshotRequired: false,
    recoveryRequired: false,
    request: {
      id: requestId,
      reason: "Sign into the account",
      source: "model" as const,
      status: "waiting" as const,
      createdAt: "2026-11-10T00:00:00Z",
      updatedAt: "2026-11-10T00:00:00Z",
      url: "https://www.instagram.com/accounts/login/?secret=ignored",
    },
  };
  await handoff.requested(seat, actor, requested);
  await handoff.requested(seat, actor, requested);
  const handoffScope = {
    ownerUserId: owner,
    agentId: agent,
    taskId: `handoff:${requestId}`,
  };
  const waiting = await store.read(handoffScope);
  expect(waiting?.status).toBe("awaiting_human");
  expect(waiting?.siteOrigin).toBe("https://www.instagram.com");
  expect(waiting?.revision).toBe(2);

  await handoff.released(seat, actor, requestId, {
    ...requested,
    request: { ...requested.request, status: "taken" },
  });
  expect((await store.read(handoffScope))?.status).toBe("awaiting_human");

  const released = {
    ...requested,
    requested: false,
    request: { ...requested.request, status: "completed" as const },
  };
  await handoff.released(seat, actor, "some-other-request", released);
  expect((await store.read(handoffScope))?.status).toBe("awaiting_human");
  await Promise.all([
    handoff.released(seat, actor, requestId, released),
    handoff.released(seat, actor, requestId, released),
  ]);
  const resumable = await store.read(handoffScope);
  expect(resumable?.status).toBe("ready_to_resume");
  expect(resumable?.revision).toBe(3);
  expect(resumable?.lastVerifiedStep).toContain("inspect the live page");
  expect(
    await store.read({ ...handoffScope, ownerUserId: "another-user" }),
  ).toBeNull();
});