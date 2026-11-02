import {
  mutationOptions,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { client } from "@/lib/client";
import { sharedUseKeys } from "@/lib/plugins/shared-use";

export type ResponsibilityRecord = {
  id: string;
  agentId: string;
  channelId: string;
  threadId: string;
  title: string;
  instruction: string;
  successCriteria: string;
  status: "active" | "paused" | "completed";
  progress: string;
  lastResult: string | null;
  subscriptions: {
    source:
      | "manual"
      | "slack"
      | "github"
      | "schedule"
      | "connector"
      | "webhook"
      | "linear"
      | "sentry"
      | "pagerduty"
      | "email";
    eventType: string;
  }[];
  updatedAt: string;
};
export type ResponsibilityRunRecord = {
  id: string;
  status: "queued" | "running" | "waiting" | "succeeded" | "failed" | "skipped";
  replyText: string | null;
  error: string | null;
  waiting: { kind: string; requestId?: string } | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};
export type GithubBindingRecord = {
  id: string;
  source: "github";
  repository: string;
  createdAt: string;
  webhookPath?: string;
};
export const responsibilityKeys = {
  all: ["responsibilities"] as const,
  runs: (id: string) => ["responsibilities", id, "runs"] as const,
  bindings: ["responsibilities", "github-bindings"] as const,
  triggers: (id: string) => ["responsibilities", id, "triggers"] as const,
};
export function responsibilitiesQueryOptions() {
  return queryOptions({
    queryKey: responsibilityKeys.all,
    queryFn: (): Promise<ResponsibilityRecord[]> =>
      client("/api/responsibilities", "responsibilities", {
        fallback: "Não foi possível carregar as responsabilidades",
      }),
    refetchInterval: 10_000,
  });
}
export function responsibilityRunsQueryOptions(id: string) {
  return queryOptions({
    queryKey: responsibilityKeys.runs(id),
    queryFn: (): Promise<ResponsibilityRunRecord[]> =>
      client(`/api/responsibilities/${encodeURIComponent(id)}/runs`, "runs", {
        fallback: "Não foi possível carregar as execuções da responsabilidade",
      }),
    refetchInterval: 10_000,
  });
}
export function githubBindingsQueryOptions() {
  return queryOptions({
    queryKey: responsibilityKeys.bindings,
    queryFn: (): Promise<GithubBindingRecord[]> =>
      client("/api/responsibilities/sources/github", "bindings", {
        fallback: "Não foi possível carregar as origens de eventos do GitHub",
      }),
  });
}
export function createResponsibility(input: {
  agentId: string;
  channelId: string;
  title: string;
  instruction: string;
  successCriteria: string;
  subscriptions: ResponsibilityRecord["subscriptions"];
}) {
  return client<ResponsibilityRecord>(
    "/api/responsibilities",
    "responsibility",
    {
      method: "POST",
      body: input,
      fallback: "Não foi possível criar a responsabilidade",
    },
  );
}
export function updateResponsibility(
  id: string,
  patch: { title: string; instruction: string; successCriteria: string },
) {
  return client(`/api/responsibilities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
    fallback: "Não foi possível atualizar a responsabilidade",
  });
}
export function responsibilityAction(
  id: string,
  action: "pause" | "resume" | "complete" | "run",
) {
  return client(`/api/responsibilities/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    fallback: "Não foi possível alterar a responsabilidade",
  });
}
export function createGithubBinding(repository: string, secret: string) {
  return client<GithubBindingRecord>(
    "/api/responsibilities/sources/github",
    "binding",
    {
      method: "POST",
      body: { repository, secret },
      fallback: "Não foi possível conectar os eventos do GitHub",
    },
  );
}
export function removeGithubBinding(id: string) {
  return client(
    `/api/responsibilities/sources/github/${encodeURIComponent(id)}`,
    { method: "DELETE", fallback: "Não foi possível desconectar os eventos do GitHub" },
  );
}

export type TriggerKind =
  | "webhook"
  | "github"
  | "linear"
  | "sentry"
  | "pagerduty"
  | "email"
  | "slack";
export type TriggerFilter = {
  eventTypes: string[];
  field?: { path: string; equals: string };
};
export type TriggerConfig =
  | {
      kind: "webhook" | "linear" | "sentry" | "pagerduty";
      filter: TriggerFilter;
    }
  | { kind: "github"; repository?: string; filter: TriggerFilter }
  | { kind: "email"; allowedSenders: string[]; filter: TriggerFilter }
  | {
      kind: "slack";
      teamId: string;
      mode: "mention" | "phrase" | "reaction" | "message";
      phrases: string[];
      reactions: string[];
      channels: string[];
    };
export type TriggerRecord = {
  id: string;
  responsibilityId: string;
  kind: TriggerKind;
  config: TriggerConfig;
  hasSecret: boolean;
  /** Paused triggers acknowledge deliveries but never start a run. */
  enabled: boolean;
  /** Public path to POST to, for webhook and provider kinds. */
  path: string | null;
  /** Inbound address, for email when the deployment has inbound email configured. */
  address: string | null;
  emailConfigured?: boolean;
  createdAt: string;
};
export function triggersQueryOptions(id: string) {
  return queryOptions({
    queryKey: responsibilityKeys.triggers(id),
    queryFn: (): Promise<TriggerRecord[]> =>
      client(
        `/api/responsibilities/${encodeURIComponent(id)}/triggers`,
        "triggers",
        { fallback: "Não foi possível carregar os gatilhos" },
      ),
  });
}
export async function createTrigger(
  responsibilityId: string,
  input: { config: TriggerConfig; secret?: string },
) {
  const response = await client(
    `/api/responsibilities/${encodeURIComponent(responsibilityId)}/triggers`,
    { method: "POST", body: input, fallback: "Não foi possível adicionar o gatilho" },
  );
  return (await response.json()) as {
    trigger: TriggerRecord;
    secret: string | null;
  };
}
/** Rotate a generated secret, or store the provider's newly pasted one. */
export async function setTriggerSecret(triggerId: string, secret?: string) {
  const response = await client(
    `/api/responsibilities/triggers/${encodeURIComponent(triggerId)}/secret`,
    {
      method: "POST",
      body: secret ? { secret } : {},
      fallback: "Não foi possível alterar o segredo do gatilho",
    },
  );
  return (await response.json()) as {
    trigger: TriggerRecord;
    secret: string | null;
  };
}
export function revealTriggerSecret(triggerId: string) {
  return client<string>(
    `/api/responsibilities/triggers/${encodeURIComponent(triggerId)}/secret`,
    "secret",
    { fallback: "Não foi possível ler o segredo do gatilho" },
  );
}
export function removeTrigger(triggerId: string) {
  return client(
    `/api/responsibilities/triggers/${encodeURIComponent(triggerId)}`,
    { method: "DELETE", fallback: "Não foi possível remover o gatilho" },
  );
}

export function setTriggerEnabled(triggerId: string, enabled: boolean) {
  return client(
    `/api/responsibilities/triggers/${encodeURIComponent(triggerId)}/enabled`,
    {
      method: "PUT",
      body: { enabled },
      fallback: "Não foi possível alterar o gatilho",
    },
  );
}

const settleGithub = (queryClient: QueryClient) => () =>
  queryClient.invalidateQueries({ queryKey: responsibilityKeys.bindings });

export function createGithubBindingMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({
      repository,
      secret,
    }: {
      repository: string;
      secret: string;
    }) => createGithubBinding(repository, secret),
    onSettled: settleGithub(queryClient),
  });
}
export function removeGithubBindingMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: removeGithubBinding,
    onSettled: settleGithub(queryClient),
  });
}

const settleResponsibilities = (queryClient: QueryClient) => () =>
  queryClient.invalidateQueries({ queryKey: responsibilityKeys.all });

export function createResponsibilityMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: createResponsibility,
    onSuccess: settleResponsibilities(queryClient),
  });
}

export function updateResponsibilityMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { title: string; instruction: string; successCriteria: string };
    }) => updateResponsibility(id, patch),
    onSuccess: settleResponsibilities(queryClient),
  });
}

/** Pause, resume, complete or run a responsibility now. */
export function responsibilityActionMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "pause" | "resume" | "complete" | "run";
    }) => responsibilityAction(id, action),
    onSuccess: settleResponsibilities(queryClient),
  });
}

const settleTriggers = (queryClient: QueryClient, responsibilityId: string) =>
  queryClient.invalidateQueries({
    queryKey: responsibilityKeys.triggers(responsibilityId),
  });

/**
 * Add a trigger. A new trigger is a new way a shared app gets called, so the approval it needs may
 * have changed: the shared-use requests are refreshed alongside the triggers.
 */
export function createTriggerMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({
      responsibilityId,
      input,
    }: {
      responsibilityId: string;
      input: { config: TriggerConfig; secret?: string };
    }) => createTrigger(responsibilityId, input),
    onSuccess: async (_created, { responsibilityId }) => {
      await settleTriggers(queryClient, responsibilityId);
      await queryClient.invalidateQueries({
        queryKey: sharedUseKeys.requests(),
      });
    },
  });
}

/**
 * Read a trigger's write-only secret on demand. No `queryClient` and no `onSuccess`: it changes
 * nothing and caches nothing, so there is nothing to invalidate, and the secret lives only in the
 * row that asked for it.
 */
export function revealTriggerSecretMutationOptions() {
  return mutationOptions({ mutationFn: revealTriggerSecret });
}

/** Rotate a generated secret, or store the provider's newly pasted one. */
export function setTriggerSecretMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({
      trigger,
      secret,
    }: {
      trigger: Pick<TriggerRecord, "id" | "responsibilityId">;
      secret?: string;
    }) => setTriggerSecret(trigger.id, secret),
    onSuccess: (_result, { trigger }) =>
      settleTriggers(queryClient, trigger.responsibilityId),
  });
}

export function removeTriggerMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (trigger: Pick<TriggerRecord, "id" | "responsibilityId">) =>
      removeTrigger(trigger.id),
    onSuccess: (_result, trigger) =>
      settleTriggers(queryClient, trigger.responsibilityId),
  });
}

/** Switch a trigger on or off; a paused trigger acknowledges deliveries but never starts a run. */
export function setTriggerEnabledMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({
      trigger,
      enabled,
    }: {
      trigger: Pick<TriggerRecord, "id" | "responsibilityId">;
      enabled: boolean;
    }) => setTriggerEnabled(trigger.id, enabled),
    onSuccess: (_result, { trigger }) =>
      settleTriggers(queryClient, trigger.responsibilityId),
  });
}
