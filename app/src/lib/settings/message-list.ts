import type { SkinId, UserPreferences } from "@openbot/shared/user-preferences";
import {
  mutationOptions,
  type QueryClient,
  queryOptions,
  useQuery,
} from "@tanstack/react-query";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { client } from "@/lib/client";
import { getSkinId, setSkin } from "@/skins/store";
import { settingsKeys } from "./queries";

export type { MessageListEmphasis } from "@openbot/shared/user-preferences";

export function userPreferencesQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: [...settingsKeys.all, "preferences", userId] as const,
    enabled: Boolean(userId),
    queryFn: ({ signal }): Promise<UserPreferences> =>
      client("/api/settings/preferences", "preferences", {
        signal,
        fallback: "Não foi possível carregar suas preferências",
      }),
  });
}

export function useUserPreferences() {
  const { data: user } = useQuery(currentUserQueryOptions());
  return {
    userId: user?.id,
    ...useQuery(userPreferencesQueryOptions(user?.id)),
  };
}

export function useMessageListEmphasis() {
  return useUserPreferences().data?.messageListEmphasis ?? "thread";
}

/**
 * Close the self-host banner for this person, on every device they sign in from.
 *
 * Patched in onMutate so the bar is gone the moment the button is pressed, and put back if the save
 * fails, because a banner that vanished and then reappeared on the next load would read as ignoring
 * the click. The reply seeds the cache with what the server stored.
 */
export function dismissSelfHostBannerMutationOptions(
  queryClient: QueryClient,
  userId: string | undefined,
) {
  const queryKey = userPreferencesQueryOptions(userId).queryKey;
  return mutationOptions({
    mutationFn: (): Promise<UserPreferences> => {
      if (!userId) throw new Error("Entre para salvar suas preferências.");
      return client("/api/settings/preferences", "preferences", {
        method: "PATCH",
        body: { selfHostBannerDismissed: true },
        fallback: "Não foi possível salvar suas preferências",
      });
    },
    onMutate: () => {
      const previous = queryClient.getQueryData(queryKey);
      if (previous) {
        queryClient.setQueryData(queryKey, {
          ...previous,
          selfHostBannerDismissed: true,
        });
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (preferences) => queryClient.setQueryData(queryKey, preferences),
  });
}

export function saveUserPreferencesMutationOptions(
  queryClient: QueryClient,
  userId: string | undefined,
) {
  return mutationOptions({
    mutationFn: (
      preferences: Partial<UserPreferences>,
    ): Promise<UserPreferences> => {
      if (!userId) throw new Error("Entre para salvar suas preferências.");
      return client("/api/settings/preferences", "preferences", {
        method: "PATCH",
        body: preferences,
        fallback: "Não foi possível salvar suas preferências",
      });
    },
    onSuccess: (preferences) =>
      queryClient.setQueryData(
        userPreferencesQueryOptions(userId).queryKey,
        preferences,
      ),
  });
}

/** Held while a skin save is out, so the account sync can tell its own write from a stale read. */
export const saveSkinMutationKey = [
  ...settingsKeys.all,
  "preferences",
  "skin",
] as const;

/**
 * Choose how OpenBot looks for this person, on every device they sign in from.
 *
 * The skin is drawn the moment it is picked, and the cached preferences are patched to match, so
 * `SkinAccountSync` agrees with the picker while the save is out. A read already in flight is
 * cancelled first, or it would land the old skin over the new one. A failed save puts back both the
 * skin and the cache, and the picker says so. The reply seeds the cache with what the server stored.
 */
export function saveSkinMutationOptions(
  queryClient: QueryClient,
  userId: string | undefined,
) {
  const queryKey = userPreferencesQueryOptions(userId).queryKey;
  return mutationOptions({
    mutationKey: saveSkinMutationKey,
    mutationFn: (skin: SkinId): Promise<UserPreferences> => {
      if (!userId) throw new Error("Entre para salvar suas preferências.");
      return client("/api/settings/preferences", "preferences", {
        method: "PATCH",
        body: { skin },
        fallback: "Não foi possível salvar seu tema visual",
      });
    },
    onMutate: async (skin) => {
      const previousSkin = getSkinId();
      setSkin(skin);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      if (previous) queryClient.setQueryData(queryKey, { ...previous, skin });
      return { previous, previousSkin };
    },
    onError: (_error, _skin, context) => {
      if (!context) return;
      if (context.previous)
        queryClient.setQueryData(queryKey, context.previous);
      setSkin(context.previousSkin);
    },
    onSuccess: (preferences) => queryClient.setQueryData(queryKey, preferences),
  });
}
