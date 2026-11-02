import type { ActionPolicy, RuleLabel } from "@/lib/computers/queries";

/**
 * A rule an administrator can start from, in words first and CEL underneath.
 *
 * `cost` is what the rule also catches, or misses, that its name does not say. Each one is a real
 * edge of the rule as written, so it is shown before the rule is added rather than discovered from
 * the refusals it produces.
 */
export type RuleTemplate = RuleLabel & { rule: string; cost: string };

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    name: "Nunca enviar um formulário",
    description: "Impede que um Bot clique em um botão de envio ou pressione Enter enquanto digita.",
    // `key` is guarded by tool name so the clause short-circuits before it on actions that have no
    // keypress in them. Both tools that can press Enter are named: `computer_type` takes a `submit`
    // flag that presses it once the text is in, and a rule naming only `computer_key` left that door
    // open.
    rule: '(intent == "activate" && contains(element.name, "submit")) || ((tool.name == "computer_key" || tool.name == "computer_type") && key == "Enter")',
    cost: "Também impede o Bot de pressionar Enter em qualquer outro lugar. Um formulário pode ser enviado com Enter em qualquer campo.",
  },
  {
    name: "Nunca digitar em um campo de senha",
    description: "Impede que um Bot digite em um campo marcado como senha.",
    rule: 'intent == "type" && contains(element.name, "password")',
    cost: "Uma caixa de senha com outro rótulo não é coberta. A regra corresponde ao rótulo.",
  },
  {
    name: "Ficar longe das redes sociais",
    description: "Impede que um Bot abra o Facebook ou o X.",
    rule: 'intent == "navigate" && (contains(page.host, "facebook.com") || contains(page.host, "x.com"))',
    cost: "Só estes dois sites. Um link que redireciona para lá de outro lugar é permitido.",
  },
];

/** What a rule can be written against, in the words an administrator would use. */
export const RULE_ATTRIBUTES: { name: string; meaning: string }[] = [
  {
    name: "tool.name",
    meaning:
      "A ação, como computer_click, computer_type ou computer_key.",
  },
  {
    name: "intent",
    meaning: "Para que serve a ação: activate, type ou navigate.",
  },
  { name: "bot.id", meaning: "O Bot que faz a ação." },
  { name: "actor.id", meaning: "A pessoa em nome de quem o Bot age." },
  {
    name: "initiator.kind",
    meaning:
      "O que iniciou a execução: pessoa, rotina ou repasse. Uma execução agendada age como o dono, então actor.id sozinho não diz isso.",
  },
  { name: "page.url, page.host", meaning: "A página em que o Bot está." },
  {
    name: "element.name, element.role",
    meaning: "O botão, link ou campo sendo clicado ou preenchido.",
  },
  { name: "key", meaning: "The key pressed, such as Enter." },
  { name: "file", meaning: "O arquivo sendo lido ou gravado." },
  { name: "command", meaning: "O comando sendo executado." },
  {
    name: "mcp.server, mcp.tool, mcp.effect",
    meaning:
      "Para a ferramenta de um app conectado: qual app, qual ferramenta, e leitura ou gravação.",
  },
];

/** The name a rule is shown by: its label, a template's name if it is one, or plainly "Custom rule". */
export function ruleLabel(policy: ActionPolicy, rule: string): RuleLabel {
  const label = policy.labels?.[rule];
  if (label) return label;
  const template = RULE_TEMPLATES.find((one) => one.rule === rule);
  if (template)
    return { name: template.name, description: template.description };
  return { name: "Regra personalizada", description: "" };
}

/** The policy without one rule, and without that rule's label. */
export function withoutRule(policy: ActionPolicy, rule: string): ActionPolicy {
  const { [rule]: _removed, ...labels } = policy.labels ?? {};
  return {
    ...policy,
    deny: policy.deny.filter((one) => one !== rule),
    labels,
  };
}
