import {
  IconChecklist,
  IconEyeCheck,
  IconHandStop,
  IconTerminal2,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import {
  PageEmpty,
  PageRows,
  PageSection,
} from "@/components/layout/page-shell";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { agentListQueryOptions } from "@/lib/agents/queries";
import {
  approvalInboxOptions,
  approvalPreferencesMutationOptions,
  createApprovalRuleMutationOptions,
  revokeApprovalRuleMutationOptions,
  ruleCoversBot,
  updateApprovalRuleMutationOptions,
} from "@/lib/approvals";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { queryClient } from "@/query-client";
import { HOST_LABELS, LabelSelect, RuleForm, RuleRow } from "./rules";

/**
 * The person's own approval settings: whether their Bots ask before changing things, and the rules
 * that apply to every one of their Bots. Team rules are listed so the person can see them, locked;
 * administrators change them in Admin → Approvals. Rules for a single Bot are on that Bot's page.
 */
export function ApprovalSettings() {
  const inbox = useQuery(approvalInboxOptions());
  const me = useQuery(currentUserQueryOptions()).data;
  const agents = useQuery(agentListQueryOptions());
  const hiddenAgents = useQuery(agentListQueryOptions(true));
  const preferences = useMutation(
    approvalPreferencesMutationOptions(queryClient),
  );
  const addRule = useMutation(createApprovalRuleMutationOptions(queryClient));
  const changeRule = useMutation(
    updateApprovalRuleMutationOptions(queryClient),
  );
  const revoke = useMutation(revokeApprovalRuleMutationOptions(queryClient));
  const error =
    inbox.error ?? preferences.error ?? changeRule.error ?? revoke.error;
  if (inbox.isPending && !error) return null;
  const enforced = inbox.data?.team?.enforceAutoReview ?? false;
  const rulesOff = inbox.data?.team?.customRulesEnabled === false;
  const everyBot = (inbox.data?.rules ?? []).filter(
    (rule) => rule.botId === "*",
  );
  /*
   * Rules that name no Bot this person can open — a Bot since deleted, or a name typed where an id
   * belonged. They are still enforced, so they are listed here where they can be removed.
   */
  const reachable = [...(agents.data ?? []), ...(hiddenAgents.data ?? [])];
  const otherBots = (inbox.data?.rules ?? []).filter(
    (rule) =>
      rule.botId !== "*" &&
      (agents.data === undefined ||
        !reachable.some((agent) => ruleCoversBot(rule.botId, agent.id))),
  );
  const teamRules = inbox.data?.teamRules ?? [];
  const canAdd = Boolean(inbox.data?.preferences) && !rulesOff;
  const saved = teamRules.length + everyBot.length;

  return (
    <>
      {error ? (
        <p className="mt-6 text-destructive text-sm" role="alert">
          {error.message}
        </p>
      ) : null}
      {me?.role === "admin" ? (
        <p className="mt-6 text-muted-foreground text-sm">
          Configurações da equipe e pedidos de contas compartilhadas estão em{" "}
          <Link className="underline underline-offset-4" to="/admin/approvals">
            Admin → Aprovações
          </Link>
          .
        </p>
      ) : null}
      <PageSection title="Antes de um Bot agir">
        <PageRows>
          <Item size="sm">
            <ItemMedia variant="icon">
              <IconHandStop />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Perguntar antes de fazer alterações</ItemTitle>
              <ItemDescription>
                Revisar alterações de um Bot em sites, apps conectados e
                arquivos.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                aria-label="Perguntar antes de fazer alterações"
                checked={inbox.data?.enabled ?? false}
                disabled={inbox.isLoading || preferences.isPending}
                onCheckedChange={(enabled) => preferences.mutate({ enabled })}
              />
            </ItemActions>
          </Item>
          {inbox.data?.preferences ? (
            <>
              <Separator />
              <Item size="sm">
                <ItemMedia variant="icon">
                  <IconEyeCheck />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle id="auto-review-title">
                    Revisão automática
                  </ItemTitle>
                  <ItemDescription
                    className="line-clamp-none"
                    id="auto-review-description"
                  >
                    {enforced ? "Um administrador exige isto. " : ""}
                    Antes de um Bot fazer algo que possa afetar suas contas ou
                    compartilhar informações, o OpenBot verifica isso com o seu
                    pedido e as suas regras. Se não tiver certeza, ele pergunta
                    a você.
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Switch
                    // Named by its title alone and described by the sentence beside it, so the name
                    // stays short however long the description grows.
                    aria-describedby="auto-review-description"
                    aria-labelledby="auto-review-title"
                    checked={enforced || inbox.data.preferences.autoReview}
                    disabled={enforced || preferences.isPending}
                    onCheckedChange={(autoReview) =>
                      preferences.mutate({ autoReview })
                    }
                  />
                </ItemActions>
              </Item>
              <Separator />
              <Item size="sm">
                <ItemMedia variant="icon">
                  <IconTerminal2 />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Comandos no seu computador</ItemTitle>
                  <ItemDescription className="line-clamp-none">
                    {inbox.data.hostCommands &&
                    inbox.data.hostCommands !==
                      inbox.data.preferences.hostCommands
                      ? `Um administrador limita isto a "${HOST_LABELS[inbox.data.hostCommands]}". `
                      : ""}
                    O app de desktop do OpenBot ainda mostra cada comando antes
                    de executá-lo.
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <LabelSelect
                    disabled={preferences.isPending}
                    label="Comandos no seu computador"
                    labels={HOST_LABELS}
                    onChange={(hostCommands) =>
                      preferences.mutate({ hostCommands })
                    }
                    value={inbox.data.preferences.hostCommands}
                  />
                </ItemActions>
              </Item>
            </>
          ) : null}
        </PageRows>
      </PageSection>
      <PageSection
        description={
          <>
            A regra correspondente mais rígida vence. Uma regra "perguntar"
            vence uma regra "permitir". As regras da equipe são bloqueadas.
            Senhas, configurações de segurança e pagamentos sempre ficam com
            você. As regras de um Bot ficam na{" "}
            <Link className="underline underline-offset-4" to="/bots">
              página desse Bot
            </Link>
            .
            {rulesOff
              ? " Um administrador desativou as regras pessoais. As suas ficam guardadas, mas não valem."
              : ""}
          </>
        }
        title="Regras para todos os Bots"
      >
        {saved === 0 ? (
          <PageEmpty icon={IconChecklist} title="Nenhuma regra ainda" />
        ) : null}
        {saved > 0 || canAdd ? (
          <PageRows>
            {teamRules.map((rule, index) => (
              <Fragment key={rule.id}>
                {index > 0 ? <Separator /> : null}
                <RuleRow
                  disabled
                  locked
                  onChange={() => {}}
                  onRevoke={() => {}}
                  rule={rule}
                  team
                />
              </Fragment>
            ))}
            {everyBot.map((rule, index) => (
              <Fragment key={rule.id}>
                {teamRules.length + index > 0 ? <Separator /> : null}
                <RuleRow
                  disabled={revoke.isPending || changeRule.isPending}
                  locked={rulesOff}
                  onChange={(behaviour) =>
                    changeRule.mutate({ id: rule.id, behaviour })
                  }
                  onRevoke={() => revoke.mutate(rule.id)}
                  rule={rule}
                />
              </Fragment>
            ))}
            {canAdd ? (
              <>
                {saved > 0 ? <Separator /> : null}
                <RuleForm
                  botField={false}
                  label="Adicionar regra"
                  save={addRule}
                />
              </>
            ) : null}
          </PageRows>
        ) : null}
      </PageSection>
      {agents.data !== undefined && otherBots.length > 0 ? (
        <PageSection
          description="Estas não correspondem a um Bot que você possa abrir. Elas ainda valem para qualquer Bot correspondente. Remova as que não quiser."
          title="Regras para outros Bots"
        >
          <PageRows>
            {otherBots.map((rule, index) => (
              <Fragment key={rule.id}>
                {index > 0 ? <Separator /> : null}
                <RuleRow
                  disabled={revoke.isPending || changeRule.isPending}
                  locked={rulesOff}
                  onChange={(behaviour) =>
                    changeRule.mutate({ id: rule.id, behaviour })
                  }
                  onRevoke={() => revoke.mutate(rule.id)}
                  rule={rule}
                />
              </Fragment>
            ))}
          </PageRows>
        </PageSection>
      ) : null}
    </>
  );
}
