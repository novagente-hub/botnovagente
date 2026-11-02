import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/page-shell";
import { BrowserSections } from "@/components/settings/browsers/browser-sections";

export const Route = createFileRoute("/_authed/settings/browsers")({
  component: BrowsersPage,
});

/** Connect the OpenBot Recorder in this browser, and see or disconnect every browser connected as you. */
function BrowsersPage() {
  return (
    <PageShell
      title="Navegadores"
      description="Conecte o OpenBot Recorder neste navegador para ensinar seus Bots fazendo uma tarefa você mesmo. O que você grava vai para o seu próprio espaço de Aprendizado."
    >
      <BrowserSections />
    </PageShell>
  );
}
