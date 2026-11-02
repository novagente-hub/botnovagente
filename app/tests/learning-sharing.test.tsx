import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { PersonalLearningSharing } from "@openbot/shared/learning";
import { environmentManager, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import {
  LearningSharing,
  SHARING_CHOICES,
} from "@/components/settings/learning-sharing";
import { queryClient } from "@/query-client";

let wasServer = true;
beforeAll(() => {
  GlobalRegistrator.register();
  wasServer = environmentManager.isServer();
  environmentManager.setIsServer(() => false);
});
afterAll(() => {
  environmentManager.setIsServer(() => wasServer);
  GlobalRegistrator.unregister();
});

const originalFetch = global.fetch;
let answer: PersonalLearningSharing;
let failRead = false;
let failWrite = false;
const sent: { path: string; method: string; body: unknown }[] = [];

beforeEach(() => {
  queryClient.clear();
  sent.length = 0;
  failRead = false;
  failWrite = false;
  answer = {
    mode: "closed",
    sharingAllowed: true,
    skills: [
      { name: "refund-order", description: "Refunds an order.", open: false },
      { name: "close-ticket", description: "Closes a ticket.", open: true },
    ],
  };
  global.fetch = Object.assign(
    async (path: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(path);
      const method = init?.method ?? "GET";
      if (method === "PUT") {
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        sent.push({ path: url, method, body });
        if (failWrite)
          return Response.json(
            { error: "Your Learning settings could not be saved." },
            { status: 503 },
          );
        if (url === "/api/settings/learning/mode")
          answer = { ...answer, mode: body.mode };
        const skill = /^\/api\/settings\/learning\/skills\/(.+)$/.exec(url);
        if (skill && answer.skills)
          answer = {
            ...answer,
            skills: answer.skills.map((entry) =>
              entry.name === decodeURIComponent(skill[1] ?? "")
                ? { ...entry, open: body.open }
                : entry,
            ),
          };
        return Response.json({ ok: true });
      }
      if (url === "/api/settings/learning") {
        if (failRead) return new Response(null, { status: 500 });
        return Response.json(answer);
      }
      return new Response(null, { status: 404 });
    },
    { preconnect: originalFetch.preconnect },
  );
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

function draw() {
  return render(
    <QueryClientProvider client={queryClient}>
      <LearningSharing />
    </QueryClientProvider>,
  );
}

/** The choice row whose title is `title`: one pressed button of three. */
const choice = (view: ReturnType<typeof draw>, title: string) =>
  choices(view).find((element) =>
    element.textContent?.includes(title),
  ) as HTMLElement;
const choices = (view: ReturnType<typeof draw>) =>
  view
    .getAllByRole("button")
    .filter((element) => element.hasAttribute("aria-pressed"));

test("three choices, each with one plain line saying who sees what", async () => {
  const view = draw();
  await view.findByText("Bots de quem mais usam suas Habilidades");
  expect(choices(view)).toHaveLength(3);
  for (const choice of SHARING_CHOICES) {
    expect(view.getByText(choice.title)).toBeTruthy();
    expect(view.getByText(choice.description)).toBeTruthy();
  }
  expect(
    view.getByText("Só os Bots que você usa aproveitam suas Habilidades."),
  ).toBeTruthy();
  expect(
    view.getByText("Todos os Bots do OpenBot aproveitam todas as suas Habilidades."),
  ).toBeTruthy();
});

test("closed is the default: Only my Bots is checked and no Skill list shows", async () => {
  const view = draw();
  await view.findByText("Só os meus Bots");
  expect(choice(view, "Só os meus Bots").getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(choice(view, "Bots de todos").getAttribute("aria-pressed")).toBe(
    "false",
  );
  expect(view.queryByText("Suas Habilidades")).toBeNull();
  expect(view.queryByRole("switch")).toBeNull();
});

test("choosing Everyone's Bots saves open at once", async () => {
  const view = draw();
  await view.findByText("Só os meus Bots");
  fireEvent.click(choice(view, "Bots de todos"));
  await waitFor(() =>
    expect(sent).toContainEqual({
      path: "/api/settings/learning/mode",
      method: "PUT",
      body: { mode: "open" },
    }),
  );
  await waitFor(() =>
    expect(choice(view, "Bots de todos").getAttribute("aria-pressed")).toBe(
      "true",
    ),
  );
});

test("pressing the choice already made saves nothing", async () => {
  const view = draw();
  await view.findByText("Só os meus Bots");
  fireEvent.click(choice(view, "Só os meus Bots"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(sent).toEqual([]);
});

test("under The Skills I choose, each Skill in your space has a switch that opens it to everyone", async () => {
  answer = { ...answer, mode: "choose" };
  const view = draw();
  await view.findByText("Suas Habilidades");
  const refund = view.getByRole("switch", {
    name: "Abrir refund-order para todos",
  });
  const close = view.getByRole("switch", {
    name: "Open close-ticket to everyone",
  });
  expect(refund.getAttribute("aria-checked")).toBe("false");
  expect(close.getAttribute("aria-checked")).toBe("true");
  expect(
    view.getByText(/Only your Bots use it\. Refunds an order\./),
  ).toBeTruthy();
  expect(
    view.getByText(/Every Bot may use it\. Closes a ticket\./),
  ).toBeTruthy();
  fireEvent.click(refund);
  await waitFor(() =>
    expect(sent).toContainEqual({
      path: "/api/settings/learning/skills/refund-order",
      method: "PUT",
      body: { open: true },
    }),
  );
  await waitFor(() =>
    expect(
      view
        .getByRole("switch", { name: "Abrir refund-order para todos" })
        .getAttribute("aria-checked"),
    ).toBe("true"),
  );
});

test("a space with no Skills yet says so plainly", async () => {
  answer = { mode: "choose", sharingAllowed: true, skills: [] };
  const view = draw();
  await view.findByText(
    "Nenhuma Habilidade aprendida com suas gravações ainda. Quando houver, cada uma que você abrir aqui chega a todos os Bots.",
  );
  expect(view.queryByRole("switch")).toBeNull();
});

test("Skills Intelligence did not deliver show a plain unavailable line, and the choice still works", async () => {
  answer = {
    mode: "choose",
    sharingAllowed: true,
    skills: null,
    unavailable: "unavailable",
  };
  const view = draw();
  await view.findByText(
    "Não foi possível ler suas Habilidades do Intelligence agora. Sua escolha acima continua valendo para elas.",
  );
  fireEvent.click(choice(view, "Só os meus Bots"));
  await waitFor(() =>
    expect(sent).toContainEqual({
      path: "/api/settings/learning/mode",
      method: "PUT",
      body: { mode: "closed" },
    }),
  );
});

test("Automatic Learning off says no Skills are learned", async () => {
  answer = {
    mode: "choose",
    sharingAllowed: true,
    skills: null,
    unavailable: "off",
  };
  const view = draw();
  await view.findByText(
    "Um administrador desativou o Aprendizado automático, então nenhuma Habilidade é aprendida com suas gravações.",
  );
});

test("until an admin turns on Skill sharing, it says so plainly and only Only my Bots can be chosen", async () => {
  answer = { ...answer, sharingAllowed: false };
  const view = draw();
  await view.findByText(
    "Um administrador não ativou o compartilhamento de Habilidades com todos os Bots, então só os Bots que você usa aproveitam as suas.",
  );
  expect(choice(view, "Só os meus Bots").hasAttribute("disabled")).toBe(false);
  for (const title of ["Bots de todos", "As Habilidades que eu escolher"]) {
    expect(choice(view, title).hasAttribute("disabled")).toBe(true);
    fireEvent.click(choice(view, title));
  }
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(sent).toEqual([]);
});

test("a choice made before sharing was turned off says it applies again, and an open Skill can be closed but none opened", async () => {
  answer = { ...answer, mode: "choose", sharingAllowed: false };
  const view = draw();
  await view.findByText(
    "Um administrador não ativou o compartilhamento de Habilidades com todos os Bots, então só os Bots que você usa aproveitam as suas. Your choice below applies again if an admin turns it on.",
  );
  const refund = view.getByRole("switch", {
    name: "Abrir refund-order para todos",
  });
  const close = view.getByRole("switch", {
    name: "Open close-ticket to everyone",
  });
  expect(refund.hasAttribute("data-disabled")).toBe(true);
  expect(close.hasAttribute("data-disabled")).toBe(false);
  fireEvent.click(refund);
  fireEvent.click(close);
  await waitFor(() =>
    expect(sent).toEqual([
      {
        path: "/api/settings/learning/skills/close-ticket",
        method: "PUT",
        body: { open: false },
      },
    ]),
  );
});

test("a read that fails says so, and a save that fails says why", async () => {
  failRead = true;
  const failed = draw();
  await failed.findByText(
    "Não foi possível carregar suas configurações de Aprendizado. Recarregue a página.",
  );
  cleanup();
  queryClient.clear();
  failRead = false;
  failWrite = true;
  const view = draw();
  await view.findByText("Só os meus Bots");
  fireEvent.click(choice(view, "Bots de todos"));
  await view.findByText("Your Learning settings could not be saved.");
});
