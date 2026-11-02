import { type AuditOutcome, outcomeOf } from "@/lib/audit/outcome";
import { silenceOf } from "@/lib/audit/silence";

/** One row as the API returns it. */
export type AuditEvent = {
  id: string;
  actorUserId: string | null;
  /** Absent on a deployment that has not migrated yet. */
  initiatorKind?: string;
  initiatorId?: string | null;
  eventType: string;
  targetType: string;
  targetId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

type NameFor = (botId: string) => string;

/**
 * Each cell of the Audit table, and the same thing as plain text for the search box.
 *
 * The text versions read the same fields in the same order as the cells, so what a person can see
 * on a row is what they can find it by.
 */

const WHEN = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function whenText(event: AuditEvent): string {
  return WHEN.format(new Date(event.createdAt));
}

/** Strip the internal computer tool namespace for display. */
export function whatText(event: AuditEvent): string {
  const action = event.payload?.action;
  return typeof action === "string"
    ? action.replace("computer_", "")
    : event.eventType;
}

type Element = { role?: string; name?: string } | string | undefined;

/** The row's subject, the part of "On" that is not the page host. */
export function subjectText(event: AuditEvent): string {
  const payload = event.payload ?? {};
  const element = payload.element as Element;
  if (event.eventType === "mcp.tools_discovered")
    return typeof payload.offered === "number" &&
      typeof payload.granted === "number"
      ? `${payload.offered} de ${payload.granted} ferramentas`
      : "";
  if (NAMED_TARGETS.has(event.targetType) && event.targetId)
    return typeof payload.function === "string"
      ? `${event.targetId} · ${payload.function}`
      : event.targetId;
  if (typeof payload.file === "string") return payload.file;
  if (typeof payload.command === "string") return payload.command;
  if (typeof element === "object" && element?.name)
    return element.role ? `${element.name} (${element.role})` : element.name;
  if (typeof element === "string") return element;
  return "";
}

/** The page host under the subject, meaningful only for browser actions. */
export function hostText(event: AuditEvent): string {
  const payload = event.payload ?? {};
  return typeof payload.file !== "string" &&
    typeof payload.command !== "string" &&
    typeof payload.page === "string" &&
    payload.page
    ? hostOf(payload.page)
    : "";
}

/**
 * The Bot a row is about. Actions a Bot took carry it in the payload; events done TO a Bot (routed
 * to it, started, handed work, paused) record it as the target instead, and are just as much its row.
 */
export function botIdOf(event: AuditEvent): string | null {
  if (typeof event.payload?.bot === "string") return event.payload.bot;
  return event.targetType === "agent" && event.targetId ? event.targetId : null;
}

export function botText(event: AuditEvent, nameFor: NameFor): string {
  const bot = botIdOf(event);
  return bot ? nameFor(bot) : "";
}

export function startedByText(event: AuditEvent, nameFor: NameFor): string {
  switch (event.initiatorKind) {
    case "routine":
      return "Uma rotina";
    case "handoff":
      return event.initiatorId
        ? `Repassado por ${nameFor(event.initiatorId)}`
        : "Repassado";
    case "memory":
      return "Uma fonte de memória";
    case "responsibility":
      return "Uma responsabilidade";
    case "deployment":
      return "Esta implantação";
    default:
      return "Uma pessoa";
  }
}

export function decisionText(event: AuditEvent): string {
  const payload = event.payload ?? {};
  const outcome = outcomeOf(event.eventType);
  /*
   * Three different things, and the difference is what somebody comes to this row to find out.
   *
   * A person naming a coworker, the router matching one, and the router giving up and using the
   * default are not the same event, and one label covering all three would make the row worth less
   * than the reason line under it. Nothing here is a refusal, so none of them take the refusal
   * colour.
   */
  const routed =
    event.eventType === "channel.routed"
      ? payload.viaMention === true
        ? "A pessoa escolheu este Bot"
        : payload.fallback === true
          ? "Enviado ao Bot padrão"
          : "Enviado ao Bot a que se destinava"
      : null;
  return (
    routed ??
    DECISIONS[event.eventType] ??
    (outcome === "refused"
      ? "Bloqueado"
      : outcome === "did-not-happen"
        ? "Não aconteceu"
        : "Permitido")
  );
}

/** Every reason line under the decision, in the order the cell draws them. */
export function decisionDetails(event: AuditEvent): string[] {
  const payload = event.payload ?? {};
  const decision = (payload.decision ?? {}) as {
    allowed?: boolean;
    mode?: string;
    rule?: string | null;
    carriedOut?: boolean;
  };
  const failed = outcomeOf(event.eventType) === "did-not-happen";
  const lines: string[] = [];
  // Refusal reasons mirror the conversation-facing reason.
  if (
    (event.eventType === "component.refused" ||
      event.eventType === "component.function_refused" ||
      event.eventType === "mcp.call_rejected") &&
    typeof payload.reason === "string"
  )
    lines.push(payload.reason);
  /*
   * Why this run was offered what it was, which is the only part of a discovery row that cannot be
   * worked out from the numbers. "Nothing declared" and "selector unavailable" both offer everything
   * and mean entirely different things about the deployment.
   */
  if (
    event.eventType === "mcp.tools_discovered" &&
    typeof payload.reason === "string"
  )
    lines.push(
      `${DISCOVERY_REASONS[payload.reason] ?? payload.reason}${
        Array.isArray(payload.skills) && payload.skills.length > 0
          ? `: ${payload.skills.join(", ")}`
          : ""
      }`,
    );
  if (
    event.eventType === "mcp.callback_refused" &&
    typeof payload.refusal === "string"
  )
    lines.push(payload.refusal);
  /*
   * Why the conversation went where it went, which is the whole reason the row is written. Without
   * it a routing row says "Allowed" and names nobody, which is indistinguishable from a row that
   * failed to write.
   */
  if (
    event.eventType === "channel.routed" &&
    typeof payload.reason === "string"
  )
    lines.push(payload.reason);
  if (event.eventType === "bot.declined" && typeof payload.reason === "string")
    lines.push(`${payload.reason}, informado pelo próprio Bot`);
  if (failed && typeof payload.failure === "string")
    lines.push(payload.failure);
  /*
   * The two numbers the stall row is worth reading for. Without them every stalled turn looks the
   * same, and the difference between an endpoint that dies halfway through an answer and one that
   * never begins is the difference between a slow Bot and a dead one.
   */
  const silence =
    event.eventType === "agent.stream_stalled" ? silenceOf(payload) : null;
  if (silence) lines.push(silence);
  // Show concrete policy rules, but suppress the uninformative default `true` allow rule.
  if (decision.rule && decision.rule !== "true") lines.push(decision.rule);
  if (
    decision.mode === "dry-run" &&
    decision.allowed === false &&
    decision.carriedOut
  )
    lines.push("simulação: registrado, não aplicado");
  return lines;
}

/** Everything on a row as one lower-cased string, for the search box. */
export function searchTextOf(event: AuditEvent, nameFor: NameFor): string {
  return [
    whatText(event),
    subjectText(event),
    hostText(event),
    botText(event, nameFor),
    startedByText(event, nameFor),
    decisionText(event),
    ...decisionDetails(event),
  ]
    .join(" ")
    .toLowerCase();
}

export function OnCell({ event }: { event: AuditEvent }) {
  const payload = event.payload ?? {};
  const element = payload.element as Element;
  const subject = subjectText(event);
  const host = hostText(event);
  /*
   * Named targets, tool counts, files and commands are identifiers and read in mono; a page element
   * is a label and does not.
   */
  const mono =
    event.eventType === "mcp.tools_discovered" ||
    (NAMED_TARGETS.has(event.targetType) && !!event.targetId) ||
    typeof payload.file === "string" ||
    typeof payload.command === "string";
  return (
    <>
      {!subject ? (
        <span className="text-muted-foreground">-</span>
      ) : mono ? (
        <span className="font-mono text-xs">{subject}</span>
      ) : typeof element === "object" && element?.name ? (
        <span>
          {element.name}
          {element.role ? (
            <span className="text-muted-foreground"> ({element.role})</span>
          ) : null}
        </span>
      ) : (
        <span className="text-muted-foreground">{subject}</span>
      )}
      {host ? (
        <div className="text-muted-foreground text-xs">{host}</div>
      ) : null}
    </>
  );
}

export function BotCell({
  event,
  nameFor,
}: {
  event: AuditEvent;
  nameFor: NameFor;
}) {
  const bot = botIdOf(event);
  // Keep the immutable bot id available even when names collide.
  return bot ? (
    <span className="text-muted-foreground" title={bot}>
      {nameFor(bot)}
    </span>
  ) : (
    <span className="text-muted-foreground">-</span>
  );
}

export function StartedByCell({
  event,
  nameFor,
}: {
  event: AuditEvent;
  nameFor: NameFor;
}) {
  // Anything that ran with nobody watching is the colour of a warning; a person or the deployment is not.
  const unattended =
    event.initiatorKind === "routine" ||
    event.initiatorKind === "handoff" ||
    event.initiatorKind === "responsibility" ||
    event.initiatorKind === "memory";
  return (
    <span
      className={
        unattended
          ? "font-medium text-amber-600 dark:text-amber-500"
          : "text-muted-foreground"
      }
      title={unattended ? (event.initiatorId ?? undefined) : undefined}
    >
      {startedByText(event, nameFor)}
    </span>
  );
}

export function DecisionCell({ event }: { event: AuditEvent }) {
  const outcome = outcomeOf(event.eventType);
  return (
    <>
      <span
        className={
          outcome === "refused"
            ? "font-medium text-destructive"
            : outcome === "did-not-happen"
              ? "font-medium text-amber-600 dark:text-amber-500"
              : "text-muted-foreground"
        }
      >
        {decisionText(event)}
      </span>
      {decisionDetails(event).map((line) => (
        /*
         * A width rather than a max-width, because the table lays itself out from its content and a
         * max-width on a block inside a cell does not constrain that. A router's reason is a
         * sentence a model wrote, and left unbounded in the last column it pushes the table wider
         * than the pane.
         */
        <div
          className="mt-0.5 w-[22rem] max-w-full break-words text-muted-foreground text-xs"
          key={line}
        >
          {line}
        </div>
      ))}
    </>
  );
}

/** The square at the start of each row: what happened, at a glance down the log. */
export const OUTCOME_MARK: Record<AuditOutcome, string> = {
  refused: "bg-destructive",
  "did-not-happen": "bg-amber-500",
  allowed: "bg-muted-foreground/20",
};

/** The faint tint on rows worth stopping at. Allowed rows stay plain. */
export const OUTCOME_ROW: Record<AuditOutcome, string> = {
  refused: "bg-destructive/5 hover:bg-destructive/10",
  "did-not-happen": "bg-amber-500/5 hover:bg-amber-500/10",
  allowed: "",
};

/**
 * Why a run was offered the tools it was, in words rather than in the slug the server writes.
 *
 * Every one of these looks the same from outside: the Bot was handed some tools. The distinction is
 * the difference between a deployment that narrowed on purpose, one that has never declared a skill,
 * and one whose selector could not be reached, and only the last is a fault.
 */
const DISCOVERY_REASONS: Record<string, string> = {
  "under-floor": "Poucas ferramentas, então todas foram oferecidas",
  "nothing-declared": "Nenhuma habilidade declara estas ferramentas",
  unavailable: "Não foi possível escolher, então todas foram oferecidas",
  "nothing-chosen": "Nenhuma habilidade se aplicou, então todas foram oferecidas",
  selected: "Escolhidas pela habilidade",
};

/** Target types whose id is a name worth putting on screen; anything else falls through. */
const NAMED_TARGETS = new Set([
  "component",
  "mcp_tool",
  "mcp_server",
  "skill",
  "credential",
]);

const DECISIONS: Record<string, string> = {
  "bot.declined": "O Bot recusou",
  // Not a refusal, so not the refusal colour: nothing was blocked. The Bot was asked and never
  // answered, which is the same complaint as an action that was allowed and then did not happen.
  "agent.stream_stalled": "O Bot parou de responder",
  "computer.policy_loaded": "Limite na inicialização",
  "computer.isolation_loaded": "Isolamento na inicialização",
  "computer.control_taken": "Uma pessoa assumiu o controle",
  "computer.control_released": "O controle voltou para o Bot",
  "computer.help_requested": "O Bot pediu ajuda",
  "computer.secret_requested": "O Bot pediu um segredo",
  "computer.secret_supplied": "Uma pessoa forneceu um segredo",
  "computer.reset": "O computador foi redefinido",
  "computer.browser_cleared": "Uma pessoa limpou o navegador",
  "computer.updated": "O computador foi atualizado",
  "computer.stopped": "Uma pessoa clicou em parar",

  "component.granted": "Concedido a este Bot",
  "component.revoked": "Retirado deste Bot",
  "component.published": "Publicado. Todos os Bots podem usá-lo",
  "component.unpublished": "Despublicado. Nenhum Bot pode usá-lo",
  "component.draft_saved": "Rascunho salvo, ainda não publicado",
  "component.refused": "Recusado",
  "component.function_granted": "Pode ler isto",
  "component.function_revoked": "Não pode mais ler isto",
  "component.function_called": "Leu dados reais",
  "component.function_refused": "Recusado",
  // A function failure is execution failure, not a policy refusal.
  "component.function_failed": "Não conseguiu ler",

  // Not a call and not a decision: the tools this run was allowed to see. Worded so nobody reads it
  // as permission, which it is not — everything named was already granted.
  "mcp.tools_discovered": "Ferramentas oferecidas para uma execução",
  "mcp.call_succeeded": "Chamado em nome deste Bot",
  "mcp.call_rejected": "Bloqueado",
  "mcp.call_failed": "O servidor não respondeu",
  // Not "Blocked": nothing about the Bot was judged, because nothing proved which Bot it was.
  "mcp.callback_refused": "Não foi possível confirmar qual Bot era",

  "configuration.changed": "Configuração alterada",
  "credential.created": "Credencial salva",
};

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
