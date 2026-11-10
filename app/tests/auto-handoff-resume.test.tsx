import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import type { Message } from "@ag-ui/core";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { cleanup, render, waitFor } from "@testing-library/react";
import { HandoffResumeNotice } from "@/components/computer/handoff-resume-notice";
import { rememberHandoff } from "@/lib/computers/handoff";
import { settleReactWork } from "./settle-react-work";

const originalFetch = globalThis.fetch;
beforeAll(() => GlobalRegistrator.register());
afterEach(() => {
  globalThis.fetch = originalFetch;
  sessionStorage.clear();
  cleanup();
});
afterAll(async () => {
  await settleReactWork();
  GlobalRegistrator.unregister();
});

function scenario(
  botId: string,
  status: "completed" | "waiting",
  claimed = true,
) {
  const requestId = `request-${botId}`;
  const toolCallId = `tool-${botId}`;
  const operations: string[] = [];
  rememberHandoff(botId, requestId, toolCallId);
  const agent = {
    messages: [
      {
        id: `assistant-${botId}`,
        role: "assistant" as const,
        toolCalls: [
          {
            id: toolCallId,
            type: "function" as const,
            function: {
              name: "computer_request_help",
              arguments: '{"reason":"Sign in"}',
            },
          },
        ],
      },
    ] as Message[],
    isRunning: false,
    setMessages(next: Message[]) {
      agent.messages = next;
      operations.push("tool-result");
    },
  };
  globalThis.fetch = Object.assign(
    async (url: Parameters<typeof fetch>[0]) => {
      const path = String(url);
      if (path.endsWith("/snapshot")) {
        operations.push("snapshot");
        return Response.json({ snapshotId: 123, elements: [] });
      }
      if (path.endsWith("/resume-claim")) {
        operations.push("claim");
        return Response.json({
          claimed,
          reason: claimed ? undefined : "Already resumed",
        });
      }
      return Response.json({
        holder: "bot",
        since: "2026-11-10T00:00:00Z",
        requested: false,
        transitioning: false,
        resumeSnapshotRequired: false,
        recoveryRequired: false,
        request: {
          id: requestId,
          status,
          source: "model",
          toolCallId,
          reason: "Sign in",
          createdAt: "2026-11-10T00:00:00Z",
          updatedAt: "2026-11-10T00:00:00Z",
        },
      });
    },
    { preconnect: () => undefined },
  ) as typeof fetch;
  const run = async () => {
    operations.push("resume-run");
  };
  render(<HandoffResumeNotice botId={botId} agent={agent} ready run={run} />);
  return { operations, agent };
}

test("restored chat automatically resumes the exact original run after release", async () => {
  const { operations, agent } = scenario("auto-resume-ok", "completed");
  await waitFor(() => expect(operations).toContain("resume-run"), {
    timeout: 1500,
  });
  expect(operations).toEqual([
    "snapshot",
    "claim",
    "tool-result",
    "resume-run",
  ]);
  expect(
    agent.messages.filter((message) => message.role === "tool"),
  ).toHaveLength(1);
});

test("waiting control never automatically resumes the original task", async () => {
  const { operations } = scenario("auto-resume-waiting", "waiting");
  await new Promise((resolve) => setTimeout(resolve, 120));
  expect(operations).toEqual([]);
});

test("refused claim shows a problem without running again", async () => {
  const { operations } = scenario("auto-resume-denied", "completed", false);
  await waitFor(() => expect(operations).toContain("claim"), {
    timeout: 1500,
  });
  expect(operations).not.toContain("resume-run");
  expect(operations).not.toContain("tool-result");
});
