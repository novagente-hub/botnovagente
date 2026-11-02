import { useMutation } from "@tanstack/react-query";
import { PageRows, PageSection } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { clearTeamBotConsentsMutationOptions } from "@/lib/team-bots";

/**
 * A Bot someone shared with you uses its owner's connected apps unless you let it use yours on the
 * card it shows you. This forgets every one of those answers, so each such Bot asks again.
 *
 * On Approvals rather than Connections because it is an answer to "may this Bot use my apps",
 * which is the question every other row on Approvals answers, not a connection of its own.
 */
export function TeamBotConsents() {
  const clear = useMutation(clearTeamBotConsentsMutationOptions());
  return (
    <PageSection
      description="Um Bot compartilhado com você usa os apps do dono. Ele só usa os seus onde você disse sim em uma conversa."
      title="Bots compartilhados"
    >
      {clear.error ? (
        <p className="mt-4 text-destructive text-sm" role="alert">
          {clear.error.message}
        </p>
      ) : null}
      <PageRows>
        <Item size="sm">
          <ItemContent>
            <ItemTitle>Apps que você permite aos Bots compartilhados</ItemTitle>
            <ItemDescription>
              {clear.isSuccess
                ? "Redefinido. Cada Bot compartilhado vai perguntar de novo."
                : "Esquecer todas as respostas, para que cada Bot compartilhado pergunte de novo."}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              disabled={clear.isPending}
              onClick={() => clear.mutate()}
              size="sm"
              variant="outline"
            >
              
              Redefinir
            </Button>
          </ItemActions>
        </Item>
      </PageRows>
    </PageSection>
  );
}
