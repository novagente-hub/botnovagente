import { expect, test } from "bun:test";
import {
  accessSummary,
  countLabel,
  memorySummary,
  reachSummary,
  setupSummary,
  sharingSummary,
} from "@/lib/agents/bot-summaries";

test("counts read as words", () => {
  expect(countLabel(0, "routine", "routines", "Sem rotinas")).toBe(
    "Sem rotinas",
  );
  expect(countLabel(1, "routine", "routines", "Sem rotinas")).toBe("1 routine");
  expect(countLabel(3, "routine", "routines", "Sem rotinas")).toBe(
    "3 routines",
  );
});

test("access names skills and apps, or says there is nothing", () => {
  expect(accessSummary(0, 0)).toBe("Nada concedido");
  expect(accessSummary(2, 0)).toBe("2 habilidades");
  expect(accessSummary(0, 1)).toBe("1 app");
  expect(accessSummary(1, 3)).toBe("1 habilidade, 3 apps");
});

test("sharing names the audience", () => {
  expect(sharingSummary(undefined, "private")).toBe("Não compartilhado");
  expect(sharingSummary({ audience: "team" }, "private")).toBe("Equipe toda");
  expect(sharingSummary({ audience: "people" }, "private")).toBe(
    "Pessoas e grupos específicos",
  );
});

test("setup names where it runs", () => {
  expect(
    setupSummary({ builtIn: true, endpoint: "http://localhost:4201/ag-ui" }),
  ).toBe("Integrado");
  expect(
    setupSummary({
      builtIn: false,
      endpoint: "https://bots.example.com/ag-ui",
    }),
  ).toBe("bots.example.com");
  expect(setupSummary({ builtIn: false, endpoint: "not a url" })).toBe(
    "not a url",
  );
  expect(setupSummary({ builtIn: false, endpoint: null })).toBe("Integrado");
});

test("a public Bot nobody published is still open to everyone, not 'Not shared'", () => {
  expect(sharingSummary(undefined, "public")).toBe("Todos (público)");
});

test("reach names the places a Bot continues the conversation", () => {
  expect(reachSummary([])).toBe("Só no OpenBot");
  expect(reachSummary(["slack"])).toBe("Slack");
  expect(reachSummary(["sms", "slack", "slack"])).toBe("Slack, SMS");
  expect(reachSummary(["teams"])).toBe("Microsoft Teams");
});

test("memory names the sources and whether research is on", () => {
  expect(memorySummary(0, false)).toBe("Nada conectado");
  expect(memorySummary(2, false)).toBe("2 fontes");
  expect(memorySummary(0, true)).toBe("Pesquisa em segundo plano ativada");
  expect(memorySummary(1, true)).toBe("1 fonte, pesquisa em segundo plano ativada");
});
