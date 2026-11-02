import {
  IconChevronRight,
  IconCopy,
  IconEyeOff,
  IconPin,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageRows, PageSection } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
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
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  deleteAgentMutationOptions,
  duplicateAgentMutationOptions,
  setAgentHiddenMutationOptions,
  setAgentPinnedMutationOptions,
} from "@/lib/agents/mutations";
import type { AgentProfile } from "@/lib/agents/queries";
import { resetBotMutationOptions } from "@/lib/bot-lifecycle/mutations";
import {
  botResetPlanQueryOptions,
  type ResetPlan,
} from "@/lib/bot-lifecycle/queries";
import { queryClient } from "@/query-client";

/** Each count the notice lists, in the words the person reads, skipping the kinds with nothing. */
function resetLines(plan: ResetPlan): string[] {
  const lines: [number, string, string][] = [
    [plan.conversations, "conversa", "conversas"],
    [plan.memorySources, "fonte de memória", "fontes de memória"],
    [plan.memories, "memória importada", "memórias importadas"],
    [plan.routines, "routine", "routines"],
    [plan.responsibilities, "responsabilidade", "responsabilidades"],
    [plan.followUps, "acompanhamento agendado", "acompanhamentos agendados"],
    [plan.formedMemories, "memória que ele formou", "memórias que ele formou"],
    [plan.backgroundResearch, "pesquisa em segundo plano", "pesquisas em segundo plano"],
    [plan.standingApprovals, "standing permission", "standing permissions"],
  ];
  return lines
    .filter(([count]) => count > 0)
    .map(([count, one, many]) => `${count} ${count === 1 ? one : many}`);
}

function ResetDialog({
  agent,
  onOpenChange,
  open,
}: {
  agent: AgentProfile;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const plan = useQuery({
    ...botResetPlanQueryOptions(agent.id),
    enabled: open,
  });
  const reset = useMutation(resetBotMutationOptions(queryClient));
  const lines = plan.data ? resetLines(plan.data) : [];
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir {agent.name}?</DialogTitle>
          <DialogDescription>
            
            Isso exclui o que {agent.name}  tem com você. As conversas e dados de outras pessoas permanecem. Não é possível desfazer.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="mt-4 overflow-y-auto">
          {plan.isPending ? null : plan.error ? (
            <p className="text-destructive text-sm" role="alert">
              
              Não foi possível verificar o que a redefinição excluiria. Tente novamente.
            </p>
          ) : reset.isSuccess ? (
            <p className="text-sm">Pronto. {agent.name}  começa do zero com você.</p>
          ) : (
            <div className="grid gap-2 text-sm">
              {lines.length === 0 ? (
                <p>Não há nada seu para excluir.</p>
              ) : (
                <>
                  <p>Isto será excluído:</p>
                  <ul className="list-disc pl-5">
                    {lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              )}
              {plan.data.sharedConversationsKept > 0 ? (
                <p className="text-muted-foreground">
                  {plan.data.sharedConversationsKept}{" "}
                  {plan.data.sharedConversationsKept === 1 ? "conversa é" : "conversas são"}{" "}
                  
                  compartilhado com outras pessoas ou Bots e será mantido.
                </p>
              ) : null}
              <p className="text-muted-foreground">
                
                Memórias que você mesmo contou a um Bot são mantidas.
              </p>
            </div>
          )}
          {reset.error ? (
            <p className="mt-2 text-destructive text-sm" role="alert">
              {reset.error.message}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter className="mt-4">
          <Button
            onClick={() => onOpenChange(false)}
            size="sm"
            variant="outline"
          >
            {reset.isSuccess ? "Fechar" : "Cancelar"}
          </Button>
          {reset.isSuccess ? null : (
            <Button
              disabled={!plan.data || lines.length === 0 || reset.isPending}
              onClick={() => reset.mutate(agent.id)}
              size="sm"
              variant="destructive"
            >
              {reset.isPending ? "Resetting…" : "Excluir e redefinir"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What can be done to a Bot: pin and hide (the person's own list only), duplicate, reset what it
 * has with this person, and — for whoever may manage it — delete it.
 *
 * Navigation is the caller's: hiding and deleting leave the page, duplicating opens the copy.
 */
export function ManageSection({
  agent,
  onHidden,
  onDuplicated,
  onDeleted,
}: {
  agent: AgentProfile;
  onHidden: () => void;
  onDuplicated: (copyId: string) => void;
  onDeleted: () => void;
}) {
  const setPinned = useMutation(setAgentPinnedMutationOptions(queryClient));
  const setHidden = useMutation(setAgentHiddenMutationOptions(queryClient));
  const duplicate = useMutation(duplicateAgentMutationOptions(queryClient));
  const remove = useMutation(deleteAgentMutationOptions(queryClient));
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const error = setPinned.error ?? setHidden.error ?? duplicate.error;
  // An administrator put it in this person's list; it stays pinned and cannot be hidden.
  const assigned = agent.assignedToMe === true;

  return (
    <PageSection title="Gerenciar">
      {error ? (
        <p className="mt-4 text-destructive text-sm" role="alert">
          {error.message}
        </p>
      ) : null}
      <PageRows>
        <Item size="sm">
          <ItemMedia variant="icon">
            <IconPin />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Fixados</ItemTitle>
            <ItemDescription>
              {assigned
                ? "Um administrador o atribuiu a você. Ele fica no topo da sua lista de Bots."
                : agent.pinned
                  ? "No topo da sua lista de Bots. Só a sua lista muda."
                  : "Mantê-lo no topo da sua lista de Bots. Só a sua lista muda."}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Switch
              aria-label="Fixados"
              checked={agent.pinned || assigned}
              disabled={assigned || setPinned.isPending}
              onCheckedChange={(pinned) =>
                setPinned.mutate({ agentId: agent.id, pinned })
              }
            />
          </ItemActions>
        </Item>
        <Separator />
        <Item size="sm">
          <ItemMedia variant="icon">
            <IconEyeOff />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Ocultos</ItemTitle>
            <ItemDescription>
              {assigned
                ? "Um administrador o atribuiu a você. Você não pode ocultá-lo."
                : agent.hidden
                  ? "Em Ocultos na sua lista de Bots. Só a sua lista muda."
                  : "Tirá-lo da sua lista de Bots. Só a sua lista muda."}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Switch
              aria-label="Ocultos"
              checked={agent.hidden}
              disabled={assigned || setHidden.isPending}
              onCheckedChange={async (hidden) => {
                await setHidden.mutateAsync({ agentId: agent.id, hidden });
                if (hidden) onHidden();
              }}
            />
          </ItemActions>
        </Item>
        <Separator />
        <Item
          render={
            <button
              disabled={duplicate.isPending}
              onClick={async () =>
                onDuplicated((await duplicate.mutateAsync(agent.id)).id)
              }
              type="button"
            />
          }
          size="sm"
        >
          <ItemMedia variant="icon">
            <IconCopy />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Duplicar</ItemTitle>
            <ItemDescription>
              
              Crie sua própria cópia. As conversas e chaves dele não são copiadas.
            </ItemDescription>
          </ItemContent>
        </Item>
        <Separator />
        <Item
          render={<button onClick={() => setResetOpen(true)} type="button" />}
          size="sm"
        >
          <ItemMedia variant="icon">
            <IconRefresh />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Redefinir</ItemTitle>
            <ItemDescription>
              
              Exclua suas conversas com ele, o que ele lembra sobre você e as tarefas agendadas dele. Você verá a lista antes.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <IconChevronRight className="size-4 text-muted-foreground" />
          </ItemActions>
        </Item>
        {agent.canManage ? (
          <>
            <Separator />
            <Item
              render={
                <button onClick={() => setDeleteOpen(true)} type="button" />
              }
              size="sm"
            >
              <ItemMedia variant="icon">
                <IconTrash />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Excluir</ItemTitle>
                <ItemDescription>
                  
                  Exclui para todos. Não é possível desfazer.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <IconChevronRight className="size-4 text-muted-foreground" />
              </ItemActions>
            </Item>
          </>
        ) : null}
      </PageRows>
      <ResetDialog agent={agent} onOpenChange={setResetOpen} open={resetOpen} />
      <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {agent.name}?</DialogTitle>
            <DialogDescription>
              
              Foi excluído para todos. Não é possível desfazer.
            </DialogDescription>
          </DialogHeader>
          {remove.error ? (
            <DialogBody className="mt-4">
              <p className="text-destructive text-sm" role="alert">
                {remove.error.message}
              </p>
            </DialogBody>
          ) : null}
          <DialogFooter className="mt-4">
            <Button
              onClick={() => setDeleteOpen(false)}
              size="sm"
              variant="outline"
            >
              
              Cancelar
            </Button>
            <Button
              disabled={remove.isPending}
              onClick={async () => {
                await remove.mutateAsync(agent.id);
                onDeleted();
              }}
              size="sm"
              variant="destructive"
            >
              {remove.isPending ? "Deleting…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageSection>
  );
}
