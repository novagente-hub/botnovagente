export type LinkedNotice = { tone: "success" | "error"; text: string };

/**
 * What the connected accounts page says about the `?linked=` the GitHub callback redirected back
 * with. Only the three values the callback sends have a sentence; anything else says nothing.
 */
export function linkedNotice(value: string | undefined): LinkedNotice | null {
  if (value === "github") {
    return { tone: "success", text: "Sua conta do GitHub está vinculada." };
  }
  if (value === "failed") {
    return {
      tone: "error",
      text: "Não foi possível vincular sua conta do GitHub. Tente novamente.",
    };
  }
  if (value === "github-taken") {
    return {
      tone: "error",
      text: "Essa conta do GitHub está vinculada a outra pessoa no OpenBot. Entre no GitHub com outra conta e tente novamente, ou fale com um administrador.",
    };
  }
  return null;
}

/**
 * The notice to draw right now, given the person's current linked accounts.
 *
 * A success notice is a claim about the list below it, so it holds only while that list agrees: the
 * only success `linkedNotice` produces is for GitHub, and once that link is gone (the person
 * disconnected it on this very page) the sentence would contradict the card under it. Until the list
 * has loaded (`links` undefined) it stays hidden, which beats flashing a claim that may be wrong.
 * Error notices describe an attempt, not the list, so they are never withheld.
 */
export function visibleLinkedNotice(
  notice: LinkedNotice | null,
  links: ReadonlyArray<{ provider: string }> | undefined,
): LinkedNotice | null {
  if (!notice || notice.tone === "error") return notice;
  return links?.some((link) => link.provider === "github") ? notice : null;
}
