import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageRows, PageSection } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { consentCopy } from "@/lib/plugins/enablement-notes";
import {
  authorizeActionMutationOptions,
  consentActionsFrom,
  couldNotRead,
  type GrantGroup,
  type GrantState,
  grantsQueryOptions,
  groupGrants,
  RANK,
} from "@/lib/plugins/grants";

/**
 * What one account holds at one app, action by action, grouped by the permission each action needs.
 *
 * ONE ROW PER ACTION, DRAWN FROM ITS `GrantState` AND NOTHING ELSE. Authorize is offered for
 * `needs-consent` only: a `needs-operator` action is blocked by a deployment secret that no amount
 * of consenting moves, and an `unknown` one offers a Retry, because not knowing is not the same as
 * not connected and telling somebody to authorize what they already authorized sends them round
 * twice.
 *
 * NO ORDERING BY "RECENTLY REFUSED". Authorized actions come first, then the unauthorized ones in
 * state order, and only the tail beyond `UNAUTHORIZED_SHOWN` sits behind the search; there is no
 * per-person, per-app refusal read on any route this page can call, and inventing a column to order
 * on would be a claim this page could not back.
 */

/** How many unauthorized actions are drawn before the rest are left to the search. */
const UNAUTHORIZED_SHOWN = 10;

export function GrantList({
  serverId,
  appNames,
  canAuthorize,
  landedAction,
  returnTo,
}: {
  serverId: string;
  /** Every name this app goes by, so the route's synthetic toolkit-named entry is recognised. */
  appNames: readonly string[];
  /** Whether this viewer may mint a consent. State is shown to everyone; minting is not. */
  canAuthorize: boolean;
  landedAction: string | null;
  returnTo: "settings" | "admin";
}) {
  const grants = useQuery(grantsQueryOptions(serverId, true));
  const [search, setSearch] = useState("");
  const [choosing, setChoosing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const authorize = useMutation({
    ...authorizeActionMutationOptions(returnTo),
    onError: (thrown: Error) => setNotice(thrown.message),
    /* A full page navigation: the consent screen is the vendor's own and shown in this browser. */
    onSuccess: (authorizationUrl) => {
      if (authorizationUrl === null) {
        setNotice(
          "O OpenBot respondeu sem um link de consentimento, então nada foi autorizado. Tente novamente ou fale com um administrador se continuar acontecendo.",
        );
        return;
      }
      window.location.href = authorizationUrl;
    },
  });

  if (grants.isPending) return null;
  if (grants.error) {
    return (
      <PageSection title="Ações">
        <p className="text-destructive text-sm" role="alert">
          
          Não foi possível ler o que esta conta permite agora.{" "}
          <Button
            onClick={() => grants.refetch()}
            size="sm"
            type="button"
            variant="outline"
          >
            
            Tentar de novo
          </Button>
        </p>
      </PageSection>
    );
  }

  const all = grants.data ?? [];
  if (couldNotRead(all, appNames)) {
    const [only] = all;
    return (
      <PageSection title="Ações">
        {/* Not an action: the entry's label is the toolkit's own name, which a person must not
            see in their grant list as if it were one. */}
        <p data-could-not-read="" role="status" className="text-sm">
          
          Não foi possível ler o que esta conta permite agora.
          {only?.state === "unknown" ? ` ${only.reason}` : null}{" "}
          <Button
            onClick={() => grants.refetch()}
            size="sm"
            type="button"
            variant="outline"
          >
            
            Tentar de novo
          </Button>
        </p>
      </PageSection>
    );
  }

  const term = search.trim().toLowerCase();
  const unauthorized = all
    .filter((grant) => grant.state !== "authorized")
    .sort(
      (left, right) =>
        RANK[left.state] - RANK[right.state] ||
        left.action.localeCompare(right.action),
    );
  /* With no search term the first unauthorized actions are drawn as well: an Authorize that only
     appears once somebody guesses a substring is an Authorize nobody on a fresh account can reach,
     and a fresh account is every first visit. Beyond those, the count below still stands. */
  const shown =
    term.length > 0
      ? all.filter((grant) => grant.action.toLowerCase().includes(term))
      : [
          ...all.filter((grant) => grant.state === "authorized"),
          ...unauthorized.slice(0, UNAUTHORIZED_SHOWN),
        ];
  const hidden =
    term.length > 0 ? 0 : Math.max(unauthorized.length - UNAUTHORIZED_SHOWN, 0);
  const groups: GrantGroup[] = groupGrants(shown);
  const consentActions = consentActionsFrom(all);

  return (
    <PageSection
      description="Agrupadas pela permissão que cada ação pede. Corresponde ao que a tela de consentimento mostra."
      title="Ações"
    >
      {notice ? (
        <p className="text-destructive text-sm" role="alert">
          {notice}
        </p>
      ) : null}
      <Input
        aria-label="Pesquisar ações"
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Pesquisar ações"
        type="search"
        value={search}
      />
      {groups.map((group) => (
        <div
          data-grant-group={
            group.kind === "scoped" ? group.scopes.join(", ") : group.kind
          }
          key={group.scopes.join("\u0000") || group.kind}
        >
          <p className="mb-1 text-muted-foreground text-xs">
            {group.kind === "whole-app"
              ? "Tudo neste app, aprovado em conjunto"
              : group.kind === "none"
                ? "Não pede nenhuma permissão própria"
                : `Needs ${group.scopes.join(", ")}`}
          </p>
          <PageRows>
            {group.grants.map((grant) => (
              <Item
                data-action={grant.action}
                data-landed={grant.action === landedAction ? "" : undefined}
                data-state={grant.state}
                key={grant.action}
                size="sm"
              >
                <ItemContent>
                  <ItemTitle>{grant.action}</ItemTitle>
                  <ItemDescription className="line-clamp-none">
                    {describe(grant, canAuthorize)}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {grant.state === "needs-consent" && canAuthorize ? (
                    <Button
                      onClick={() => {
                        setNotice(null);
                        setChoosing(grant.action);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      
                      Autorizar
                    </Button>
                  ) : null}
                  {grant.state === "unknown" ? (
                    <Button
                      onClick={() => grants.refetch()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      
                      Tentar de novo
                    </Button>
                  ) : null}
                </ItemActions>
              </Item>
            ))}
          </PageRows>
        </div>
      ))}
      {hidden > 0 ? (
        <p className="text-muted-foreground text-sm">
          Mais {hidden} {hidden === 1 ? "ação ainda não autorizada" : "ações ainda não autorizadas"}. Pesquise para encontrar.
        </p>
      ) : null}
      {term.length > 0 && groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          
          Nenhuma ação corresponde a essa busca.
        </p>
      ) : null}
      {choosing !== null ? (
        <ConsentNotice
          action={choosing}
          busy={authorize.isPending}
          onCancel={() => setChoosing(null)}
          onContinue={() => authorize.mutate({ serverId, action: choosing })}
          sentence={consentCopy(choosing, consentActions).sentence}
        />
      ) : null}
    </PageSection>
  );
}

/**
 * What somebody reads immediately before being sent to a consent screen. The sentence is
 * `consentCopy`'s and is rendered as it came, never reworded here.
 */
function ConsentNotice({
  action,
  busy,
  sentence,
  onCancel,
  onContinue,
}: {
  action: string;
  busy: boolean;
  sentence: string;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <fieldset
      aria-label={`Antes de autorizar ${action}`}
      className="m-0 flex min-w-0 flex-col gap-2 rounded-lg border p-3"
      data-consent-copy=""
    >
      <p className="text-sm">{sentence}</p>
      <div className="flex gap-2">
        <Button
          disabled={busy}
          onClick={onContinue}
          size="sm"
          type="button"
          variant="outline"
        >
          
          Continuar para o consentimento
        </Button>
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          
          Cancelar
        </Button>
      </div>
    </fieldset>
  );
}

function describe(grant: GrantState, canAuthorize: boolean): string {
  switch (grant.state) {
    case "authorized":
      // Nobody authorized an action that needs no authorization, so the row does not say they did.
      return grant.authorization === "not-required"
        ? "Não precisa de autorização."
        : "Authorized.";
    case "needs-consent":
      return canAuthorize
        ? "Ainda não autorizado."
        : "Ainda não autorizado. Um administrador pode autorizar.";
    case "needs-operator":
      return grant.missing.length > 0
        ? `Falta ${grant.missing.join(", ")}. Um administrador precisa definir. Autorizar não resolve.`
        : "Falta uma configuração. Um administrador precisa definir. Autorizar não resolve.";
    case "unknown":
      return `Não foi possível ler esta agora. ${grant.reason}`;
  }
}
