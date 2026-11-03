import { describe, expect, test } from "bun:test";
import {
  MAX_MISSION_CYCLES,
  missionCanResume,
  missionInstruction,
} from "../src/missions/policy";

describe("NovaBot durable missions policy", () => {
  test("requires evidence and signed-in owner acknowledgment before replaying uncertain work", () => {
    expect(missionCanResume("needs-review", 1, false).allowed).toBe(false);
    expect(missionCanResume("needs-review", 1, true).allowed).toBe(true);
  });

  test("a tool approval must never be bypassed by restarting", () => {
    expect(missionCanResume("needs-approval", 1, true).allowed).toBe(false);
  });

  test("blocks invalid transitions, terminal work and too many cycles", () => {
    for (const status of [
      "queued",
      "running",
      "cancelled",
      "completed",
    ] as const)
      expect(missionCanResume(status, 1, true).allowed).toBe(false);
    expect(
      missionCanResume("needs-review", MAX_MISSION_CYCLES, true).allowed,
    ).toBe(false);
  });

  test("an instruction demands observable evidence and forbids blind retries", () => {
    const guidance = missionInstruction("Corrija CI", "Testes aprovados");
    expect(guidance).toContain("Corrija CI");
    expect(guidance).toContain("Testes aprovados");
    expect(guidance).toContain("Do not retry non-idempotent actions");
    expect(guidance).toContain("independently verified");
  });
});
