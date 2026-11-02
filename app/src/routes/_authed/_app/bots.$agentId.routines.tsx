import { createFileRoute } from "@tanstack/react-router";
import { BotSubpage } from "@/components/bot-profile/bot-subpage";
import { RoutinesList } from "@/components/routines/routines-list";

export const Route = createFileRoute("/_authed/_app/bots/$agentId/routines")({
  component: RoutinesPage,
});

function RoutinesPage() {
  const { agentId } = Route.useParams();
  return (
    <BotSubpage
      agentId={agentId}
      description="Gerencie as rotinas agendadas deste Bot. Desative uma rotina, execute agora ou exclua."
      title="Rotinas"
    >
      {(agent) => <RoutinesList agentId={agent.id} />}
    </BotSubpage>
  );
}
