import { createFileRoute, Link } from "@tanstack/react-router";
import { BotSubpage } from "@/components/bot-profile/bot-subpage";
import { MemorySources } from "@/components/memory/sources";
import { ProactiveResearchSettings } from "@/components/suggestions/proactive-panel";

export const Route = createFileRoute("/_authed/_app/bots/$agentId/memory")({
  component: MemoryPage,
});

function MemoryPage() {
  const { agentId } = Route.useParams();
  return (
    <BotSubpage
      agentId={agentId}
      description="Escolha com quais apps este Bot aprende e gerencie a pesquisa em segundo plano dele."
      title="Memória"
    >
      {(agent) => (
        <>
          <p className="mt-6 text-muted-foreground text-sm">
            
            O que seus Bots lembram sobre você está em{" "}
            <Link
              className="underline underline-offset-4"
              to="/capabilities/memory"
            >
              
              Capacidades
            </Link>
            .
          </p>
          <MemorySources agentId={agent.id} />
          <ProactiveResearchSettings agentId={agent.id} />
        </>
      )}
    </BotSubpage>
  );
}
