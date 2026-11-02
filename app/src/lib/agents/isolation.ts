/**
 * The words for Isolated Bots, said the same way in the New Bot sheet and on a Bot's Setup row.
 *
 * Kept together because they answer one question from two places, and a reader who meets the
 * tooltip when making a Bot should meet the same sentence when they come back to change it.
 */

/** What Isolated means. */
export const ISOLATED_EXPLAINED =
  "Roda em um computador próprio. Nada do que ele faz alcança os arquivos ou logins dos seus outros Bots. Custa mais para rodar.";

/** Added for a public Bot, whose one computer is everybody's. */
export const ISOLATED_PUBLIC =
  "Todos que usam este Bot compartilham esse computador.";

/**
 * Said on an isolated Bot's Visibility row. Its one computer is shared by everybody who uses it, so a public one shares
 * whatever anybody signed in to there with everybody else, as a shared Bot's computer does across the industry. Said
 * before it is made public, and while it is.
 */
export const ISOLATED_PUBLIC_SHARES_LOGINS =
  "Todos que o usam compartilham o computador dele, então qualquer login feito ali é deles também.";

/** The same, said to the owner of a private isolated Bot before they make it public. */
export const ISOLATED_MAKING_PUBLIC =
  "Torná-lo público compartilha o computador dele, e qualquer login feito ali, com todos que o usam.";

/** Why it cannot be ticked on this deployment. */
export const ISOLATION_UNAVAILABLE =
  "Este OpenBot não consegue dar a um Bot um computador próprio.";

/** Why it cannot be ticked by this person. */
export const ISOLATION_NOT_ALLOWED =
  "Seu administrador desativou os Bots isolados para você.";

/** An isolated Bot whose owner lost the switch, which keeps running on their shared computer. */
export const ISOLATION_WITHDRAWN =
  "Seu administrador desativou os Bots isolados, então este Bot roda no seu computador.";

/** An isolated Bot on a deployment that can no longer make it a computer of its own. */
export const ISOLATION_GONE =
  "Este OpenBot não consegue dar a um Bot um computador próprio, então este Bot roda no seu computador.";

/** The whole explanation for a Bot of this visibility. */
export function isolatedExplained(isPublic: boolean): string {
  return isPublic
    ? `${ISOLATED_EXPLAINED} ${ISOLATED_PUBLIC}`
    : ISOLATED_EXPLAINED;
}
