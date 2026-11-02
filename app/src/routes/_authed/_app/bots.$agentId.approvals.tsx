import { createFileRoute } from "@tanstack/react-router";
import { BotApprovalRules } from "@/components/approvals/bot-rules";
import { BotSubpage } from "@/components/bot-profile/bot-subpage";

export const Route = createFileRoute("/_authed/_app/bots/$agentId/approvals")({
  component: ApprovalRulesPage,
});

function ApprovalRulesPage() {
  const { agentId } = Route.useParams();
  return (
    <BotSubpage
      agentId={agentId}
      description="Escolha quais ações este Bot pode fazer sem sua aprovação."
      title="Regras de aprovação"
    >
      {(agent) => <BotApprovalRules agentId={agent.id} />}
    </BotSubpage>
  );
}
