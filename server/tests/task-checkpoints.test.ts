import { describe, expect, test } from "bun:test";
import {
  CheckpointConflictError,
  mayTransition,
} from "../src/agents/task-checkpoints";

describe("durable NovaBot task checkpoints", () => {
  test("only explicit recovery transitions are permitted", () => {
    expect(mayTransition("in_progress", "awaiting_human")).toBe(true);
    expect(mayTransition("awaiting_human", "ready_to_resume")).toBe(true);
    expect(mayTransition("rate_limited", "ready_to_resume")).toBe(true);
    expect(mayTransition("ready_to_resume", "in_progress")).toBe(true);
    expect(mayTransition("completed", "in_progress")).toBe(false);
    expect(mayTransition("awaiting_human", "completed")).toBe(false);
    expect(mayTransition("rate_limited", "in_progress")).toBe(false);
  });

  test("checkpoint conflicts remain explicit", () => {
    expect(new CheckpointConflictError().name).toBe("CheckpointConflictError");
  });
});
