import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/page-shell";
import { LearningSharing } from "@/components/settings/learning-sharing";

export const Route = createFileRoute("/_authed/settings/learning")({
  component: LearningSettingsPage,
});

/** Who else's Bots use the Skills learned from your own recordings. */
function LearningSettingsPage() {
  return (
    <PageShell
      title="Aprendizado"
      description="Cada gravação que você faz vai para o seu próprio espaço de Aprendizado, e as Habilidades aprendidas ali chegam a todos os Bots que você usa. Escolha os Bots de quem mais também podem usá-las."
    >
      <LearningSharing />
    </PageShell>
  );
}
