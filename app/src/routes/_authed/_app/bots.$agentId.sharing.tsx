import { createFileRoute } from "@tanstack/react-router";
import { BotSubpage } from "@/components/bot-profile/bot-subpage";
import { SharingSections } from "@/components/bot-profile/sharing";

export const Route = createFileRoute("/_authed/_app/bots/$agentId/sharing")({
  component: SharingPage,
});

function SharingPage() {
  const { agentId } = Route.useParams();
  return (
    <BotSubpage
      agentId={agentId}
      description="Escolha quem pode usar este Bot. As conversas de cada pessoa com ele são privadas."
      title="Compartilhamento"
    >
      {(agent) => <SharingSections agent={agent} />}
    </BotSubpage>
  );
}
