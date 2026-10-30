import type { AuthenticatedUser } from "./queries";

/** Keep the welcome out of message history, and never guess a first name. */
export function firstConversationGreeting(
  user: AuthenticatedUser | null | undefined,
  noConversations: boolean,
): string {
  const name = user?.name?.trim();
  if (!noConversations || !name || user?.needsName || name === user?.email)
    return "Comece uma conversa";
  return `Oi, ${name}! Em que vamos trabalhar hoje?`;
}
