import { createFileRoute } from "@tanstack/react-router";
import { BotActivitySections } from "@/components/bot-profile/activity";
import { BotSubpage } from "@/components/bot-profile/bot-subpage";

export const Route = createFileRoute("/_authed/_app/bots/$agentId/activity")({
  component: ActivityPage,
});

/**
 * Everything this Bot is doing, has lined up and has finished, on a page of its own. On the Bot's
 * own page the three lists ran on for screens and pushed its settings out of reach; there, one row
 * counts them and opens this.
 */
function ActivityPage() {
  const { agentId } = Route.useParams();
  return (
    <BotSubpage
      agentId={agentId}
      description="Revise o trabalho atual deste Bot, as tarefas agendadas e as concluídas."
      title="Atividade"
    >
      {(agent) => <BotActivitySections agentId={agent.id} />}
    </BotSubpage>
  );
}
