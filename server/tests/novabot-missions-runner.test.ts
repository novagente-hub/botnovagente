import { describe, expect, test } from "bun:test";
import { createMissionRunner, MISSION_WORK_KIND } from "../src/missions/runner";
import type { Mission, MissionStore } from "../src/missions/store";
import type { WorkQueue, WorkItem } from "../src/work/queue";
import type { TurnRunner } from "@openbot/toolkit/run-turn";
import type { ChannelStore } from "../src/channels/routes";

const mission: Mission = {
  id: "mission1",
  ownerId: "ownerA",
  agentId: "botA",
  channelId: "channelA",
  goal: "Encontrar falha",
  successCriteria: "O teste fica verde",
  idempotencyKey: "reqA",
  status: "queued",
  cycle: 0,
  revision: 0,
  result: null,
  lastError: null,
  verifiedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function fixture(attempts = 1, channelAllowed = true, failPersist = false) {
  const events: string[] = [];
  const jobs: WorkItem[] = [
    {
      kind: MISSION_WORK_KIND,
      key: "mission1:0",
      attempts,
      payload: { missionId: "mission1", cycle: 0 },
    },
  ];
  const store = {
    ready: Promise.resolve(),
    queued: async () => [mission],
    begin: async () => {
      events.push("begin");
      return { ...mission, status: "running" };
    },
    finish: async (_id: string, status: string) => {
      events.push(status);
      if (failPersist) throw new Error("temporary database outage");
      return { ...mission, status };
    },
    recoverUnknown: async () => {
      events.push("recovered-without-execution");
      return mission;
    },
  } as unknown as MissionStore;
  const queue = {
    offer: async () => {
      events.push("offered");
      return "queued";
    },
    claim: async () => jobs.splice(0, 1),
    finish: async () => {
      events.push("finished-queue");
      return true;
    },
  } as unknown as WorkQueue;
  const runTurn = (async (input: Parameters<TurnRunner>[0]) => {
    events.push("model-run");
    expect(input.ownerUserId).toBe("ownerA");
    expect(input.instruction).toContain("O teste fica verde");
    return { replyText: "Corrigi e observei dois testes" };
  }) as TurnRunner;
  const channelStore = {
    get: async () =>
      channelAllowed ? { agentIds: ["botA"], threadId: "threadA" } : null,
  } as unknown as Pick<ChannelStore, "get">;
  const runner = createMissionRunner({
    store,
    queue,
    owner: "owner1",
    runTurn,
    channelStore,
  });
  return { events, runner };
}

describe("mission runner uses existing durable queue", () => {
  test("executes one authorized attempt and never self-certifies completion", async () => {
    const { runner, events } = fixture();
    await runner.sweep();
    expect(events).toEqual([
      "offered",
      "begin",
      "model-run",
      "needs-review",
      "finished-queue",
    ]);
  });

  test("reclaimed job never replays unknown external effects", async () => {
    const { runner, events } = fixture(2);
    await runner.sweep();
    expect(events).toEqual([
      "offered",
      "recovered-without-execution",
      "finished-queue",
    ]);
    expect(events).not.toContain("model-run");
  });

  test("a failed checkpoint never acknowledges the queue item", async () => {
    const { runner, events } = fixture(1, true, true);
    await expect(runner.sweep()).rejects.toThrow("temporary database outage");
    expect(events).toContain("model-run");
    expect(events).not.toContain("finished-queue");
  });

  test("lost channel access prevents execution", async () => {
    const { runner, events } = fixture(1, false);
    await runner.sweep();
    expect(events).toContain("needs-review");
    expect(events).not.toContain("model-run");
  });
});
