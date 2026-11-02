import { createFileRoute } from "@tanstack/react-router";
import { CapabilitiesShell } from "@/components/capabilities/capabilities-shell";
import { MemoryList, RememberFact } from "@/components/memory/memories";

export const Route = createFileRoute("/_authed/_app/capabilities/memory")({
  component: MemoryPage,
});

function MemoryPage() {
  return (
    <CapabilitiesShell>
      <MemoryList
        action={<RememberFact />}
        description="Gerencie o que seus Bots lembram sobre você. Os fatos que você adiciona são compartilhados com todos os Bots; os fatos aprendidos ficam com o Bot que os aprendeu."
      />
    </CapabilitiesShell>
  );
}
