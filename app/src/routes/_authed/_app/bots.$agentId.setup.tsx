import { createFileRoute } from "@tanstack/react-router";
import { BotSubpage } from "@/components/bot-profile/bot-subpage";
import { SetupSections } from "@/components/bot-profile/setup";

export const Route = createFileRoute("/_authed/_app/bots/$agentId/setup")({
  component: SetupPage,
});

function SetupPage() {
  const { agentId } = Route.useParams();
  return (
    <BotSubpage
      agentId={agentId}
      description="Edite o perfil, a visibilidade e as configurações de execução deste Bot."
      title="Configuração"
    >
      {(agent) => <SetupSections agent={agent} />}
    </BotSubpage>
  );
}
