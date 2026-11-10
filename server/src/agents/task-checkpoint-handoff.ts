/**
 * Link the governed computer's human handoff with NovaBot's durable task register.
 * A release means that a person returned the wheel, NOT that a login succeeded.
 * The original run remains the only component authorised to inspect the page and
 * resume an external action. Nothing here replays clicks or submits forms.
 */
import type { ComputerControlState } from "@openbot/shared/computer-control";
import type { ComputerSeat } from "../computer/computer-key";
import type { ActionActor } from "../computer/gateway";
import {
  CheckpointConflictError,
  type createTaskCheckpointStore,
  type TaskCheckpointScope,
} from "./task-checkpoints";

export type TaskCheckpointHandoffStore = ReturnType<
  typeof createTaskCheckpointStore
>;

function scopeFor(
  seat: ComputerSeat,
  actor: ActionActor,
  requestId: string,
): TaskCheckpointScope {
  return {
    ownerUserId: actor.id,
    agentId: seat.botId,
    taskId: `handoff:${requestId}`,
  };
}

export function createTaskCheckpointHandoff(store: TaskCheckpointHandoffStore) {
  return {
    async requested(
      seat: ComputerSeat,
      actor: ActionActor,
      state: ComputerControlState,
    ) {
      const request = state.request;
      if (!request || !["waiting", "taken"].includes(request.status)) return;
      const scope = scopeFor(seat, actor, request.id);
      const before = await store.begin(scope, {
        goal: "Resume the authorised browser task after human control returns.",
        ...(request.url ? { siteUrl: request.url } : {}),
      });
      if (before.status !== "in_progress") return;
      try {
        await store.transition(scope, {
          status: "awaiting_human",
          expectedRevision: before.revision,
          lastVerifiedStep:
            "Human control requested; no login result verified.",
          blocker: "authentication",
        });
      } catch (error) {
        if (!(error instanceof CheckpointConflictError)) throw error;
        // Two providers can observe the same request; the newer checkpoint wins.
      }
    },

    /**
     * Claim one restored AG-UI tool call. The browser must report the same
     * completed human request and toolCallId, then the checkpoint CAS permits
     * exactly one caller to continue. This never executes external actions.
     */
    async claim(
      seat: ComputerSeat,
      actor: ActionActor,
      requestId: string,
      toolCallId: string,
      state: ComputerControlState,
    ): Promise<{ claimed: boolean; reason?: string }> {
      if (
        state.holder !== "bot" ||
        state.request?.id !== requestId ||
        state.request.status !== "completed" ||
        state.request.source !== "model" ||
        state.request.toolCallId !== toolCallId ||
        !toolCallId.trim()
      )
        return {
          claimed: false,
          reason: "Browser handoff has not completed for this tool call.",
        };
      const scope = scopeFor(seat, actor, requestId);
      const before = await store.read(scope);
      if (before?.status !== "ready_to_resume")
        return {
          claimed: false,
          reason: "This handoff is not ready or has already been claimed.",
        };
      try {
        await store.transition(scope, {
          status: "in_progress",
          expectedRevision: before.revision,
          lastVerifiedStep:
            "Original tool call claimed for continuation; external result not yet verified.",
        });
        return { claimed: true };
      } catch (error) {
        if (error instanceof CheckpointConflictError)
          return {
            claimed: false,
            reason: "Another conversation already claimed this handoff.",
          };
        throw error;
      }
    },

    async released(
      seat: ComputerSeat,
      actor: ActionActor,
      requestId: string,
      state: ComputerControlState,
    ) {
      if (
        state.request?.id !== requestId ||
        state.request.status !== "completed"
      )
        return;
      const scope = scopeFor(seat, actor, requestId);
      const before = await store.read(scope);
      if (before?.status !== "awaiting_human") return;
      try {
        await store.transition(scope, {
          status: "ready_to_resume",
          expectedRevision: before.revision,
          lastVerifiedStep:
            "Control returned; inspect the live page before claiming login or resuming work.",
        });
      } catch (error) {
        if (!(error instanceof CheckpointConflictError)) throw error;
      }
    },
  };
}
