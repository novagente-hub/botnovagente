/**
 * A mission's authority is smaller than its objective: model output cannot
 * upgrade permission, certify itself, or silently replay uncertain effects.
 */
export type MissionStatus =
  | "queued"
  | "running"
  | "needs-review"
  | "needs-approval"
  | "completed"
  | "cancelled";

export const MAX_MISSION_CYCLES = 3;
export const MAX_MISSION_GOAL_CHARS = 2000;
export const MAX_MISSION_RESULT_CHARS = 8000;

export function missionCanResume(
  status: MissionStatus,
  cycles: number,
  acknowledgeUnknownEffects: boolean,
): { allowed: boolean; reason: string } {
  if (status === "needs-approval")
    return {
      allowed: false,
      reason: "An approval cannot be bypassed by restarting this mission.",
    };
  if (status !== "needs-review")
    return {
      allowed: false,
      reason: "Only missions awaiting review can be resumed.",
    };
  if (cycles >= MAX_MISSION_CYCLES)
    return { allowed: false, reason: "Mission retry limit reached." };
  if (!acknowledgeUnknownEffects)
    return {
      allowed: false,
      reason:
        "Review external effects first; explicit acknowledgment is required.",
    };
  return { allowed: true, reason: "" };
}

export function missionInstruction(
  goal: string,
  successCriteria: string,
): string {
  return [
    "This is ONE authorized attempt of a tracked NovaBot mission.",
    "Goal:",
    goal,
    "Evidence required to consider the goal achieved:",
    successCriteria,
    "Use only tools currently granted to you.",
    "Do not retry non-idempotent actions with unknown outcomes.",
    "Read available evidence after acting. If a safe approach fails, try another permitted one.",
    "Never claim a mission has been independently verified by your own reply.",
    "Report what you did, the observed evidence, and any unresolved blocker.",
  ].join("\n");
}
