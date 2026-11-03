import { describe, expect, test } from "bun:test";
import {
  AUTONOMY_MAX_TOOL_CALLS,
  autonomyEnabled,
  autonomyState,
  autonomyTurnGuidance,
  takeAllowedToolCalls,
  type AutonomyMessage,
} from "./autonomy";

const ask = (content = "Faça isso") => ({ role: "user", content });
const action = (id: string) => ({
  role: "assistant",
  toolCalls: [{ id }],
});
const result = (id: string, content: unknown) => ({
  role: "tool",
  toolCallId: id,
  content,
});

describe("NovaBot autonomy recovery policy", () => {
  test("disabled unless explicitly enabled", () => {
    expect(autonomyEnabled(undefined)).toBe(false);
    expect(autonomyEnabled("1")).toBe(false);
    expect(autonomyEnabled("TRUE")).toBe(true);
  });

  test("reconstructs progress from durable history and resets on a new user request", () => {
    const first = [
      ask(),
      action("a"),
      result("a", '{"ok":false}'),
      action("b"),
      result("b", '{"ok":true}'),
    ];
    const state = autonomyState(first);
    expect(state).toMatchObject({
      mode: "active",
      actionCount: 2,
      failureCount: 1,
    });
    expect(state.remainingCalls).toBe(AUTONOMY_MAX_TOOL_CALLS - 2);
    expect(autonomyState([...first, ask("Agora outra missão")])).toMatchObject({
      mode: "active",
      actionCount: 0,
      failureCount: 0,
    });
  });

  test("allows another strategy after a failed attempt", () => {
    const state = autonomyState([
      ask(),
      action("a"),
      result("a", '{"error":"timeout"}'),
    ]);
    expect(state.mode).toBe("active");
    expect(autonomyTurnGuidance(state)).toContain(
      "different permitted approach",
    );
  });

  test("blocks permission workarounds, not a plain HTTP login wall", () => {
    expect(
      autonomyState([
        ask(),
        action("a"),
        result("a", '{"code":"policy_denied"}'),
      ]).mode,
    ).toBe("permission-denied");
    expect(
      autonomyState([
        ask(),
        action("a"),
        result("a", '{"status":401,"error":"Login required"}'),
      ]).mode,
    ).toBe("active");
  });

  test("does not circumvent a policy refusal written in JSON error text", () => {
    expect(
      autonomyState([
        ask(),
        action("a"),
        result("a", '{"error":"blocked by policy"}'),
      ]).mode,
    ).toBe("permission-denied");
  });

  test("does not retry an action whose result was lost", () => {
    expect(autonomyState([ask(), action("a")]).mode).toBe("unverified-action");
    expect(
      autonomyState([
        ask(),
        action("a"),
        result("a", "No result was provided."),
      ]).mode,
    ).toBe("unverified-action");
  });

  test("does not treat ordinary success text containing error as a failed action", () => {
    expect(
      autonomyState([ask(), action("a"), result("a", "No errors found.")])
        .failureCount,
    ).toBe(0);
  });

  test("caps repeated failures without an infinite loop", () => {
    const messages: AutonomyMessage[] = [ask()];
    for (let i = 0; i < 4; i++) {
      messages.push(action(String(i)), result(String(i), '{"success":false}'));
    }
    expect(autonomyState(messages).mode).toBe("budget-exhausted");
  });

  test("caps total actions even when each result succeeds", () => {
    const messages: AutonomyMessage[] = [ask()];
    for (let i = 0; i < AUTONOMY_MAX_TOOL_CALLS; i++) {
      messages.push(action(String(i)), result(String(i), "ok"));
    }
    expect(autonomyState(messages).mode).toBe("budget-exhausted");
    expect(autonomyState(messages).remainingCalls).toBe(0);
  });

  test("enforces the budget on a multi-call model completion", () => {
    const initial = autonomyState([
      ask(),
      ...Array.from({ length: 11 }, (_, i) => [
        action(String(i)),
        result(String(i), "ok"),
      ]).flat(),
    ]);
    expect(takeAllowedToolCalls(initial, ["read", "write", "delete"])).toEqual([
      "read",
    ]);
    expect(
      takeAllowedToolCalls({ ...initial, mode: "permission-denied" }, ["read"]),
    ).toEqual([]);
  });

  test("ignores unrelated tool responses and does not count them", () => {
    const state = autonomyState([
      ask(),
      action("a"),
      result("outside", '{"ok":false}'),
      result("a", "ok"),
    ]);
    expect(state).toMatchObject({
      actionCount: 1,
      failureCount: 0,
      mode: "active",
    });
  });
});
