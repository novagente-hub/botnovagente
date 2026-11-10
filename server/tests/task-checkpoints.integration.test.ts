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
