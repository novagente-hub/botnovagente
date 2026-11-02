import {
  mutationOptions,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { client } from "./client";
export type Reachability = {
  bindings: {
    id: string;
    transport: "slack" | "teams" | "sms";
    channelId: string;
    agentId: string;
    address: string;
    mentionId?: string | null;
    enabled: boolean;
    /** SMS only: the number replied STOP; texts resume after START. */
    optedOutAt?: string | null;
  }[];
  devices: { id: string; platform: "ios" | "android"; enabled: boolean }[];
  deliveries: {
    id: string;
    transport: string;
    kind: string;
    state: string;
    error: string | null;
    createdAt: string;
  }[];
  available: { slack: boolean; teams: boolean; sms: boolean; push: boolean };
};
export const deliveryKey = ["delivery"] as const;
export function deliveryQueryOptions() {
  return queryOptions({
    queryKey: deliveryKey,
    queryFn: async (): Promise<Reachability> => {
      const response = await client("/api/delivery", {
        fallback: "Não foi possível carregar os canais de contato",
      });
      return response.json();
    },
    refetchInterval: 10_000,
  });
}
/** A one-time `link <code>` message for the OpenTag app in Slack or Teams. */
export type ChatLink = {
  platform: "slack" | "teams";
  code: string;
  command: string;
  expiresInMinutes: number;
};
export async function startChatLink(target: {
  channelId: string;
  agentId: string;
  platform: "slack" | "teams";
}): Promise<ChatLink> {
  const response = await client("/api/delivery/opentag/start", {
    method: "POST",
    body: target,
    fallback: `Não foi possível começar a vincular ${target.platform === "teams" ? "Teams" : "Slack"}`,
  });
  return response.json();
}
export function startSms(target: {
  channelId: string;
  agentId: string;
  phone: string;
}) {
  return client<string>("/api/delivery/sms/start", "challengeId", {
    method: "POST",
    body: target,
    fallback: "Não foi possível verificar este telefone",
  });
}
export function confirmSms(challengeId: string, code: string) {
  return client("/api/delivery/sms/confirm", {
    method: "POST",
    body: { challengeId, code },
    fallback: "Não foi possível confirmar este telefone",
  });
}
export function removeDeliveryBinding(id: string) {
  return client(`/api/delivery/bindings/${encodeURIComponent(id)}`, {
    method: "DELETE",
    fallback: "Não foi possível desconectar",
  });
}
export function removePushDevice(id: string) {
  return client(`/api/delivery/devices/${encodeURIComponent(id)}`, {
    method: "DELETE",
    fallback: "Não foi possível remover este dispositivo",
  });
}

export function removePushDeviceMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: removePushDevice,
    onSettled: () => queryClient.invalidateQueries({ queryKey: deliveryKey }),
  });
}

export function removeDeliveryBindingMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: removeDeliveryBinding,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deliveryKey }),
  });
}

/**
 * Ask for a one-time `link <code>` message. No `queryClient`: nothing is linked until the code is
 * sent from Slack or Teams, so nothing cached has changed yet and there is nothing to invalidate.
 */
export function startChatLinkMutationOptions() {
  return mutationOptions({ mutationFn: startChatLink });
}

/**
 * Text a verification code to a phone. No `queryClient`, for the same reason as a link message: the
 * phone is not connected until the code comes back through `confirmSms`.
 */
export function startSmsMutationOptions() {
  return mutationOptions({ mutationFn: startSms });
}

export function confirmSmsMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({
      challengeId,
      code,
    }: {
      challengeId: string;
      code: string;
    }) => confirmSms(challengeId, code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deliveryKey }),
  });
}
