// app/src/components/plugins/account-mode-dialog.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  accountModePreview,
  setAccountModeMutationOptions,
} from "@/lib/plugins/mutations";
import { describeApproval } from "@/lib/plugins/shared-use";

/**
 * The one moment an administrator decides between people's own accounts and one shared account.
 *
 * WHAT GOES IS NAMED BEFORE THE BUTTON, from the server's own dry run, so the count on screen is the
 * count that will be revoked — and each Bot's approval is listed as it will be written, because that
 * is the decision being made on their behalf, not a detail of it.
 */
export function AccountModeDialog({
  serverId,
  title,
  target,
  open,
  onOpenChange,
  names = {},
}: {
  serverId: string;
  title: string;
  target: "personal" | "shared";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  names?: Record<string, string>;
}) {
  const queryClient = useQueryClient();
  /**
   * Kept out of the `["plugins", …]` family on purpose. `invalidatePlugins` — which every plugin
   * write, including the switch below, runs `onSettled` — invalidates by that prefix, and this
   * dialog stays mounted and enabled through its own confirm. Sharing the prefix would have the
   * switch's own settle re-fire this dry run a moment after the real write, so the last request the
   * dialog sent would read as a second preview rather than the switch that just happened.
   */
  const preview = useQuery({
    queryKey: ["account-mode", serverId, target],
    queryFn: () => accountModePreview(serverId, target),
    enabled: open,
  });
  const change = useMutation({
    ...setAccountModeMutationOptions(queryClient),
    onSuccess: () => onOpenChange(false),
  });
  const count = preview.data?.wouldRevoke.count ?? 0;
  const goes =
    preview.data?.wouldRevoke.holder === "deployment"
      ? count > 0
        ? "A conta compartilhada será desconectada."
        : "Nenhuma conta compartilhada está conectada."
      : `${count} ${count === 1 ? "account" : "accounts"} pessoal será desconectado.`;
  const action =
    target === "shared" ? `Tornar ${title} compartilhado` : `Tornar ${title} pessoal`;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {target === "shared"
              ? `Compartilhar uma conta ${title}?`
              : `Dar a cada pessoa a própria conta ${title}?`}
          </DialogTitle>
          <DialogDescription>
            {preview.data ? goes : "Verificando o que isso mudaria…"}
          </DialogDescription>
        </DialogHeader>
        {target === "shared" ? (
          <div className="mt-4 space-y-3 text-sm">
            <p>
              
              Todos que usarem um Bot com este app vão agir como esta conta.
            </p>
            {preview.data?.bots.length ? (
              <ul className="space-y-1">
                {preview.data.bots.map((bot) => (
                  <li key={bot.botId}>
                    <span className="font-medium">
                      {names[bot.botId] ?? bot.botId}
                    </span>
                    : {describeApproval(bot.exposure)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {preview.error || change.error ? (
          <p className="mt-4 text-destructive text-sm" role="alert">
            {(change.error ?? preview.error)?.message}
          </p>
        ) : null}
        <DialogFooter className="mt-4">
          <Button
            onClick={() => onOpenChange(false)}
            size="sm"
            variant="outline"
          >
            
            Cancelar
          </Button>
          <Button
            disabled={!preview.data || change.isPending}
            onClick={() => change.mutate({ serverId, mode: target })}
            size="sm"
            variant="destructive"
          >
            {action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
