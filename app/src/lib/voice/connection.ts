import type { ConnectVoice } from "./types";
import { connectWebRtc } from "./webrtc";
import { connectWebSocket } from "./websocket";

export function voiceSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export const connectVoice: ConnectVoice = async (options) => {
  if (!voiceSupported())
    throw new Error(
      "Chamadas de voz exigem um navegador compatível e HTTPS ou localhost.",
    );
  const response = await fetch("/api/voice/config", {
    credentials: "include",
    signal: options.signal,
  });
  if (!response.ok)
    throw new Error(
      "Chamadas de voz indisponíveis. Verifique a configuração de voz da implantação.",
    );
  const config: unknown = await response.json();
  if (config && typeof config === "object" && "transport" in config) {
    if (config.transport === "webrtc") return connectWebRtc(options);
    if (config.transport === "websocket") return connectWebSocket(options);
  }
  throw new Error("Esta implantação usa uma conexão de voz não compatível.");
};
