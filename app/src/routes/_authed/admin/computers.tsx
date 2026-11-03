import {
  IconAlertTriangle,
  IconDeviceDesktop,
  IconRobot,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  PageEmpty,
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { StaggerItem } from "@/components/layout/stagger";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { useBotNames } from "@/lib/agents/bot-names";
import { agentListQueryOptions } from "@/lib/agents/queries";
import {
  type HostAccessPendingOperation,
  type HostFolderGrant,
  hostAccessQueryOptions,
  requestHostFolderGrantMutationOptions,
  revokeHostFolderGrantMutationOptions,
  stopHostAccessMutationOptions,
} from "@/lib/computers/host-access";
import { setComputerStateMutationOptions } from "@/lib/computers/mutations";
import {
  type ComputerProfile,
  computerFleetQueryOptions,
} from "@/lib/computers/queries";

export const Route = createFileRoute("/_authed/admin/computers")({
  component: ComputersPage,
});

/** One row's identity: the computer, and on a shared computer the Bot's seat on it. */
function rowId(computer: ComputerProfile): string {
  return `${computer.computer}|${computer.botId ?? ""}`;
}

function ComputersPage() {
  /** The row currently running a stop/reset request. */
  const [busy, setBusy] = useState<string | null>(null);
  /** Reset deletes the browser profiles, so it requires confirmation. */
  const [confirming, setConfirming] = useState<ComputerProfile | null>(null);
  /** Updating restarts a running computer mid-task, so it is confirmed too. */
  const [confirmingUpdate, setConfirmingUpdate] =
    useState<ComputerProfile | null>(null);
  const queryClient = useQueryClient();
  const nameFor = useBotNames();

  const fleet = useQuery(computerFleetQueryOptions());
  const hostAccess = useQuery(hostAccessQueryOptions());
  const agents = useQuery(agentListQueryOptions());
  const setState = useMutation(setComputerStateMutationOptions(queryClient));
  const requestGrant = useMutation(
    requestHostFolderGrantMutationOptions(queryClient),
  );
  const revokeGrant = useMutation(
    revokeHostFolderGrantMutationOptions(queryClient),
  );
  const stopHostAccess = useMutation(
    stopHostAccessMutationOptions(queryClient),
  );

  const computers = fleet.data?.computers ?? null;
  const isolation = fleet.data?.isolation ?? null;
  /*
   * A list that could not be read. A refused stop, reset or update is said beside the buttons
   * instead, because the top of this page is a long scroll away from them.
   */
  const problem = fleet.error
    ? "Não foi possível carregar os computadores. Recarregue a página."
    : null;
  const hostProblem = hostAccess.error
    ? hostAccess.error.message
    : requestGrant.error
      ? requestGrant.error.message
      : revokeGrant.error
        ? revokeGrant.error.message
        : stopHostAccess.error
          ? stopHostAccess.error.message
          : null;

  const run = (
    computer: ComputerProfile,
    action: "stop" | "reset" | "update",
  ) => {
    setBusy(rowId(computer));
    setConfirming(null);
    setConfirmingUpdate(null);
    setState.mutate(
      {
        action,
        computer: computer.computer,
        ...(computer.botId ? { botId: computer.botId } : {}),
      },
      { onSettled: () => setBusy(null) },
    );
  };

  /**
   * Whose computer a row is, in the words the rest of Admin uses.
   *
   * A person's computer is named for the person. An isolated Bot's is named for the Bot. On a shared
   * computer a row is one person's seat on one Bot, so it names both.
   */
  const titleOf = (computer: ComputerProfile): string => {
    const person =
      computer.person?.name ?? computer.person?.email ?? computer.personId;
    if (computer.kind === "person") {
      return computer.botId
        ? `${person} · ${nameFor(computer.botId)}`
        : `${person}'s computer`;
    }
    return nameFor(computer.botId ?? computer.computer);
  };

  /** What a row carries, said once before its state. */
  const scopeOf = (computer: ComputerProfile): string => {
    if (computer.kind === "person") {
      return computer.botId
        ? "O perfil e a pasta desta pessoa para este Bot"
        : "Executa todos os Bots que esta pessoa usa";
    }
    return isolation === "shared"
      ? "O perfil deste Bot de antes de cada pessoa ter o seu"
      : "Isolado: um computador próprio, compartilhado por todos que o usam";
  };

  return (
    <PageShell
      description="O computador de cada pessoa, e o de cada Bot isolado. Cada Bot mantém nele o próprio perfil de navegador, o que mantém o login desse Bot. Redefinir um computador desconecta todos os Bots dele de tudo."
      title="Computadores"
    >
      {problem ? (
        <p
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
          role="alert"
        >
          {problem}
        </p>
      ) : null}

      {isolation === "shared" ? (
        <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <span className="font-medium">
            Os Bots de cada pessoa rodam em um computador.
          </span>{" "}
          Cada pessoa mantém o próprio perfil de navegador e pasta para cada
          Bot, então os logins não são compartilhados. Um comando executado por
          um Bot ainda pode ler os arquivos de outro. Defina{" "}
          <code>COMPUTER_SUPERVISOR_URL</code> para dar a cada pessoa um
          computador próprio.
        </p>
      ) : isolation === "per-person" ? (
        <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
          Cada pessoa tem o próprio computador, e todos os Bots que ela usa
          rodam nele, incluindo Bots públicos feitos por outras pessoas. Cada
          Bot mantém ali o próprio perfil de navegador e pasta, mas um comando
          executado por um Bot pode acessar qualquer outra coisa no computador
          dessa pessoa. Um Bot isolado tem um computador próprio.
        </p>
      ) : null}

      <HostFoldersSection
        connected={hostAccess.data?.connected ?? false}
        grants={hostAccess.data?.grants ?? []}
        botIds={(agents.data ?? []).map((agent) => agent.id)}
        loading={hostAccess.isPending || agents.isPending}
        nameFor={nameFor}
        onGrant={(botId) => requestGrant.mutate({ botId })}
        onRevoke={(grantId) => revokeGrant.mutate({ grantId })}
        onStop={() => stopHostAccess.mutate()}
        pending={hostAccess.data?.pending ?? []}
        problem={hostProblem}
        requestingBotId={
          requestGrant.isPending
            ? (requestGrant.variables?.botId ?? null)
            : null
        }
        revokingGrantId={
          revokeGrant.isPending
            ? (revokeGrant.variables?.grantId ?? null)
            : null
        }
        stopping={stopHostAccess.isPending}
      />

      <PageSection title="Computadores nesta implantação">
        {setState.error ? (
          <p
            className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
            role="alert"
          >
            {setState.error.message}
          </p>
        ) : null}
        {computers === null && problem ? (
          <PageEmpty
            icon={IconAlertTriangle}
            title="Não foi possível carregar a lista"
          />
        ) : computers === null ? null : computers.length === 0 ? (
          <PageEmpty icon={IconDeviceDesktop} title="Nenhum computador ainda">
            Um aparece na primeira vez que um Bot abre uma página.
          </PageEmpty>
        ) : (
          <PageRows>
            {computers.map((computer, index) => (
              <StaggerItem index={index} key={rowId(computer)}>
                <Item size="sm">
                  <ItemContent>
                    <ItemTitle title={computer.computer}>
                      {titleOf(computer)}
                    </ItemTitle>
                    <ItemDescription>
                      {scopeOf(computer)}
                      {" · "}
                      {computer.running
                        ? `Browser running since ${new Date(computer.startedAt ?? "").toLocaleTimeString()}`
                        : "Nenhum navegador em execução. Ele liga quando o Bot precisar."}
                      {" · "}
                      {computer.egress === undefined
                        ? "Saída de rede não informada"
                        : computer.egress === null
                          ? "Sai diretamente"
                          : `Leaves through ${computer.egress}`}
                      {computer.updateAvailable
                        ? " · Atualização disponível"
                        : ""}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {computer.updateAvailable ? (
                      <Button
                        disabled={busy === rowId(computer)}
                        onClick={() => setConfirmingUpdate(computer)}
                        size="sm"
                        variant="outline"
                      >
                        Atualizar computador
                      </Button>
                    ) : null}
                    <Button
                      disabled={busy === rowId(computer) || !computer.running}
                      onClick={() => void run(computer, "stop")}
                      size="sm"
                      variant="outline"
                    >
                      {busy === rowId(computer)
                        ? "Processando…"
                        : "Parar navegador"}
                    </Button>
                    <Button
                      disabled={busy === rowId(computer)}
                      onClick={() => setConfirming(computer)}
                      size="sm"
                      variant="outline"
                    >
                      Redefinir
                    </Button>
                  </ItemActions>
                </Item>
                {index !== computers.length - 1 && <Separator />}
              </StaggerItem>
            ))}
          </PageRows>
        )}
      </PageSection>

      {/*
       * A DIALOG RATHER THAN AN INLINE CONFIRM. Resetting signs a Bot out of everything it has ever
       * logged into and cannot be undone, and the row it was confirmed on was one of several
       * identical-looking rows. The dialog names whose computer it is, so the sentence somebody
       * agrees to says which computer it destroys.
       */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        open={confirming !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Redefinir {confirming ? titleOf(confirming) : ""}?
            </DialogTitle>
            <DialogDescription>
              {confirming?.kind === "person" && !confirming.botId
                ? "O perfil de todos os Bots no computador desta pessoa é excluído. Cada um é desconectado de todos os serviços e começa do zero."
                : "O perfil é excluído. O Bot é desconectado de todos os serviços e começa do zero."}{" "}
              Não é possível desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setConfirming(null)}
              size="sm"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              disabled={confirming !== null && busy === rowId(confirming)}
              onClick={() => {
                if (confirming) void run(confirming, "reset");
              }}
              size="sm"
              variant="destructive"
            >
              {confirming !== null && busy === rowId(confirming)
                ? "Redefinindo…"
                : "Redefinir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setConfirmingUpdate(null);
        }}
        open={confirmingUpdate !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Atualizar {confirmingUpdate ? titleOf(confirmingUpdate) : ""}?
            </DialogTitle>
            <DialogDescription>
              Ele passa para a imagem de computador que esta implantação usa
              agora. Os arquivos e logins são mantidos. Se estiver em execução,
              ele reinicia e para o que estiver fazendo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setConfirmingUpdate(null)}
              size="sm"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              disabled={
                confirmingUpdate !== null && busy === rowId(confirmingUpdate)
              }
              onClick={() => {
                if (confirmingUpdate) void run(confirmingUpdate, "update");
              }}
              size="sm"
            >
              {confirmingUpdate !== null && busy === rowId(confirmingUpdate)
                ? "Atualizando…"
                : "Atualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mt-4 text-muted-foreground text-sm">
        <strong>Parar</strong> fecha os navegadores do computador e mantém os
        logins. Ele liga de novo na próxima vez que um Bot precisar.{" "}
        <strong>Redefinir</strong> exclui os perfis e desconecta todos os Bots
        dele de tudo. <strong>Atualizar computador</strong> aparece quando um
        computador usa uma imagem antiga. Ele passa o computador para a nova e
        mantém os arquivos e logins. Os três aparecem em{" "}
        <Link className="underline" to="/admin/audit">
          Auditoria
        </Link>
        .
      </p>
    </PageShell>
  );
}

type HostFoldersSectionProps = {
  botIds: string[];
  connected: boolean;
  grants: HostFolderGrant[];
  loading: boolean;
  nameFor: (botId: string) => string;
  onGrant: (botId: string) => void;
  onRevoke: (grantId: string) => void;
  onStop: () => void;
  pending: HostAccessPendingOperation[];
  problem: string | null;
  requestingBotId: string | null;
  revokingGrantId: string | null;
  stopping: boolean;
};

function HostFoldersSection({
  botIds: knownBotIds,
  connected,
  grants,
  loading,
  nameFor,
  onGrant,
  onRevoke,
  onStop,
  pending,
  problem,
  requestingBotId,
  revokingGrantId,
  stopping,
}: HostFoldersSectionProps) {
  const botIds = Array.from(
    new Set([
      ...knownBotIds,
      ...grants.map((grant) => grant.botId),
      ...pending.map((one) => one.botId),
    ]),
  ).sort((left, right) => nameFor(left).localeCompare(nameFor(right)));

  return (
    <PageSection
      description="Escolha pastas que um Bot pode ler neste computador. O app de desktop pergunta antes de cada edição ou comando. O acesso termina quando você fecha o OpenBot."
      title="Pastas neste computador"
    >
      {problem ? (
        <p
          className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
          role="alert"
        >
          {problem}
        </p>
      ) : null}

      {!connected && !loading ? (
        <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          O app de desktop está offline. Abra-o para aprovar pastas ou executar
          comandos.
        </p>
      ) : null}

      {loading ? null : botIds.length === 0 ? (
        <PageEmpty icon={IconRobot} title="Nenhum Bot ainda">
          Crie um e depois escolha as pastas dele.
        </PageEmpty>
      ) : (
        <PageRows>
          {botIds.map((botId, index) => (
            <StaggerItem index={index} key={botId}>
              <Item size="sm">
                <ItemContent>
                  <ItemTitle title={botId}>{nameFor(botId)}</ItemTitle>
                  <ItemDescription>
                    {summaryFor(botId, grants, pending)}
                  </ItemDescription>
                  <FolderGrantList
                    botId={botId}
                    grants={grants}
                    onRevoke={onRevoke}
                    pending={pending}
                    revokingGrantId={revokingGrantId}
                  />
                </ItemContent>
                <ItemActions>
                  <Button
                    disabled={!connected || requestingBotId === botId}
                    onClick={() => onGrant(botId)}
                    size="sm"
                    variant="outline"
                  >
                    {requestingBotId === botId
                      ? "Aguardando…"
                      : "Escolher pasta"}
                  </Button>
                </ItemActions>
              </Item>
              {index !== botIds.length - 1 && <Separator />}
            </StaggerItem>
          ))}
        </PageRows>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-sm">
        <p>
          As pastas são somente leitura. Quando um Bot precisa gravar, o app de
          desktop pergunta a você antes.
        </p>
        <div className="flex items-center gap-3">
          <Button
            disabled={!connected || stopping}
            onClick={onStop}
            size="sm"
            variant="outline"
          >
            {stopping ? "Parando…" : "Interromper acesso à pasta"}
          </Button>
          <Link className="underline" to="/admin/audit">
            Ver auditoria
          </Link>
        </div>
      </div>
    </PageSection>
  );
}

function FolderGrantList({
  botId,
  grants,
  onRevoke,
  pending,
  revokingGrantId,
}: {
  botId: string;
  grants: HostFolderGrant[];
  onRevoke: (grantId: string) => void;
  pending: HostAccessPendingOperation[];
  revokingGrantId: string | null;
}) {
  const botGrants = grants.filter(
    (grant) => grant.botId === botId && !grant.revoked,
  );
  const botPending = pending.filter((request) => request.botId === botId);

  if (botGrants.length === 0 && botPending.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {botGrants.map((grant) => (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
          key={grant.id}
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-sm">{grant.displayName}</p>
            <p className="text-muted-foreground text-xs">
              {ownerLabel(grant)} · Somente leitura
            </p>
          </div>
          <Button
            disabled={revokingGrantId === grant.id}
            onClick={() => onRevoke(grant.id)}
            size="sm"
            variant="ghost"
          >
            {revokingGrantId === grant.id ? "Revogando…" : "Revogar"}
          </Button>
        </div>
      ))}
      {botPending.map((request) => (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
          key={request.operationId}
        >
          {pendingLabel(request)} de {ownerLabel(request)}
          {request.displayName ? ` for ${request.displayName}` : ""}.
        </div>
      ))}
    </div>
  );
}

function summaryFor(
  botId: string,
  grants: HostFolderGrant[],
  pending: HostAccessPendingOperation[],
) {
  const active = grants.filter(
    (grant) => grant.botId === botId && !grant.revoked,
  ).length;
  const waiting = pending.filter((request) => request.botId === botId).length;
  const parts = [];
  if (active > 0)
    parts.push(
      `${active} ${active === 1 ? "pasta somente leitura" : "pastas somente leitura"}`,
    );
  if (waiting > 0)
    parts.push(
      `${waiting} ${waiting === 1 ? "solicitação pendente" : "solicitações pendentes"}`,
    );
  return parts.length > 0 ? parts.join(" · ") : "Nenhuma pasta aprovada.";
}

function ownerLabel(grant: { ownerName?: string; ownerEmail?: string }) {
  return grant.ownerName ?? grant.ownerEmail ?? "o dono do desktop";
}

function pendingLabel(request: HostAccessPendingOperation) {
  switch (request.kind) {
    case "write_file":
      return "Alteração de arquivo aguardando aprovação ou conclusão";
    case "run_command":
      return "Comando aguardando aprovação ou conclusão";
    case "list_files":
      return "Listando arquivos";
    case "read_file":
      return "Lendo um arquivo";
    case "cancel":
    case "stop":
      return "Parando o trabalho na pasta";
    default:
      return "Acesso à pasta aguardando aprovação";
  }
}
