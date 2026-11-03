/**
 * NovaBot autonomy harness, MVP1.
 *
 * The AG-UI surface already persists the conversation. Derive each request's
 * budget from that history instead of keeping an in-memory counter that resets
 * when a bot is restarted or the next tool result arrives.
 *
 * A budget is NOT an authorization: the host still owns every tool grant and
 * approval. This guard only reduces automatic retries; it never grants tools.
 */
export const AUTONOMY_MAX_TOOL_CALLS = 12;
export const AUTONOMY_MAX_FAILED_RESULTS = 4;

export type AutonomyMessage = {
  role: string;
  content?: unknown;
  toolCallId?: string;
  toolCalls?: ReadonlyArray<{ id?: string }> | null;
};

export type AutonomyState = {
  actionCount: number;
  failureCount: number;
  remainingCalls: number;
  mode:
    | "active"
    | "permission-denied"
    | "unverified-action"
    | "budget-exhausted";
};

export function autonomyEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

type ToolOutcome = "success" | "failure" | "permission-denied" | "unverified";

function classifyToolResult(content: unknown): ToolOutcome {
  if (content == null || content === "") return "unverified";
  let value: unknown = content;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return "unverified";
    if (
      /^no result\b/i.test(text) ||
      /\bno result was (?:received|provided)\b/i.test(text)
    )
      return "unverified";
    if (
      /\b(?:denied by policy|blocked by policy|not allowed by (?:the )?policy)\b/i.test(
        text,
      )
    )
      return "permission-denied";
    if (
      /^(?:error|failed|failure|tool execution failed|timed out)\s*[:.-]/i.test(
        text,
      )
    )
      return "failure";
    if (text.length > 32768 || !/^[{[]/.test(text)) return "success";
    try {
      value = JSON.parse(text);
    } catch {
      return "success";
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return "success";
  const result = value as Record<string, unknown>;
  const error = result.error;
  const code =
    typeof result.code === "string"
      ? result.code
      : typeof error === "object" &&
          error !== null &&
          typeof (error as Record<string, unknown>).code === "string"
        ? (error as Record<string, string>).code
        : "";
  if (
    /^(?:policy_denied|permission_denied|forbidden_by_policy|tool_not_permitted)$/i.test(
      code,
    )
  )
    return "permission-denied";
  if (
    typeof error === "string" &&
    /\b(?:denied by policy|blocked by policy|not allowed by (?:the )?policy)\b/i.test(
      error,
    )
  )
    return "permission-denied";
  if (
    result.ok === false ||
    result.success === false ||
    result.status === "error" ||
    result.status === "failed" ||
    (typeof result.status === "number" && result.status >= 500) ||
    (typeof error === "string" && error.trim().length > 0) ||
    (typeof error === "object" && error !== null)
  )
    return "failure";
  return "success";
}

/** Budget for the latest human request only, reconstructed after every tool continuation. */
export function autonomyState(
  messages: readonly AutonomyMessage[],
): AutonomyState {
  let start = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") {
      start = i + 1;
      break;
    }
  }
  const calls = new Set<string>();
  let actionCount = 0;
  for (const message of messages.slice(start)) {
    if (message.role !== "assistant") continue;
    for (const call of message.toolCalls ?? []) {
      actionCount++;
      if (call.id) calls.add(call.id);
    }
  }
  let failureCount = 0;
  let denied = false;
  const answered = new Set<string>();
  for (const message of messages.slice(start)) {
    if (
      message.role !== "tool" ||
      !message.toolCallId ||
      !calls.has(message.toolCallId)
    )
      continue;
    if (answered.has(message.toolCallId)) continue;
    answered.add(message.toolCallId);
    const outcome = classifyToolResult(message.content);
    if (outcome === "failure") failureCount++;
    if (outcome === "permission-denied") denied = true;
    if (outcome === "unverified") continue;
  }
  const remainingCalls = Math.max(0, AUTONOMY_MAX_TOOL_CALLS - actionCount);
  const missingResult =
    [...calls].some((id) => !answered.has(id)) ||
    messages
      .slice(start)
      .some(
        (message) =>
          message.role === "tool" &&
          message.toolCallId &&
          calls.has(message.toolCallId) &&
          classifyToolResult(message.content) === "unverified",
      );
  const mode: AutonomyState["mode"] = denied
    ? "permission-denied"
    : missingResult
      ? "unverified-action"
      : remainingCalls === 0 || failureCount >= AUTONOMY_MAX_FAILED_RESULTS
        ? "budget-exhausted"
        : "active";
  return { actionCount, failureCount, remainingCalls, mode };
}

/** Context the model receives after the fixed, deployment-level autonomy policy. */
export function autonomyTurnGuidance(state: AutonomyState): string {
  if (state.mode === "permission-denied") {
    return "Autonomy stop: a tool reported a policy denial. Do not try another route to the same prohibited action. State the restriction and ask for legitimate access or authorization.";
  }
  if (state.mode === "unverified-action") {
    return "Autonomy stop: an earlier tool action has no verifiable result. Do not repeat it, especially if it might have changed anything. State what could not be verified and how to check it safely.";
  }
  if (state.mode === "budget-exhausted") {
    return "Autonomy stop: the bounded tool or failure budget has been reached. No more tools are available in this request. Explain what was tried, what is verified, and what still needs attention. Never claim success without evidence.";
  }
  return `Autonomy active: ${state.remainingCalls} tool actions remain for this request; ${state.failureCount} tool results failed (limit ${AUTONOMY_MAX_FAILED_RESULTS}). Investigate errors and try a different permitted approach rather than repeating a failed call. Verify the outcome before reporting success.`;
}

/** Enforce a finite action allowance even if one model completion proposes many calls. */
export function takeAllowedToolCalls<T>(
  state: AutonomyState,
  calls: readonly T[],
): T[] {
  if (state.mode !== "active") return [];
  return calls.slice(0, state.remainingCalls);
}
