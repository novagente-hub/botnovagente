import { HeadlessToolSuspension } from "@openbot/toolkit/headless-tools";
import type { TurnRunner } from "@openbot/toolkit/run-turn";
import type { ChannelStore } from "../channels/routes";
import type { WorkQueue } from "../work/queue";
import { missionInstruction } from "./policy";
import type { MissionStore } from "./store";

/** Uses the existing durable WorkQueue, never a separate timer-based executor. */
export const MISSION_WORK_KIND = "novabot.mission";
export const MISSION_LEASE_MS = 10 * 60_000;

export type MissionRunner = {
  /** Each pass offers queued rows and executes at most one claimed mission. */
  sweep(): Promise<void>;
};

export function createMissionRunner(options: {
  store: MissionStore;
  queue: WorkQueue;
  owner: string;
  runTurn: TurnRunner;
  channelStore: Pick<ChannelStore, "get">;
  isBotPaused?: (ownerId: string, agentId: string) => Promise<boolean>;
}): MissionRunner {
  const { store, queue, owner, runTurn, channelStore } = options;

  async function settle(key: string): Promise<void> {
    const settled = await queue.finish({ kind: MISSION_WORK_KIND, key, owner });
    if (!settled)
      console.warn(
        "[novabot-missions] work lease was lost before final acknowledgement",
      );
  }

  async function sweep(): Promise<void> {
    await store.ready;
    // Repair the gap where a server died AFTER committing the mission but
    // BEFORE offering it to the queue. Idempotence is in the queue's key.
    for (const mission of await store.queued(25)) {
      await queue.offer({
        kind: MISSION_WORK_KIND,
        key: `${mission.id}:${mission.cycle}`,
        payload: { missionId: mission.id, cycle: mission.cycle },
      });
    }
    const items = await queue.claim({
      kind: MISSION_WORK_KIND,
      owner,
      leaseMs: MISSION_LEASE_MS,
      maxAttempts: 2,
      limit: 1,
    });
    for (const item of items) {
      const missionId = item.payload.missionId;
      const cycle = item.payload.cycle;
      if (typeof missionId !== "string" || !Number.isInteger(cycle)) {
        await settle(item.key);
        continue;
      }
      // A reclaimed lease might have already invoked a browser, payment or
      // message tool. Never replay it without the person's review.
      if (item.attempts !== 1) {
        await store.recoverUnknown(
          missionId,
          "Previous execution was interrupted. Its external effects are unknown; review before resuming.",
          cycle as number,
        );
        await settle(item.key);
        continue;
      }
      const mission = await store.begin(missionId, cycle as number);
      if (!mission) {
        await settle(item.key); // cancelled, resumed elsewhere or already running
        continue;
      }
      let status: "needs-review" | "needs-approval" = "needs-review";
      let detail: string;
      try {
        const actor = { id: mission.ownerId, role: "user" as const };
        const channel = await channelStore.get(actor, mission.channelId);
        if (!channel?.agentIds.includes(mission.agentId)) {
          detail =
            "Access to the mission channel or Bot was revoked; no model action was executed.";
        } else if (
          await options.isBotPaused?.(mission.ownerId, mission.agentId)
        ) {
          detail = "The Bot is paused; no model action was executed.";
        } else {
          const { replyText } = await runTurn({
            ownerUserId: mission.ownerId,
            routineId: mission.id,
            agentId: mission.agentId,
            threadId: channel.threadId,
            instruction: missionInstruction(
              mission.goal,
              mission.successCriteria,
            ),
          });
          // The model's reply is a candidate, not independent verification.
          detail = replyText || "The agent gave no verifiable reply.";
        }
      } catch (error) {
        if (error instanceof HeadlessToolSuspension) {
          status = "needs-approval";
          detail = error.message;
        } else {
          const message =
            error instanceof Error ? error.message : String(error);
          detail = `Attempt failed: ${message}`;
        }
      }
      // Persist the outcome BEFORE acknowledging the queue item. If the
      // database write fails, the lease expires and a later claimant marks
      // the mission for review without replaying tools.
      const saved = await store.finish(mission.id, status, detail);
      if (saved) await settle(item.key);
    }
  }
  return { sweep };
}
