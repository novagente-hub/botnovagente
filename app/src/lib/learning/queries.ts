import type {
  LearningAutoAssignState,
  LearningDeliveryStatus,
  LearningOverview,
  LearningSettings,
  PersonalLearningSharing,
} from "@openbot/shared/learning";
import { queryOptions } from "@tanstack/react-query";
import { client } from "@/lib/client";

export const learningKeys = {
  all: ["learning"] as const,
  settings: ["learning", "settings"] as const,
  automatic: ["learning", "automatic"] as const,
  personal: ["learning", "personal"] as const,
};
/**
 * Settings, Learning: who else's Bots use the Skills learned from your own recordings, and the Skills in your own
 * Learning space (null when Intelligence did not deliver them).
 */
export function personalLearningQueryOptions() {
  return queryOptions({
    queryKey: learningKeys.personal,
    retry: false,
    queryFn: async (): Promise<PersonalLearningSharing> =>
      (
        await client("/api/settings/learning", {
          fallback: "Não foi possível carregar suas configurações de Aprendizado. Recarregue a página.",
        })
      ).json(),
  });
}
export function learningSettingsQueryOptions() {
  return queryOptions({
    queryKey: learningKeys.settings,
    queryFn: (): Promise<LearningSettings> =>
      client("/api/admin/learning/settings", "settings", {
        fallback: "Não foi possível carregar as configurações de Aprendizado.",
      }),
  });
}
/** Why no container was assigned automatically, or `null` when the server has nothing to say. */
export function learningAutomaticQueryOptions() {
  return queryOptions({
    queryKey: learningKeys.automatic,
    retry: false,
    queryFn: async (): Promise<LearningAutoAssignState | null> =>
      (await client<LearningAutoAssignState | undefined>(
        "/api/admin/learning/settings",
        "automatic",
        { fallback: "Não foi possível carregar as configurações de Aprendizado." },
      )) ?? null,
  });
}
export function learningOverviewQueryOptions(agentId?: string) {
  return queryOptions({
    queryKey: ["learning", "overview", agentId],
    retry: false,
    queryFn: (): Promise<LearningOverview> =>
      client(
        `/api/admin/learning/overview${agentId ? `?agentId=${encodeURIComponent(agentId)}` : ""}`,
        "overview",
        { fallback: "Não foi possível carregar o status do Aprendizado." },
      ),
  });
}
export function learningDeliveryQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["learning", "delivery", agentId],
    enabled: Boolean(agentId),
    retry: false,
    queryFn: (): Promise<LearningDeliveryStatus> =>
      client(
        `/api/admin/learning/status/${encodeURIComponent(agentId)}`,
        "status",
        { fallback: "Não foi possível carregar o status da entrega de habilidades." },
      ),
  });
}
/** Create the project's container with the deployment's credential, then report what assignment found. */
export function createLearningContainer(): Promise<LearningAutoAssignState> {
  return client("/api/admin/learning/container", "automatic", {
    method: "POST",
    body: {},
    fallback: "Não foi possível criar o container de Aprendizado.",
  });
}
export function saveLearningSettings(
  settings: LearningSettings,
): Promise<LearningSettings> {
  return client("/api/admin/learning/settings", "settings", {
    method: "PUT",
    body: settings,
    fallback: "Não foi possível salvar as configurações de Aprendizado.",
  });
}
