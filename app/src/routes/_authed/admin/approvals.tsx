import { createFileRoute } from "@tanstack/react-router";
import { TeamApprovalSettings } from "@/components/approvals/team-settings";
import { PageShell } from "@/components/layout/page-shell";

export const Route = createFileRoute("/_authed/admin/approvals")({
  component: AdminApprovalsPage,
});

function AdminApprovalsPage() {
  return (
    <PageShell
      description="Defina regras de aprovação para os Bots dos membros e revise pedidos de uso de contas compartilhadas."
      title="Aprovações"
    >
      <TeamApprovalSettings />
    </PageShell>
  );
}
