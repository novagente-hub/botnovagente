/**
 * WHAT A RECORDING HOLDS, in the one set of sentences every place that describes it reads: the Recorder's setup page and
 * Record form, OpenBot's Settings, Browsers (before the first Connect) and its Browser page. A recording is more than the
 * person's clicks and typing: a step that saves something carries the request it sent and the answer that came back
 * (extension/src/background/steps.ts), a page whose AI assistant speaks AG-UI has its conversation recorded, the person's
 * own messages included (extension/src/background/agent/events.ts), and narration is kept as text. Saying less than
 * that would be a disclosure that understates what is collected, which the Chrome Web Store's User Data policy forbids:
 * https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
 *
 * Plain strings rather than markup, so the Recorder's pages and OpenBot's draw them with their own components.
 */

export const RECORDER_DISCLOSURE_TITLE = "O que o Recorder coleta";

/**
 * Where a recording goes, in the one sentence every place that says it reads. The Recorder streams it from the browser
 * straight to the organization's own Intelligence, with a pass the organization's OpenBot hands out for each recording
 * (extension/src/offscreen/grant.ts, streamer.ts); OpenBot itself only hears what the Recorder is doing, for its Browser
 * button (`recorderActivitySchema` in recorder-api.ts: the phase, the recording's name, when it started and how many
 * steps). "Through OpenBot" would say the recording passes through it, which it never does.
 */
export const RECORDER_DESTINATION =
  "O que você grava vai direto do seu navegador para o Intelligence da sua organização, com uma autorização emitida pelo OpenBot da sua organização. O OpenBot só fica sabendo que você está gravando, o nome da tarefa, quando ela começou e quantas etapas tem; e, quando você grava num navegador exibido dentro do OpenBot, sua narração passa por ele até o Recorder sem ser armazenada.";

/** The disclosure's lead: when it records, where it goes, and what for. */
export const RECORDER_DISCLOSURE = `Quando você clica em Gravar, o Recorder grava o que você faz em todas as abas que usar até você parar, e cada aba gravada mostra que está sendo gravada. ${RECORDER_DESTINATION} Suas gravações são usadas apenas para as Skills, avaliações e insights da sua organização.`;

export type RecorderCollectedKind =
  | "steps"
  | "saves"
  | "assistants"
  | "narration"
  | "masking"
  | "sites";

/** Each thing a recording holds, and the two things the person should know about it, in the order a page lists them. */
export const RECORDER_COLLECTS: readonly {
  kind: RecorderCollectedKind;
  title: string;
  description: string;
}[] = [
  {
    kind: "steps",
    title: "Suas etapas",
    description:
      "As páginas que você abre e o que há nelas, além dos seus cliques e do que você digita.",
  },
  {
    kind: "saves",
    title: "O que cada etapa salva",
    description:
      "Numa etapa que salva algo, como um formulário que você envia, a requisição enviada e a resposta recebida.",
  },
  {
    kind: "assistants",
    title: "Conversas com assistentes de IA",
    description:
      "Numa página cujo assistente de IA usa AG-UI, como o próprio chat do OpenBot, a conversa, incluindo as mensagens que você envia.",
  },
  {
    kind: "narration",
    title: "Sua narração",
    description:
      "Com a narração ligada, o que você fala, convertido em texto no seu próprio computador. Sua voz nunca sai dele.",
  },
  /*
   * What the masking takes, as it takes it (recorder-masking.ts, `scrubText` and the secret-field rules, run on every
   * string a recording sends, and the CopilotKit capture's `cleanLabel` for a clicked control's name), and no more: a
   * phone number, a name or an amount is not masked, so it says so.
   */
  {
    kind: "masking",
    title: "Dados sigilosos mascarados antes",
    description:
      "Mascarados no seu navegador antes de qualquer coisa sair dele: senhas, códigos de uso único e tudo o que for digitado em campos sigilosos, números de cartão, endereços de e-mail, chaves e tokens de login. Endereços web também são removidos dos nomes dos botões e links que você clica. Outros dados de uma página ou requisição, como nomes, telefones e valores, ainda podem ser incluídos.",
  },
  {
    kind: "sites",
    title: "Sites que você exclui",
    description:
      "Cada aba gravada mostra que está sendo gravada, com um botão que para de gravar aquele site, agora e em todas as gravações futuras.",
  },
];

/** The same, in one sentence, where there is room for no more: under the Record form's task name. */
export const RECORDER_COLLECTS_SHORT =
  "Grava todas as abas que você usar até parar: as páginas e o que há nelas, seus cliques e o que você digita, o que cada etapa salva, conversas com assistentes de IA e sua narração, quando ligada. Senhas, números de cartão, e-mails e tokens são mascarados antes no seu navegador.";
