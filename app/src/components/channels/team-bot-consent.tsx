import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type TeamBotConsentDecision,
  teamBotConsentMutationOptions,
} from "@/lib/team-bots";

/**
 * A Team Bot asking to use this person's own account on one server, where its owner has not
 * connected one. Allow once covers the next call, Always allow covers this Bot (or every Team Bot)
 * until cleared in Team Bots, Skip leaves it using nothing of theirs. The Bot is then asked again by the person.
 */
export function TeamBotConsentCard({
  botId,
  serverId,
  message,
}: {
  botId: string;
  serverId: string;
  message: string;
}) {
  const answer = useMutation(teamBotConsentMutationOptions());
  const [chosen, setChosen] = useState<TeamBotConsentDecision | null>(null);
  const choose = (decision: TeamBotConsentDecision) =>
    answer.mutate(
      { botId, serverId, decision },
      { onSuccess: () => setChosen(decision) },
    );
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm"
      data-team-bot-consent={serverId}
    >
      <p>{message}</p>
      {chosen ? (
        <p className="text-muted-foreground" role="status">
          {chosen === "skip"
            ? "Ignorado. Nada seu foi usado."
            : chosen === "allow_once"
              ? "Permitido uma vez. Peça ao Bot para tentar de novo."
              : chosen === "allow_all_team_bots"
                ? "Sempre permitido para todos os Bots da equipe. Peça para ele tentar de novo."
                : "Sempre permitido para este Bot. Peça para ele tentar de novo."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={answer.isPending}
            onClick={() => choose("allow_once")}
            size="sm"
          >
            
            Permitir uma vez
          </Button>
          <Button
            disabled={answer.isPending}
            onClick={() => choose("allow_always")}
            size="sm"
            variant="outline"
          >
            
            Sempre permitir para este Bot
          </Button>
          <Button
            disabled={answer.isPending}
            onClick={() => choose("allow_all_team_bots")}
            size="sm"
            variant="outline"
          >
            
            Sempre permitir para todos os Bots da equipe
          </Button>
          <Button
            disabled={answer.isPending}
            onClick={() => choose("skip")}
            size="sm"
            variant="ghost"
          >
            
            Pular
          </Button>
        </div>
      )}
      {answer.error ? (
        <p className="text-destructive" role="alert">
          {answer.error.message}
        </p>
      ) : null}
    </div>
  );
}
