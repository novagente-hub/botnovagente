import { createFileRoute } from "@tanstack/react-router";
import { ApprovalSettings } from "@/components/approvals/settings";
import { PageShell } from "@/components/layout/page-shell";
import { TeamBotConsents } from "@/components/settings/team-bot-consents";

export const Route = createFileRoute("/_authed/settings/approvals")({
  component: ApprovalsSettingsPage,
});

function ApprovalsSettingsPage() {
  return (
    <PageShell
      description="Escolha quando seus Bots perguntam antes de alterar algo. As regras aqui valem para todos eles."
      title="Aprovações"
    >
      <ApprovalSettings />
      <TeamBotConsents />
    </PageShell>
  );
}
