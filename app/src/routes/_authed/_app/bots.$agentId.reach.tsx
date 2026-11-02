import { createFileRoute } from "@tanstack/react-router";
import { BotSubpage } from "@/components/bot-profile/bot-subpage";
import { ReachingYou } from "@/components/delivery/reaching-you";

export const Route = createFileRoute("/_authed/_app/bots/$agentId/reach")({
  component: ReachPage,
});

function ReachPage() {
  const { agentId } = Route.useParams();
  return (
    <BotSubpage
      agentId={agentId}
      description="Continue uma conversa com este Bot no Slack, no Microsoft Teams ou por mensagem de texto."
      title="Como falar com você"
    >
      {(agent) => <ReachingYou agentId={agent.id} />}
    </BotSubpage>
  );
}
