import type {
  LearningAutoAssignState,
  LearningSettings,
  LearningTarget,
} from "@openbot/shared/learning";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useId, useState } from "react";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { agentListQueryOptions } from "@/lib/agents/queries";
import {
  createLearningContainer,
  learningAutomaticQueryOptions,
  learningDeliveryQueryOptions,
  learningKeys,
  learningOverviewQueryOptions,
  learningSettingsQueryOptions,
  saveLearningSettings,
} from "@/lib/learning/queries";

export const Route = createFileRoute("/_authed/admin/learning")({
  component: LearningPage,
});
const selectClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";

/** What automatic assignment found, in words, or nothing when there is nothing to say. */
function automaticMessage(
  automatic: LearningAutoAssignState | null | undefined,
  settings: LearningSettings,
): string | undefined {
  if (!automatic) return undefined;
  if (
    automatic.state === "assigned" &&
    settings.defaultTarget?.containerId === automatic.containerId
  )
    return `O OpenBot atribuiu automaticamente o container "${automatic.containerId}" deste projeto do Intelligence. Você pode alterá-lo aqui.`;
  if (automatic.state === "absent")
    return `Este projeto do Intelligence ainda não tem um container de Aprendizado "${automatic.containerId}". Nada é coletado.`;
  if (automatic.state === "not_entitled")
    return "O plano deste projeto do Intelligence não inclui Aprendizado. Nenhum container foi atribuído.";
  if (automatic.state === "unavailable")
    return "Não foi possível acessar o Intelligence para encontrar o container de Aprendizado deste projeto. O OpenBot vai tentar de novo.";
  return undefined;
}

function TargetFields({
  target,
  onChange,
  label,
}: {
  target: LearningTarget | null;
  onChange: (target: LearningTarget | null) => void;
  label: string;
}) {
  const fieldId = useId();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-2 text-sm" htmlFor={`${fieldId}-container`}>
        {`ID do container (${label})`}
        <Input
          id={`${fieldId}-container`}
          aria-label={`ID do container (${label})`}
          value={target?.containerId ?? ""}
          maxLength={64}
          placeholder="support-learning"
          onChange={(event) =>
            onChange(
              event.target.value
                ? { ...target, containerId: event.target.value }
                : null,
            )
          }
        />
      </label>
      <label className="grid gap-2 text-sm" htmlFor={`${fieldId}-revision`}>
        
        Revisão exata (opcional)
        <Input
          id={`${fieldId}-revision`}
          aria-label={`Revisão (${label})`}
          value={target?.revision ?? ""}
          disabled={!target}
          placeholder="Última publicada"
          maxLength={256}
          onChange={(event) => {
            if (target)
              onChange({
                containerId: target.containerId,
                ...(event.target.value ? { revision: event.target.value } : {}),
              });
          }}
        />
      </label>
    </div>
  );
}

/**
 * The missing container, and how it gets made: a button when this deployment holds a credential that
 * can create it, and always the exact steps for an operator, since the runtime key cannot.
 */
function ContainerSetup({
  automatic,
}: {
  automatic: Extract<LearningAutoAssignState, { state: "absent" }>;
}) {
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: createLearningContainer,
    onSuccess: async (next) => {
      queryClient.setQueryData(learningKeys.automatic, next);
      await queryClient.invalidateQueries({ queryKey: learningKeys.all });
    },
  });
  return (
    <div className="grid gap-2 rounded-md border p-3 text-sm">
      {automatic.canCreate && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending
              ? "Criando…"
              : `Criar o container ${automatic.containerId}`}
          </Button>
          <span className="text-muted-foreground">
            
            Usa a credencial desta implantação, não a chave do runtime.
          </span>
        </div>
      )}
      {(create.error || automatic.createError) && (
        <p role="alert" className="text-destructive">
          {create.error?.message ?? automatic.createError}
        </p>
      )}
      {automatic.instructions && (
        <p>
          <span className="font-medium">Para criar: </span>
          {automatic.instructions}
        </p>
      )}
    </div>
  );
}

export function LearningPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(learningSettingsQueryOptions());
  const automatic = useQuery(learningAutomaticQueryOptions());
  const agents = useQuery(agentListQueryOptions());
  const hiddenAgents = useQuery(agentListQueryOptions(true));
  const roster = [...(agents.data ?? []), ...(hiddenAgents.data ?? [])];
  const [draft, setDraft] = useState<LearningSettings | null>(null);
  const [selected, setSelected] = useState("");
  const [saved, setSaved] = useState(false);
  const overview = useQuery(
    learningOverviewQueryOptions(selected || undefined),
  );
  const delivery = useQuery(learningDeliveryQueryOptions(selected));
  const settings = draft ?? settingsQuery.data;
  // About what is saved, so it steps aside while an edit is in progress.
  const automaticNote =
    settingsQuery.data && !draft
      ? automaticMessage(automatic.data, settingsQuery.data)
      : undefined;
  const save = useMutation({
    mutationFn: saveLearningSettings,
    onSuccess: async (next) => {
      queryClient.setQueryData(learningKeys.settings, next);
      setDraft(null);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: learningKeys.all });
    },
  });
  function change(next: LearningSettings) {
    setDraft(next);
    setSaved(false);
    save.reset();
  }
  const botIds = [
    ...new Set([
      ...roster.map((agent) => agent.id),
      ...Object.keys(settings?.agents ?? {}),
    ]),
  ];
  const nameFor = (id: string) =>
    roster.find((agent) => agent.id === id)?.name ?? id;
  const snapshot = overview.data;

  return (
    <PageShell
      title="Aprendizado automático"
      description="Aprenda com conversas finalizadas, revise as habilidades que o Intelligence propõe e dê as habilidades publicadas aos Bots."
    >
      <PageSection
        title="Participação"
        description="Alterações de container valem para novas conversas. As existentes mantêm o primeiro container. Os containers precisam já existir no mesmo projeto do Intelligence. Até você salvar aqui, o OpenBot usa o container openbot desse projeto."
      >
        {settingsQuery.isPending && (
          <p role="status">Carregando configurações de Aprendizado…</p>
        )}
        {settingsQuery.error && (
          <p role="alert" className="text-destructive">
            {settingsQuery.error.message}
          </p>
        )}
        {settings && (
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(settings);
            }}
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) =>
                  change({ ...settings, enabled: event.target.checked })
                }
              />
              
              Ativar aprendizado automático e entrega de habilidades
            </label>
            <TargetFields
              label="Padrão"
              target={settings.defaultTarget}
              onChange={(defaultTarget) =>
                change({ ...settings, defaultTarget })
              }
            />
            {automaticNote && (
              <p role="status" className="text-sm">
                {automaticNote}
              </p>
            )}
            {!draft && automatic.data?.state === "absent" && (
              <ContainerSetup automatic={automatic.data} />
            )}
            <p className="text-muted-foreground text-sm">
              
              Sem um padrão, Bots sem container próprio ficam de fora. IDs têm de 1 a 64 letras minúsculas, números e hifens simples. Deixe a revisão vazia para usar as últimas habilidades publicadas.
            </p>
            <fieldset className="grid gap-4">
              <legend className="mb-3 font-medium">
                
                Participação por Bot
              </legend>
              {(agents.error || hiddenAgents.error) && (
                <p role="alert" className="text-destructive">
                  
                  Não foi possível carregar a lista de Bots. As configurações salvas de cada Bot estão abaixo.
                </p>
              )}
              {botIds.map((id) => {
                const override = settings.agents[id];
                const mode = !Object.hasOwn(settings.agents, id)
                  ? "inherit"
                  : override === null
                    ? "exclude"
                    : "container";
                return (
                  <div key={id} className="grid gap-3 rounded-lg border p-4">
                    <label className="grid gap-2 text-sm font-medium">
                      {nameFor(id)}
                      <select
                        className={selectClass}
                        aria-label={`${nameFor(id)} participation`}
                        value={mode}
                        onChange={(event) => {
                          const mappings = { ...settings.agents };
                          if (event.target.value === "inherit")
                            delete mappings[id];
                          else
                            mappings[id] =
                              event.target.value === "exclude"
                                ? null
                                : {
                                    containerId:
                                      settings.defaultTarget?.containerId ?? "",
                                  };
                          change({ ...settings, agents: mappings });
                        }}
                      >
                        <option value="inherit">Usar o padrão da implantação</option>
                        <option value="exclude">Deixar fora do Aprendizado</option>
                        <option value="container">
                          
                          Usar um container específico
                        </option>
                      </select>
                    </label>
                    {mode === "container" && (
                      <TargetFields
                        label={nameFor(id)}
                        target={override ?? null}
                        onChange={(target) =>
                          change({
                            ...settings,
                            agents: {
                              ...settings.agents,
                              [id]: target ?? { containerId: "" },
                            },
                          })
                        }
                      />
                    )}
                  </div>
                );
              })}
            </fieldset>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando…" : "Salvar configurações de Aprendizado"}
              </Button>
              {saved && (
                <p role="status" className="text-sm">
                  
                  Configurações salvas.
                </p>
              )}
            </div>
            {save.error && (
              <p role="alert" className="text-destructive">
                {save.error.message}
              </p>
            )}
          </form>
        )}
      </PageSection>
      <PageSection
        title="Revisar e publicar"
        description="O Intelligence estuda conversas finalizadas e propõe habilidades. Revise e publique-as no Intelligence. Os Bots só usam habilidades publicadas."
      >
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm">
            
            Mostrar o container de
            <select
              className={selectClass}
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">Padrão da implantação</option>
              {botIds.map((id) => (
                <option key={id} value={id}>
                  {nameFor(id)}
                </option>
              ))}
            </select>
          </label>
          {overview.isPending && <p role="status">Verificando o Intelligence…</p>}
          {overview.error && (
            <p role="alert" className="text-destructive">
              {overview.error.message}
            </p>
          )}
          {snapshot && (
            <>
              <p className="text-sm">
                {snapshot.configuration === "configured"
                  ? `${snapshot.container?.name} (${snapshot.container?.id})`
                  : snapshot.configuration === "invalid"
                    ? "O container selecionado ou a instrumentação dele não está disponível."
                    : snapshot.configuration === "selection_required"
                      ? "Escolha um Bot ou defina um container padrão."
                      : "Nenhum container de Aprendizado atribuído."}
              </p>
              <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Conversas prontas</dt>
                  <dd className="font-semibold text-xl">
                    {snapshot.pendingThreadCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    
                    Candidatas para revisar
                  </dt>
                  <dd className="font-semibold text-xl">
                    {snapshot.pendingCandidateCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Habilidades publicadas</dt>
                  <dd className="font-semibold text-xl">
                    {snapshot.publishedSkillCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Insights</dt>
                  <dd className="font-semibold text-xl">
                    {snapshot.insightCount}
                  </dd>
                </div>
              </dl>
              <p className="text-sm">
                {snapshot.hasActiveRun
                  ? "Uma análise está em execução."
                  : snapshot.latestRunStatus
                    ? `Última análise: ${snapshot.latestRunStatus}.`
                    : "Nenhuma análise foi executada ainda."}
              </p>
              <div className="flex flex-wrap gap-4 text-sm underline">
                <a
                  href={snapshot.links.learning}
                  target="_blank"
                  rel="noreferrer"
                >
                  
                  Gerenciar Aprendizado no Intelligence
                </a>
                {snapshot.links.candidates && (
                  <a
                    href={snapshot.links.candidates}
                    target="_blank"
                    rel="noreferrer"
                  >
                    
                    Revisar candidatas a habilidade
                  </a>
                )}
                {snapshot.links.runs && (
                  <a
                    href={snapshot.links.runs}
                    target="_blank"
                    rel="noreferrer"
                  >
                    
                    Ver execuções de análise
                  </a>
                )}
              </div>
            </>
          )}
          {selected && (
            <div className="grid gap-2 rounded-lg border p-4 text-sm">
              <h3 className="font-medium">Entrega de habilidades</h3>
              {delivery.isPending ? (
                <p>Verificando entrega…</p>
              ) : delivery.error ? (
                <p role="alert">{delivery.error.message}</p>
              ) : (
                delivery.data && (
                  <>
                    <p>
                      {!delivery.data.configured
                        ? "A entrega está desativada para este Bot."
                        : !delivery.data.initialized
                          ? "Aguardando o primeiro snapshot de habilidades verificado."
                          : delivery.data.stale
                            ? "Usando o último snapshot verificado. Uma atualização está pendente."
                            : "Um snapshot verificado está disponível."}
                    </p>
                    {delivery.data.revision && (
                      <p>Revisão carregada: {delivery.data.revision}</p>
                    )}
                    {delivery.data.lastCheckedAt && (
                      <p>
                        
                        Última verificação:{" "}
                        {new Date(delivery.data.lastCheckedAt).toLocaleString()}
                      </p>
                    )}
                    {delivery.data.error && (
                      <p role="alert">{delivery.data.error.message}</p>
                    )}
                  </>
                )
              )}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={overview.isFetching || delivery.isFetching}
            onClick={() => {
              void overview.refetch();
              if (selected) void delivery.refetch();
            }}
          >
            
            Atualizar status
          </Button>
          <p className="text-muted-foreground text-sm">
            
            Gerenciar o Aprendizado exige sua conta do Intelligence e acesso ao projeto. O OpenBot mantém as credenciais do projeto no servidor. Desativar o Aprendizado aqui mantém as configurações e as atribuições de conversas. Agendas e publicação ficam no Intelligence.
          </p>
        </div>
      </PageSection>
    </PageShell>
  );
}
