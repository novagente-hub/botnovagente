import { createFileRoute } from "@tanstack/react-router";
import { BotSubpage } from "@/components/bot-profile/bot-subpage";
import { BotResponsibilities } from "@/components/responsibilities/responsibilities";

export const Route = createFileRoute(
  "/_authed/_app/bots/$agentId/responsibilities",
)({
  component: ResponsibilitiesPage,
});

function ResponsibilitiesPage() {
  const { agentId } = Route.useParams();
  return (
    <BotSubpage
      agentId={agentId}
      description="Revise os objetivos contínuos deste Bot, o que disparou cada execução e os resultados."
      title="Responsabilidades"
    >
      {(agent) => <BotResponsibilities agentId={agent.id} />}
    </BotSubpage>
  );
}
