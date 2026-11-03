import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { TurnRunner } from "@openbot/toolkit/run-turn";
import type { ChannelStore } from "../src/channels/routes";
import { createDatabase } from "../src/db/client";
import { createMissionRunner, MISSION_WORK_KIND } from "../src/missions/runner";
import { createMissionStore } from "../src/missions/store";
import { createWorkQueue } from "../src/work/queue";

const address = process.env.NOVABOT_TEST_DATABASE_URL;
if (!address)
  throw new Error(
    "NOVABOT_TEST_DATABASE_URL must be an isolated disposable PostgreSQL database",
  );
const database = createDatabase(address);
const store = createMissionStore(database.$client);
const queue = createWorkQueue(database);

beforeAll(async () => {
  await store.ready;
  // WorkQueue uses the product's existing work_items schema. The disposable
  // test database has no migrations, so create only its required test table.
  await database.$client.unsafe(`
    CREATE TABLE IF NOT EXISTS work_items (
      kind text NOT NULL,
      key text NOT NULL,
      run_at timestamptz NOT NULL DEFAULT now(),
      claimed_by text,
      lease_until timestamptz,
      attempts integer NOT NULL DEFAULT 0,
      finished_at timestamptz,
      last_error text,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (kind, key)
    )
  `);
});
afterAll(async () => {
  await database.$client.end({ timeout: 5 });
});

const channels = {
  get: async () => ({ agentIds: ["bot-a"], threadId: "thread-a" }),
} as unknown as Pick<ChannelStore, "get">;

const newMission = (key: string) =>
  store.create({
    ownerId: "person-a",
    agentId: "bot-a",
    channelId: "channel-a",
    goal: "Verificar login",
    successCriteria: "Tela aparece com conteúdo correto",
    idempotencyKey: key,
  });

describe("NovaBot missions integrated with real PostgreSQL WorkQueue", () => {
  test("a mission survives fresh store instances and executes only once", async () => {
    const mission = await newMission("queue-first");
    let executions = 0;
    const runner = createMissionRunner({
      store,
      queue,
      owner: "replica-a",
      channelStore: channels,
      runTurn: (async () => {
        executions++;
        return { replyText: "Resultado observado na página" };
      }) as TurnRunner,
    });
    await runner.sweep();
    await runner.sweep();
    expect(executions).toBe(1);
    const freshStore = createMissionStore(database.$client);
    expect((await freshStore.getFor("person-a", mission.id))?.status).toBe(
      "needs-review",
    );
    const [work] =
      await database.$client`SELECT attempts, finished_at FROM work_items
      WHERE kind = ${MISSION_WORK_KIND} AND key = ${`${mission.id}:0`}`;
    expect(work?.attempts).toBe(1);
    expect(work?.finished_at).toBeTruthy();
  });

  test("an expired lease is reclaimed as uncertain, NEVER reexecuted", async () => {
    const mission = await newMission("queue-crash");
    await queue.offer({
      kind: MISSION_WORK_KIND,
      key: `${mission.id}:0`,
      payload: { missionId: mission.id, cycle: 0 },
    });
    const first = await queue.claim({
      kind: MISSION_WORK_KIND,
      owner: "crashed-replica",
      leaseMs: 1000,
      limit: 1,
    });
    expect(first[0]?.attempts).toBe(1);
    // The process disappeared after claiming. We don't know whether a tool ran.
    await database.$client`UPDATE work_items SET lease_until = now() - interval '10 seconds'
      WHERE kind = ${MISSION_WORK_KIND} AND key = ${`${mission.id}:0`}`;
    let replayed = 0;
    const resumed = createMissionRunner({
      store,
      queue,
      owner: "replacement",
      channelStore: channels,
      runTurn: (async () => {
        replayed++;
        return { replyText: "Unexpected replay" };
      }) as TurnRunner,
    });
    await resumed.sweep();
    expect(replayed).toBe(0);
    const record = await store.getFor("person-a", mission.id);
    expect(record?.status).toBe("needs-review");
    expect(record?.lastError).toContain("external effects are unknown");
    expect(
      (await store.eventsFor("person-a", mission.id)).map(
        (event) => event.status,
      ),
    ).toEqual(["queued", "needs-review"]);
  });
});
