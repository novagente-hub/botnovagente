import { IconDownload, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { isStandalonePwa, mobileInstallInstructions } from "@/lib/pwa";

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

/**
 * Mobile-only install entry. The native prompt is optional: iOS Safari and
 * unsupported Android browsers receive specific manual instructions.
 */
export function PwaInstallBar() {
  const [installed, setInstalled] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null,
  );
  const [showInstructions, setShowInstructions] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInstalled(
      isStandalonePwa(
        window.matchMedia.bind(window),
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      ),
    );
    // A failed SW installation cannot prevent login or chat from loading.
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const appInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setShowInstructions(false);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  if (installed || dismissed) return null;

  async function install() {
    if (!promptEvent) {
      setShowInstructions(true);
      return;
    }
    setBusy(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice.outcome !== "accepted") setShowInstructions(true);
    } catch {
      setShowInstructions(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      aria-label="Instalar aplicativo NovaBot"
      className="z-20 flex shrink-0 flex-col gap-2 border-b border-blue-500/30 bg-[#101d34] px-3 py-2 text-white sm:hidden"
    >
      <div className="flex items-center gap-2">
        <img
          src="/icons/novabot-192.png"
          alt=""
          aria-hidden="true"
          className="size-8 rounded-lg"
        />
        <span className="min-w-0 flex-1 text-xs leading-snug">
          <strong className="block">NovaBot no seu celular</strong>
          Acesse com um toque, pela tela inicial.
        </span>
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#1E7BFF] px-3 text-xs font-semibold text-white disabled:opacity-50"
          disabled={busy}
          onClick={() => void install()}
        >
          <IconDownload className="size-4" aria-hidden="true" />
          Instalar
        </button>
        <button
          type="button"
          aria-label="Fechar aviso de instalação"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white/70"
          onClick={() => setDismissed(true)}
        >
          <IconX className="size-4" aria-hidden="true" />
        </button>
      </div>
      {showInstructions ? (
        <p
          role="status"
          className="rounded-lg bg-white/10 px-3 py-2 text-xs leading-relaxed"
        >
          {mobileInstallInstructions(navigator.userAgent)}
          <span className="block pt-1 text-white/75">
            Para abrir o NovaBot privado, seu celular precisa estar conectado à
            Tailscale.
          </span>
        </p>
      ) : null}
    </aside>
  );
}
