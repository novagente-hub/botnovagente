import { createFileRoute } from "@tanstack/react-router";
import { AccessSections } from "@/components/bot-profile/access";
import { BotSubpage } from "@/components/bot-profile/bot-subpage";

export const Route = createFileRoute("/_authed/_app/bots/$agentId/access")({
  component: AccessPage,
});

function AccessPage() {
  const { agentId } = Route.useParams();
  return (
    <BotSubpage
      agentId={agentId}
      description="Gerencie as habilidades, apps e outros Bots que este Bot pode usar."
      title="Habilidades e acesso"
    >
      {(agent) => <AccessSections agent={agent} />}
    </BotSubpage>
  );
}
