import { describe, expect, test } from "bun:test";
import { savedToolCall } from "../src/approvals/wiring";

// What the browser asks to run: the Bot's click, as the live stream delivered it whole.
const snapshot = {
  toolCallId: "call_trzjXH0dFVyoivzeFqY2kn4D",
  toolName: "computer_click",
  args: { ref: "f2e94", snapshotId: 7 },
};

/** The conversation as Intelligence returns it, holding the click with these saved arguments. */
const conversation = (args: string | null, answered = false) =>
  ({
    messages: [
      ...(args === null
        ? []
        : [
            {
              id: "1941c748-b06c-4cf6-89f0-a8904e89b22c",
              role: "assistant",
              toolCalls: [
                {
                  id: snapshot.toolCallId,
                  type: "function",
                  function: { name: "computer_click", arguments: args },
                },
              ],
            },
          ]),
      ...(answered
        ? [{ id: "result", role: "tool", toolCallId: snapshot.toolCallId }]
        : []),
    ],
  }) as never;

/** Each read returns the next saved state, then keeps returning the last. */
const reads = (...states: never[]) => {
  let index = 0;
  return async () => states[Math.min(index++, states.length - 1)]!;
};
const noWait = { sleep: async () => {} };

describe("the saved copy of a call the browser is about to run", () => {
  test("a call read while its arguments are still being saved is waited for, not refused", async () => {
    // Intelligence saves a call's arguments delta by delta, behind the stream: a read can land
    // after the call starts and before its arguments end. The first reads here are what run 112
    // of the Kite demo held part-way through: half the JSON, then all of it but the last key.
    const saved = await savedToolCall(
      reads(
        conversation('{"ref":"f2e'),
        conversation('{"ref":"f2e94"}'),
        conversation('{"ref":"f2e94","snapshotId":7}'),
      ),
      snapshot,
      noWait,
    );
    expect(saved).toEqual({ matches: true, answered: false });
  });

  test("a call that never appears, or never matches, is still refused once the wait runs out", async () => {
    expect(
      await savedToolCall(reads(conversation(null)), snapshot, noWait),
    ).toMatchObject({ matches: false });
    expect(
      await savedToolCall(
        reads(conversation('{"ref":"e12","snapshotId":7}')),
        snapshot,
        noWait,
      ),
    ).toMatchObject({ matches: false });
    expect(
      await savedToolCall(reads(conversation('{"ref":"f2e')), snapshot, noWait),
    ).toMatchObject({ matches: false });
  });

  test("a call that already has a result is reported as answered", async () => {
    expect(
      await savedToolCall(
        reads(conversation('{"ref":"f2e94","snapshotId":7}', true)),
        snapshot,
        noWait,
      ),
    ).toEqual({ matches: true, answered: true });
  });
});

describe("persisted AG-UI tool call verification", () => {
  test("supports a legacy flat saved call without weakening exact argument checks", async () => {
    const legacy = {
      messages: [
        {
          role: "assistant",
          toolCalls: [
            {
              id: snapshot.toolCallId,
              name: snapshot.toolName,
              args: JSON.stringify(snapshot.args),
            },
          ],
        },
      ],
    } as never;
    expect(await savedToolCall(reads(legacy), snapshot, noWait)).toEqual({
      matches: true,
      answered: false,
    });
  });

  test("rejects another tool name even when the call id and args match", async () => {
    const other = {
      messages: [
        {
          role: "assistant",
          toolCalls: [
            {
              id: snapshot.toolCallId,
              type: "function",
              function: {
                name: "computer_write_file",
                arguments: JSON.stringify(snapshot.args),
              },
            },
          ],
        },
      ],
    } as never;
    expect((await savedToolCall(reads(other), snapshot, noWait)).matches).toBe(
      false,
    );
  });

  test("refuses a changed argument payload even with the right name and id", async () => {
    expect(
      (
        await savedToolCall(
          reads(conversation('{"ref":"f2e94","snapshotId":999}')),
          snapshot,
          noWait,
        )
      ).matches,
    ).toBe(false);
  });

  test("refuses a forged call id even when name and args match", async () => {
    const wrong = {
      ...snapshot,
      toolCallId: "call_forged",
    };
    expect(
      (
        await savedToolCall(
          reads(conversation('{"ref":"f2e94","snapshotId":7}')),
          wrong,
          noWait,
        )
      ).matches,
    ).toBe(false);
  });
});
