import {
  describeApproval,
  type SharedUseApproval,
} from "@/lib/plugins/shared-use";

export function sharedSectionSentence(
  effect: "read" | "write",
  shared: boolean,
): string | null {
  if (!shared) return null;
  return effect === "write"
    ? "Qualquer pessoa que possa usar este Bot pode fazer isto como a conta compartilhada."
    : "Qualquer pessoa que possa usar este Bot pode ler o que esta conta pode ler.";
}

/**
 * Who may use a shared account through one Bot: the audience the Bot has now, offered as the
 * default, and only ever NARROWED here. Named people are offered only when the Bot is published to
 * named people, because that list is what a `people` approval records.
 */
export function SharedApprovalFields({
  value,
  onChange,
}: {
  value: SharedUseApproval;
  onChange: (next: SharedUseApproval) => void;
}) {
  const named = value.audience === "people" || value.members.length > 0;
  const options: { audience: SharedUseApproval["audience"]; label: string }[] =
    [
      { audience: "owner", label: "Só o dono" },
      ...(named
        ? [
            {
              audience: "people" as const,
              label: `Named: ${describeApproval({ ...value, audience: "people", outsideInput: false })}`,
            },
          ]
        : []),
      { audience: "team", label: "Todos" },
    ];
  return (
    <fieldset className="space-y-2 text-sm">
      <legend className="font-medium">
        Quem pode usar a conta compartilhada por meio deste Bot
      </legend>
      {options.map((option) => (
        <label className="flex items-center gap-2" key={option.audience}>
          <input
            checked={value.audience === option.audience}
            name="shared-audience"
            onChange={() =>
              onChange({
                ...value,
                audience: option.audience,
                members: option.audience === "people" ? value.members : [],
              })
            }
            type="radio"
          />
          {option.label}
        </label>
      ))}
      <label className="flex items-center gap-2">
        <input
          checked={value.outsideInput}
          onChange={(event) =>
            onChange({ ...value, outsideInput: event.target.checked })
          }
          type="checkbox"
        />
        Mensagens de fora (e-mail, Slack, webhooks) podem usá-la
      </label>
    </fieldset>
  );
}
