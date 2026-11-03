import type { LauncherState } from "@openbot/shared/openbot-browser";
import { IconMicrophone, IconMicrophoneOff } from "@tabler/icons-react";
import { useId } from "react";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import type { NarrationProblem } from "@/lib/browser/narration";
import type { NarrationChoice } from "./narration-choice";
import type { NarrationControls } from "./use-narration";

const GOES_ON = "A gravação continua funcionando.";

function languageName(language: string): string {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "language" }).of(language) ??
      language
    );
  } catch {
    return language;
  }
}

/** What the person is told when narration did not reach the Recorder: the server's own sentence for why, when it said
 * one, since that is what they can act on. */
function lostNarrationSentence(error: string | null): string {
  return error
    ? `Parte do que você disse não chegou ao Recorder. ${error}`
    : `Parte do que você disse não chegou ao Recorder. ${GOES_ON}`;
}

/** Why narration is off, and what the person can do about it, in one or two short sentences. */
export function narrationProblemSentence(
  problem: NarrationProblem,
  language: string,
): string {
  switch (problem) {
    case "unsupported":
      return `A narração não está disponível neste navegador, então o que você diz não é gravado. ${GOES_ON}`;
    case "on-device":
      return `Este navegador não consegue transformar fala em texto no seu computador, e o OpenBot não envia sua voz para nenhum outro lugar, então a narração está desativada. ${GOES_ON}`;
    case "speech-pack":
      return `Seu navegador precisa primeiro baixar o reconhecimento de fala em ${languageName(language)} para o seu computador. Ative a narração para baixá-lo. ${GOES_ON}`;
    case "not-allowed":
      return `O OpenBot não consegue usar seu microfone, então a narração está desativada. Permita o microfone para este site e ative a narração de novo. ${GOES_ON}`;
    case "no-microphone":
      return `Nenhum microfone foi encontrado, ou outro app está usando. ${GOES_ON}`;
    case "service":
      return `O reconhecimento de fala deste navegador está desativado ou indisponível, então a narração está desativada. ${GOES_ON}`;
    case "language":
      return `Este navegador não consegue transformar fala em ${languageName(language)} em texto no seu computador, então a narração está desativada. ${GOES_ON}`;
    case "network":
      return "Não é possível acessar o serviço de fala deste navegador. A narração tenta de novo em instantes.";
  }
}

/** What the person is told while their browser downloads the narration's language: narration starts by itself. */
export function downloadingSentence(language: string): string {
  return `Seu navegador está baixando o reconhecimento de fala em ${languageName(language)} para o seu computador. A narração começa quando estiver pronto.`;
}

/** What the Desktop narration row says, from the Recorder's own report of whether it hears the person. */
function nativeNarrationSentence(voice: LauncherState["voice"]): string {
  switch (voice) {
    case "listening":
      return "Ouvindo. Diga o que está fazendo enquanto faz.";
    case "muted":
      return "Silenciado no Recorder, então o que você diz não é gravado. Ative de novo pelo botão do Recorder na barra de ferramentas do navegador.";
    case "unavailable":
      return `O Recorder não consegue ouvir seu microfone, então o que você diz não é gravado. O botão do Recorder na barra de ferramentas do navegador diz o motivo. ${GOES_ON}`;
    // Nothing is being recorded yet, or the Recorder has not said.
    default:
      return "Ativada. O Recorder ouve seu microfone enquanto você grava, então diga o que está fazendo enquanto faz.";
  }
}

/** The narration row on OpenBot Desktop while nothing records: the person's choice, which the next Record passes on. */
function narrationChoiceSentence(
  narration: Exclude<NarrationChoice["narration"], undefined>,
) {
  switch (narration) {
    case "on":
      return "Ativada. O Recorder no seu navegador ouve seu microfone enquanto você grava e transforma sua fala em texto no seu computador.";
    case "off":
      return "Desativada. O Recorder não abre seu microfone.";
    case null:
      return "Ainda não escolhido. Gravar pergunta antes da sua primeira gravação, e o microfone fica fechado até você dizer sim.";
  }
}

/**
 * The narration row on OpenBot Desktop. While nothing records it is the person's choice, a switch that takes effect at
 * once: the next Record tells the Recorder in their browser whether to open the microphone. While a recording runs, the
 * Recorder hears the microphone itself, so the row says what it reports, read every second with the rest of the
 * browser's state, so a microphone that is muted or cannot be heard shows here while the person records.
 */
export function NativeNarrationRow({
  voice,
  choice,
  recording,
}: {
  voice: LauncherState["voice"];
  choice: NarrationChoice;
  /** A recording is running (or starting, or stopping). */
  recording: boolean;
}) {
  if (!recording) {
    const on = choice.narration === "on";
    // Not known yet (the preferences still loading, or unreadable): nothing said, and nothing to switch.
    const known = choice.narration !== undefined;
    return (
      <Item size="sm">
        <ItemMedia variant="icon">
          {on ? <IconMicrophone /> : <IconMicrophoneOff />}
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Narração</ItemTitle>
          {choice.narration !== undefined ? (
            <ItemDescription className="line-clamp-none">
              {narrationChoiceSentence(choice.narration)}
            </ItemDescription>
          ) : null}
        </ItemContent>
        <ItemActions>
          <Switch
            aria-label="Narração"
            checked={on}
            disabled={!known}
            onCheckedChange={choice.choose}
          />
        </ItemActions>
      </Item>
    );
  }
  const hearing = voice !== "muted" && voice !== "unavailable";
  return (
    <Item size="sm">
      <ItemMedia variant="icon">
        {hearing ? <IconMicrophone /> : <IconMicrophoneOff />}
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Narração</ItemTitle>
        <ItemDescription className="line-clamp-none">
          {voice === "listening" ? (
            <span className="inline-flex items-center gap-1.5">
              {/* Decorative: the word beside it says it is live. */}
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-emerald-500 motion-safe:animate-pulse"
              />
              {nativeNarrationSentence(voice)}
            </span>
          ) : (
            nativeNarrationSentence(voice)
          )}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}

/**
 * Narration on and off, for the bar above a browser shown in the page. A switch, because it takes effect at once:
 * off stops listening after the phrase being said, on listens again (and tries again after a failure). It is the
 * person's choice, so `onChange` keeps it as well. It shows the state narration is in, so a narration that failed reads
 * off, as the notice under the bar says; while a recording runs and the page hears the person, it says Listening beside
 * it, so an open microphone is never something to guess at.
 */
export function NarrationSwitch({
  narration,
  recording,
  onChange,
}: {
  narration: NarrationControls;
  /** A recording is running: the switch says whether the page is listening now. */
  recording: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  const labelId = useId();
  if (!narration.supported) return null;
  const on = narration.on;
  const listening = recording && narration.status?.state === "listening";
  const Icon = on ? IconMicrophone : IconMicrophoneOff;
  return (
    <span className="flex shrink-0 items-center gap-2 text-sm">
      {listening ? (
        <span
          className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
          role="status"
        >
          {/* Decorative: the word beside it says it is live. */}
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-emerald-500 motion-safe:animate-pulse"
          />
          Ouvindo
        </span>
      ) : null}
      <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      <label htmlFor={id} id={labelId} className="text-muted-foreground">
        Narração
      </label>
      {/* Named by the label's id as well: the switch is a span with role="switch", which `htmlFor` cannot name. */}
      <Switch
        aria-labelledby={labelId}
        id={id}
        checked={on}
        onCheckedChange={onChange}
      />
    </span>
  );
}

/**
 * What the person needs to know about narration on a screen, as a line under the bar, or nothing when it is simply on
 * or off as they set it. Shown before a recording too where the browser has no speech recognition at all, so nobody
 * narrates a whole task to find out afterwards.
 */
export function NarrationNotice({
  narration,
  language,
}: {
  narration: NarrationControls;
  language: string;
}) {
  const sentence = narrationNoticeSentence(narration, language);
  if (!sentence) return null;
  return (
    <p
      className="border-b border-border bg-muted/40 px-3 py-2 text-muted-foreground text-sm"
      role="status"
    >
      {sentence}
    </p>
  );
}

/**
 * What the person needs to know about narration, or null when it is simply on or off as they set it. `lost` is whether
 * to say that some of it did not reach the Recorder.
 */
function narrationNoticeSentence(
  narration: NarrationControls,
  language: string,
  lost = true,
): string | null {
  return !narration.supported
    ? narrationProblemSentence("unsupported", language)
    : narration.status?.state === "failed"
      ? narrationProblemSentence(narration.status.problem, language)
      : narration.status?.state === "downloading"
        ? downloadingSentence(language)
        : lost && narration.lost
          ? lostNarrationSentence(narration.lost.error)
          : null;
}

/**
 * Narration as a row, for a card of rows under a browser shown in the page (a Bot's screen): the same switch, the same
 * choice and the same sentences as the bar above the person's own browser, laid out as every other setting is. The row
 * always says what narration does, so a person deciding whether to talk knows before Record whether it is heard, and
 * how; and while the page hears them it says Listening, so an open microphone is never something to guess at.
 *
 * `choice` is the person's preference (`useNarrationChoice`), null until they answered the question Record asks first.
 * `onChange` keeps a new one, as the bar's switch does.
 *
 * `recording` is whether the person's recording is running. Narration that did not reach the Recorder is news only
 * then: a phrase cut off as the wheel went back was refused because the recording had already ended, which the
 * recording's own row says, and the row must not still be saying it when they take the wheel again.
 */
export function NarrationRow({
  narration,
  choice,
  language,
  recording,
  onChange,
}: {
  narration: NarrationControls;
  choice: NarrationChoice["narration"];
  language: string;
  recording: boolean;
  onChange: (on: boolean) => void;
}) {
  const labelId = useId();
  const notice = narrationNoticeSentence(narration, language, recording);
  const listening =
    !notice && recording && narration.status?.state === "listening";
  const sentence =
    notice ??
    (listening
      ? "Ouvindo. Diga o que está fazendo enquanto faz."
      : narration.on
        ? "Ativada. O OpenBot ouve seu microfone enquanto você grava e transforma sua fala em texto no seu computador, então diga o que está fazendo enquanto faz."
        : choice === null
          ? "Ainda não escolhido. Gravar pergunta antes da sua primeira gravação, e o microfone fica fechado até você dizer sim."
          : "Desativada. O que você diz não é gravado.");
  return (
    <Item size="sm">
      <ItemMedia variant="icon">
        {narration.supported && narration.on ? (
          <IconMicrophone />
        ) : (
          <IconMicrophoneOff />
        )}
      </ItemMedia>
      <ItemContent>
        <ItemTitle id={labelId}>Narração</ItemTitle>
        <ItemDescription className="line-clamp-none" role="status">
          {listening ? (
            <span className="inline-flex items-center gap-1.5">
              {/* Decorative: the word beside it says it is live. */}
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-emerald-500 motion-safe:animate-pulse"
              />
              {sentence}
            </span>
          ) : (
            sentence
          )}
        </ItemDescription>
      </ItemContent>
      {narration.supported ? (
        <ItemActions>
          <Switch
            aria-labelledby={labelId}
            checked={narration.on}
            onCheckedChange={onChange}
          />
        </ItemActions>
      ) : null}
    </Item>
  );
}
