import type { ListedRecorderConnection } from "@openbot/shared/recorder-api";
import { IconBrowser } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import {
  PageEmpty,
  PageRows,
  PageSection,
} from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
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
import { revokeRecorderConnectionMutationOptions } from "@/lib/recorder/mutations";
import { recorderConnectionsQueryOptions } from "@/lib/recorder/queries";
import { relativeTime } from "@/lib/relative-time";
import { queryClient } from "@/query-client";

/** When a browser connected, to the minute: two copies with the same name (two Chrome profiles) stay told apart. */
const connectedAt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** The browsers signed in to this OpenBot as you, each with a Disconnect that revokes its sign-in. The row of the copy
 * in this browser (`thisInstallId`, from This browser) says so. */
export function ConnectedBrowsers({
  thisInstallId,
}: {
  thisInstallId?: string;
} = {}) {
  const connections = useQuery(
    recorderConnectionsQueryOptions({ listed: true }),
  );
  return (
    <PageSection title="Navegadores conectados">
      {connections.isPending ? null : connections.error ? (
        <p className="text-destructive text-sm" role="alert">
          Não foi possível carregar seus navegadores conectados. Recarregue a
          página.
        </p>
      ) : connections.data.connections.length === 0 ? (
        <PageEmpty>Nenhum navegador conectado ainda.</PageEmpty>
      ) : (
        <PageRows>
          {connections.data.connections.map((connection, index) => (
            <Fragment key={connection.id}>
              {index > 0 ? <Separator /> : null}
              <ConnectedBrowserRow
                connection={connection}
                here={
                  thisInstallId !== undefined &&
                  connection.installId === thisInstallId
                }
              />
            </Fragment>
          ))}
        </PageRows>
      )}
    </PageSection>
  );
}

/**
 * One connected browser, with its own Disconnect: asked first in a dialog, because it signs that browser's Recorder out
 * and stops a recording running there, and pending for this row alone, so disconnecting one browser leaves every other
 * row's button as it was. A refusal is said in the dialog, where the person asked.
 */
function ConnectedBrowserRow({
  connection,
  here,
}: {
  connection: ListedRecorderConnection;
  /** The copy of the Recorder in the browser this page is open in. */
  here: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const revoke = useMutation(
    revokeRecorderConnectionMutationOptions(queryClient),
  );
  const name = here ? `${connection.label} · This browser` : connection.label;
  // The browser the dialog is about, by the name the row shows: "este navegador" only for the copy in the browser this page
  // is open in, which every row's dialog used to say.
  const which = here
    ? "este navegador"
    : connection.via === "openbot-browser"
      ? "seu navegador OpenBot"
      : connection.label;
  return (
    <>
      <Item size="sm">
        <ItemMedia variant="icon">
          <IconBrowser />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{name}</ItemTitle>
          <ItemDescription>
            {connection.via === "openbot-browser"
              ? "Seu navegador OpenBot, conectado "
              : "Conectado "}
            {connectedAt.format(new Date(connection.createdAt))}
            {connection.via === "desktop"
              ? " do OpenBot Desktop"
              : connection.via === "web"
                ? " do OpenBot"
                : ""}
            ,{" "}
            {/* A recording streams to the gateway, not to OpenBot, so its last use lags: it says so instead. */}
            {connection.recording
              ? "gravando agora"
              : connection.lastUsedAt
                ? `último uso ${relativeTime(connection.lastUsedAt)}`
                : "nunca usado"}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            aria-label={`Disconnect ${name}`}
            size="sm"
            variant="ghost"
            disabled={revoke.isPending}
            onClick={() => {
              revoke.reset();
              setAsking(true);
            }}
          >
            {revoke.isPending ? "Desconectando…" : "Desconectar"}
          </Button>
        </ItemActions>
      </Item>
      <Dialog onOpenChange={setAsking} open={asking}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar {connection.label}?</DialogTitle>
          </DialogHeader>
          <DialogBody className="mt-4 text-sm">
            <p>
              O OpenBot desconecta o Recorder em {which} . Ele não grava nada
              para você até ser conectado de novo, e uma gravação em andamento
              lá é interrompida.
            </p>
            {revoke.error ? (
              <p className="mt-2 text-destructive" role="alert">
                {revoke.error.message}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter className="mt-4">
            <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={revoke.isPending}
              onClick={() =>
                revoke.mutate(connection.id, {
                  onSuccess: () => setAsking(false),
                })
              }
            >
              {revoke.isPending ? "Desconectando…" : "Desconectar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
