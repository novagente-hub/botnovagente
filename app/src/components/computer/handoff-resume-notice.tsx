import { useEffect, useRef, useState } from "react";
import { readControl } from "@/lib/computers/control";
import {
  forgetHandoff,
  hasActiveHandoff,
  type PendingHandoff,
  pendingHandoff,
  rememberHandoff,
  wasHandoffAnswered,
} from "@/lib/computers/handoff";
import {
  canAutoResumeHandoff,
  findPendingTool,
  type HandoffAgent,
  resumeHandoffTask,
} from "@/lib/copilot/handoff-resume";

/** SDK reconnect replays human-in-the-loop tools only; ordinary frontend handlers need this action. */
export function HandoffResumeNotice({
  botId,
  agent,
  ready,
  run,
}: {
  botId: string;
  agent: HandoffAgent;
  ready: boolean;
  run: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState<PendingHandoff | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const executing = useRef(false);
  const attemptedAutomatically = useRef(new Set<string>());
  // Callbacks change as messages stream; use current references in polling effects.
  const current = useRef({ agent, run });
  current.current = { agent, run };
  const resumeRef = useRef<(target: PendingHandoff) => Promise<void>>(
    async () => {},
  );
  // An agent rerender is not a human cancel. Only unmount or switching Bot detaches.
  useEffect(() => () => controller.current?.abort("detached"), []);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      let stored = pendingHandoff(botId);
      if (!stored) {
        const state = await readControl(botId).catch(() => null);
        const request = state?.request;
        if (request?.toolCallId) {
          const candidate = {
            requestId: request.id,
            toolCallId: request.toolCallId,
          };
          if (
            !wasHandoffAnswered(botId, candidate.requestId) &&
            findPendingTool(agent.messages, candidate)
          ) {
            rememberHandoff(botId, candidate.requestId, candidate.toolCallId);
            stored = candidate;
          }
        }
      }
      if (!live) return;
      if (stored && !findPendingTool(agent.messages, stored)) {
        const toolCallId = stored.toolCallId;
        const answered = agent.messages.some(
          (m) => m.role === "tool" && m.toolCallId === toolCallId,
        );
        if (answered) forgetHandoff(botId, stored.requestId);
        stored = null;
      }
      /*
       * Nothing to resume while a call in this tab is still waiting on the request, nor once one has taken its answer:
       * a person who left the conversation while holding control comes back to a new chat whose restored call looks
       * unanswered, while the turn that was running carried on with the answer and the reply is on its way here.
       */
      setPending(
        stored &&
          !hasActiveHandoff(botId, stored.requestId) &&
          !wasHandoffAnswered(botId, stored.requestId)
          ? stored
          : null,
      );
      timer = setTimeout(() => void check(), 1000);
    };
    void check();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [botId, agent, ready]);

  const resume = async (target: PendingHandoff) => {
    if (executing.current) return;
    executing.current = true;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setProblem(null);
    try {
      await resumeHandoffTask(
        botId,
        target,
        current.current.agent,
        current.current.run,
        abort.signal,
      );
    } catch (error) {
      setProblem(
        error instanceof Error
          ? error.message
          : "Não foi possível retomar a tarefa.",
      );
    } finally {
      executing.current = false;
      setBusy(false);
      controller.current = null;
    }
  };
  resumeRef.current = resume;

  useEffect(() => {
    if (!ready || !pending || busy || agent.isRunning) return;
    let live = true;
    const identity = `${botId}:${pending.requestId}:${pending.toolCallId}`;
    if (attemptedAutomatically.current.has(identity)) return;
    void (async () => {
      const state = await readControl(botId, pending.requestId).catch(
        () => null,
      );
      if (
        !live ||
        executing.current ||
        !canAutoResumeHandoff(pending, state, current.current.agent) ||
        attemptedAutomatically.current.has(identity)
      )
        return;
      // One automatic attempt per restored tool call on this tab; another tab
      // must also claim the durable checkpoint before it can run.
      attemptedAutomatically.current.add(identity);
      await resumeRef.current(pending);
    })();
    return () => {
      live = false;
    };
  }, [agent.isRunning, botId, busy, pending, ready]);

  if (!pending && !busy && !problem) return null;
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-amber-500/10 p-3 text-sm"
      role="status"
    >
      <span>
        {problem ??
          (busy
            ? "Aguardando este repasse do navegador terminar."
            : "Uma tarefa do navegador está pausada nesta conversa.")}
      </span>
      {busy ? (
        <button
          type="button"
          className="underline"
          onClick={() => controller.current?.abort()}
        >
          Parar de esperar
        </button>
      ) : (
        <button
          type="button"
          className="underline"
          disabled={!pending || agent.isRunning}
          onClick={() => {
            if (pending) void resumeRef.current(pending);
          }}
        >
          Retomar tarefa
        </button>
      )}
    </div>
  );
}
