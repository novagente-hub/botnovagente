import {
  IconChevronRight,
  IconListSearch,
  IconPlus,
  IconShieldX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PageEmpty,
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { StaggerItem } from "@/components/layout/stagger";
import { Button } from "@/components/ui/button";
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
import { ruleLabel } from "@/lib/boundaries/rules";
import { saveActionPolicyMutationOptions } from "@/lib/computers/mutations";
import { actionPolicyQueryOptions } from "@/lib/computers/queries";

export const Route = createFileRoute("/_authed/admin/boundaries")({
  component: BoundariesPage,
});

const DESCRIPTION =
  "Defina ações que os Bots nunca podem fazer. O OpenBot verifica estas regras antes de um Bot agir no computador dele ou em um app conectado.";

/**
 * The deployment's boundaries, read as a list of things Bots may never do.
 *
 * It used to be one screen that was also the editor: the rule language explained in a paragraph of
 * attribute names, rules shown as raw CEL, and ready-made rules drawn as buttons. Nobody could tell
 * from it what the page was for. Now each rule is a row with a name, adding one is its own screen
 * (`boundaries_.new.tsx`) and a rule opens to what it has stopped (`boundaries_.$index.tsx`).
 */
function BoundariesPage() {
  const queryClient = useQueryClient();
  const stored = useQuery(actionPolicyQueryOptions());
  const savePolicy = useMutation(saveActionPolicyMutationOptions(queryClient));
  /* What the server stored wins once a save lands: it normalises what it keeps. */
  const policy = savePolicy.data ?? stored.data ?? null;

  const addRule = (
    <Button
      render={(props) => <Link {...props} to="/admin/boundaries/new" />}
      size="sm"
      variant="ghost"
    >
      <IconPlus />
      Adicionar regra
    </Button>
  );

  if (!policy) {
    return (
      <PageShell description={DESCRIPTION} title="Limites">
        {/* Nothing until the policy is known: a rule list that guesses is worse than a blank. */}
        {stored.error ? (
          <p className="text-destructive text-sm" role="alert">
            {stored.error.message}
          </p>
        ) : null}
      </PageShell>
    );
  }

  const trial = policy.mode === "dry-run";
  const allowsEverythingElse =
    policy.allow.length === 1 && policy.allow[0] === "true";

  return (
    <PageShell action={addRule} description={DESCRIPTION} title="Limites">
      <PageSection title="Os Bots nunca podem">
        {policy.deny.length === 0 ? (
          <PageEmpty
            action={
              <Button
                render={(props) => (
                  <Link {...props} to="/admin/boundaries/new" />
                )}
                size="sm"
                variant="outline"
              >
                <IconPlus />
                Adicionar regra
              </Button>
            }
            icon={IconShieldX}
            title="Nenhuma regra ainda"
          >
            Os Bots podem fazer tudo o que as próprias permissões permitem.
          </PageEmpty>
        ) : (
          <PageRows>
            {policy.deny.map((rule, index) => {
              const label = ruleLabel(policy, rule);
              return (
                <StaggerItem index={index} key={rule}>
                  <Item
                    render={(props) => (
                      <Link
                        {...props}
                        params={{ index: String(index) }}
                        to="/admin/boundaries/$index"
                      />
                    )}
                    size="sm"
                  >
                    <ItemMedia variant="icon">
                      <IconShieldX />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle>{label.name}</ItemTitle>
                      {label.description ? (
                        <ItemDescription>{label.description}</ItemDescription>
                      ) : (
                        // A rule nobody named is still told apart from the next by what it says.
                        <ItemDescription className="line-clamp-1 font-mono">
                          {rule}
                        </ItemDescription>
                      )}
                    </ItemContent>
                    <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Item>
                  {index !== policy.deny.length - 1 && <Separator />}
                </StaggerItem>
              );
            })}
          </PageRows>
        )}
      </PageSection>

      <PageSection title="Como as regras se aplicam">
        <PageRows>
          <Item size="sm">
            <ItemContent>
              <ItemTitle>Modo de teste</ItemTitle>
              <ItemDescription>
                {trial
                  ? "Ativado. Uma ação correspondente segue adiante e é registrada em Auditoria, para você ver o que uma regra pega antes que ela impeça algo."
                  : "Desativado. Uma ação correspondente é impedida, e o Bot fica sabendo qual regra a impediu."}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                aria-label="Modo de teste"
                checked={trial}
                disabled={savePolicy.isPending}
                onCheckedChange={(checked) =>
                  savePolicy.mutate({
                    ...policy,
                    mode: checked ? "dry-run" : "enforce",
                  })
                }
              />
            </ItemActions>
          </Item>
          <Separator />
          <Item
            render={(props) => <Link {...props} to="/admin/audit" />}
            size="sm"
          >
            <ItemMedia variant="icon">
              <IconListSearch />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Ações impedidas</ItemTitle>
              <ItemDescription>
                Em Auditoria, escolha Bloqueado para ver cada ação que uma regra
                impediu e qual regra foi.
              </ItemDescription>
            </ItemContent>
            <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Item>
          <Separator />
          {/*
           * Read-only, and only interesting when it is not the default. Allow rules are checked after
           * the list above and an empty list refuses everything, so a deployment that narrowed them
           * in configuration needs to see that here rather than wonder why every action is refused.
           */}
          <Item size="sm">
            <ItemContent className="min-w-0">
              <ItemTitle>Todo o resto</ItemTitle>
              <ItemDescription
                className={allowsEverythingElse ? undefined : "font-mono"}
              >
                {allowsEverythingElse
                  ? "Permitido. Um Bot pode fazer qualquer coisa que nenhuma regra acima impeça, dentro das próprias permissões."
                  : policy.allow.length === 0
                    ? "Nada mais é permitido. Todas as ações são recusadas."
                    : `Only what these allow: ${policy.allow.join(" · ")}`}
              </ItemDescription>
            </ItemContent>
          </Item>
        </PageRows>
        {savePolicy.error ? (
          <p className="mt-3 text-destructive text-sm" role="alert">
            {savePolicy.error.message}
          </p>
        ) : null}
      </PageSection>
    </PageShell>
  );
}
