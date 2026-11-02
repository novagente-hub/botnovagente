import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/page-shell";
import { NativeDevices, RecentDeliveries } from "@/components/settings/devices";
import { UpdateRoutingSection } from "@/components/settings/update-routing";

export const Route = createFileRoute("/_authed/settings/notifications")({
  component: NotificationsPage,
});

/** Where your Bots' updates reach you, for all of your Bots at once. Each Bot's own page says how much. */
function NotificationsPage() {
  return (
    <PageShell
      description="Escolha onde receber atualizações quando estiver fora. Defina a frequência de atualizações de cada Bot na página dele."
      title="Notificações"
    >
      <UpdateRoutingSection />
      <NativeDevices />
      <RecentDeliveries />
    </PageShell>
  );
}
