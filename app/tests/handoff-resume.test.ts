import {
  afterEach,
  beforeEach,
  expect,
  type Mock,
  spyOn,
  test,
} from "bun:test";
import type { Message } from "@ag-ui/core";
import {
  findPendingTool,
  resumeHandoffTask,
} from "../src/lib/copilot/handoff-resume";

let fetchSpy: Mock<typeof fetch>;
beforeEach(() => {
  fetchSpy = spyOn(globalThis, "fetch");
});
afterEach(() => fetchSpy.mockRestore());
const pending = { requestId: "request-1", toolCallId: "tool-1" };
const messages: Message[] = [
  {
    id: "assistant-1",
    role: "assistant",
    toolCalls: [
      {
        id: "tool-1",
        type: "function",
        function: {
          name: "computer_request_help",
          arguments: '{"reason":"Sign in"}',
        },
      },
    ],
  },
];
function resumedAgent() {
  const rows = [...messages];
  const order: string[] = [];
  const agent = {
    messages: rows,
    isRunning: false,
    setMessages: (next: Message[]) => {
      agent.messages = next;
      order.push("result");
    },
  };
  const run = async () => {
    order.push("run");
  };
  fetchSpy.mockImplementation(
    Object.assign(
      async (path: Parameters<typeof fetch>[0]) => {
        if (String(path).endsWith("/snapshot")) {
          order.push("snapshot");
          return Response.json({ snapshotId: 8, elements: [] });
        }
        return Response.json({
          holder: "bot",
          requested: false,
          request: { id: "request-1", status: "completed" },
        });
      },
      { preconnect: () => undefined },
    ),
  );
  return { agent, run, order };
}

test("restored missing tool result is completed on the same agent before continuation", async () => {
  const r = resumedAgent();
  expect(findPendingTool(r.agent.messages, pending)?.id).toBe("tool-1");
  await resumeHandoffTask("bot-1", pending, r.agent, r.run);
  expect(r.order).toEqual(["snapshot", "result", "run"]);
  expect(r.agent.messages.filter((m) => m.role === "tool")).toHaveLength(1);
  expect(r.agent.messages.at(-1)).toMatchObject({
    role: "tool",
    toolCallId: "tool-1",
  });
});

test("accepted tool results cannot be resumed or duplicated", async () => {
  const r = resumedAgent();
  r.agent.messages.push({
    id: "result",
    role: "tool",
    toolCallId: "tool-1",
    content: '{"ok":true}',
  });
  expect(findPendingTool(r.agent.messages, pending)).toBeNull();
  await expect(
    resumeHandoffTask("bot-1", pending, r.agent, r.run),
  ).rejects.toThrow("já foi respondida");
  expect(r.order).toEqual([]);
});

test("a different thread without the restored call cannot start a new task", async () => {
  const r = resumedAgent();
  r.agent.messages = [];
  await expect(
    resumeHandoffTask("bot-1", pending, r.agent, r.run),
  ).rejects.toThrow("não está nesta conversa");
  expect(r.order).toEqual([]);
});

test("SDK's forwarded-to-client placeholder is replaced by the actual result", async () => {
  const r = resumedAgent();
  r.agent.messages.push({
    id: "placeholder",
    role: "tool",
    toolCallId: "tool-1",
    content: "Forwarded to client",
  });
  await resumeHandoffTask("bot-1", pending, r.agent, r.run);
  expect(r.agent.messages.filter((m) => m.role === "tool")).toHaveLength(1);
  expect(
    r.agent.messages.some(
      (m) => m.role === "tool" && m.content === "Forwarded to client",
    ),
  ).toBe(false);
  expect(r.order).toEqual(["snapshot", "result", "run"]);
});

test("an interrupted restored handoff continues with an honest failure result", async () => {
  const r = resumedAgent();
  fetchSpy.mockImplementation(
    Object.assign(
      async () =>
        Response.json({
          holder: "bot",
          requested: false,
          request: {
            id: "request-1",
            status: "interrupted",
            interruption: "The browser restarted.",
          },
        }),
      { preconnect: () => undefined },
    ),
  );
  await resumeHandoffTask("bot-1", pending, r.agent, r.run);
  const result = r.agent.messages.find((m) => m.role === "tool");
  expect(result?.content).toContain('"ok":false');
  expect(result?.content).toContain('"handoffStatus":"interrupted"');
  expect(r.order).toEqual(["result", "run"]);
});

test("auto continuation only uses a completed, matching, unanswered tool call", async () => {
  const { canAutoResumeHandoff } = await import(
    "../src/lib/copilot/handoff-resume"
  );
  const r = resumedAgent();
  const control = {
    holder: "bot" as const,
    since: "2026-11-10T00:00:00Z",
    requested: false,
    transitioning: false,
    resumeSnapshotRequired: false,
    recoveryRequired: false,
    request: {
      id: "request-1",
      status: "completed" as const,
      source: "model" as const,
      toolCallId: "tool-1",
      reason: "Sign in",
      createdAt: "2026-11-10T00:00:00Z",
      updatedAt: "2026-11-10T00:00:00Z",
    },
  };
  expect(canAutoResumeHandoff(pending, control, r.agent)).toBe(true);
  expect(
    canAutoResumeHandoff(
      pending,
      { ...control, recoveryRequired: true },
      r.agent,
    ),
  ).toBe(false);
  expect(
    canAutoResumeHandoff(
      pending,
      {
        ...control,
        request: { ...control.request, status: "waiting" },
      },
      r.agent,
    ),
  ).toBe(false);
  expect(
    canAutoResumeHandoff(
      pending,
      {
        ...control,
        request: { ...control.request, toolCallId: "another-tool" },
      },
      r.agent,
    ),
  ).toBe(false);
  expect(
    canAutoResumeHandoff(
      pending,
      {
        ...control,
        request: { ...control.request, source: "manual" },
      },
      r.agent,
    ),
  ).toBe(false);
  expect(
    canAutoResumeHandoff(pending, control, { ...r.agent, isRunning: true }),
  ).toBe(false);
  expect(
    canAutoResumeHandoff(pending, control, { ...r.agent, messages: [] }),
  ).toBe(false);
});

test("active frontend tool claims the durable handoff before continuing", async () => {
  const r = resumedAgent();
  fetchSpy.mockImplementation(
    Object.assign(
      async (path: Parameters<typeof fetch>[0]) => {
        if (String(path).endsWith("/snapshot")) {
          r.order.push("snapshot");
          return Response.json({ snapshotId: 42, elements: [] });
        }
        if (String(path).includes("/resume-claim")) {
          r.order.push("claim");
          return Response.json({ claimed: true });
        }
        return Response.json({
          holder: "bot",
          requested: false,
          request: {
            id: "request-1",
            status: "completed",
            source: "model",
            toolCallId: "tool-1",
            reason: "Sign in",
          },
        });
      },
      { preconnect: () => undefined },
    ),
  );
  await resumeHandoffTask("bot-1", pending, r.agent, r.run);
  expect(r.order).toEqual(["snapshot", "claim", "result", "run"]);
});

test("a handoff already claimed elsewhere never starts the original run again", async () => {
  const r = resumedAgent();
  fetchSpy.mockImplementation(
    Object.assign(
      async (path: Parameters<typeof fetch>[0]) => {
        if (String(path).endsWith("/snapshot"))
          return Response.json({ snapshotId: 43, elements: [] });
        if (String(path).includes("/resume-claim"))
          return Response.json({ claimed: false, reason: "Already resumed" });
        return Response.json({
          holder: "bot",
          requested: false,
          request: {
            id: "request-1",
            status: "completed",
            source: "model",
            toolCallId: "tool-1",
            reason: "Sign in",
          },
        });
      },
      { preconnect: () => undefined },
    ),
  );
  await expect(
    resumeHandoffTask("bot-1", pending, r.agent, r.run),
  ).rejects.toThrow("Already resumed");
  expect(r.order).toEqual([]);
  expect(r.agent.messages.some((message) => message.role === "tool")).toBe(
    false,
  );
});
