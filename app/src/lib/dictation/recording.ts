import {
  DICTATION_TIMEOUT_MS,
  dictationExtension,
  dictationMediaType,
  MAX_DICTATION_BYTES,
} from "@openbot/shared/dictation";

export interface Recording {
  /** Shared with the visualizer; the recorder owns this stream's lifetime. */
  readonly stream?: MediaStream;
  finish(): Promise<Blob>;
  cancel(): void;
}

export function recordingSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export async function startRecording(
  onError: (error: Error) => void,
): Promise<Recording> {
  if (!recordingSupported())
    throw new Error(
      "O ditado exige um navegador compatível e HTTPS (ou localhost).",
    );
  const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
    (type) => MediaRecorder.isTypeSupported(type),
  );
  if (!mimeType)
    throw new Error(
      "Este navegador não consegue gravar em um formato de áudio compatível.",
    );
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const release = () => {
    for (const track of stream.getTracks()) track.stop();
  };
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType });
  } catch (error) {
    release();
    throw error;
  }
  let chunks: Blob[] = [];
  let size = 0;
  let done: ReturnType<typeof Promise.withResolvers<Blob>> | undefined;
  const cancel = () => {
    recorder.ondataavailable = null;
    recorder.onstop = null;
    recorder.onerror = null;
    if (recorder.state !== "inactive") recorder.stop();
    release();
    chunks = [];
    done?.reject(new DOMException("Gravação cancelada", "AbortError"));
  };
  recorder.ondataavailable = (event) => {
    size += event.data.size;
    if (size > MAX_DICTATION_BYTES) {
      cancel();
      onError(
        new Error("A gravação é grande demais. Tente uma mensagem mais curta."),
      );
      return;
    }
    if (event.data.size) chunks.push(event.data);
  };
  recorder.onerror = () => {
    cancel();
    onError(new Error("O microfone parou de gravar. Tente novamente."));
  };
  recorder.onstop = () => {
    release();
    if (!done) {
      onError(new Error("A gravação foi interrompida. Tente novamente."));
      return;
    }
    done.resolve(
      new Blob(chunks, { type: dictationMediaType(recorder.mimeType) }),
    );
    chunks = [];
  };
  try {
    recorder.start(250);
  } catch (error) {
    cancel();
    throw error;
  }
  return {
    stream,
    cancel,
    finish() {
      if (done) return done.promise;
      done = Promise.withResolvers<Blob>();
      if (recorder.state === "inactive") {
        release();
        done.reject(new Error("A gravação parou antes de capturar o áudio."));
      } else {
        recorder.stop();
        release();
      }
      return done.promise;
    },
  };
}

export async function transcribeRecording(
  audio: Blob,
  signal: AbortSignal,
): Promise<string> {
  const type = dictationMediaType(audio.type);
  const extension = dictationExtension(type);
  if (!extension || !audio.size || audio.size > MAX_DICTATION_BYTES) {
    throw new Error(
      "A gravação está vazia ou não é compatível. Grave novamente.",
    );
  }
  const body = new FormData();
  body.set("file", audio, `recording.${extension}`);
  const response = await fetch("/api/audio/transcriptions", {
    method: "POST",
    credentials: "include",
    headers: { "x-openbot-dictation": "1" },
    body,
    signal: AbortSignal.any([
      signal,
      AbortSignal.timeout(DICTATION_TIMEOUT_MS + 5_000),
    ]),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      result &&
        typeof result === "object" &&
        "error" in result &&
        typeof result.error === "string"
        ? result.error
        : "A transcrição falhou. Tente novamente.",
    );
  }
  if (
    !result ||
    typeof result !== "object" ||
    !("text" in result) ||
    typeof result.text !== "string" ||
    !result.text.trim()
  ) {
    throw new Error("Nenhuma fala foi detectada. Tente gravar novamente.");
  }
  return result.text.trim();
}
