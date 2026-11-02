import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, within } from "@testing-library/react";
import { AccessSections } from "@/components/bot-profile/access";
import type { AgentProfile } from "@/lib/agents/queries";
import type { AppAccess } from "@/lib/app-access/queries";
import { appAccess } from "./app-access-fixture";
import { settleReactWork } from "./settle-react-work";

/**
 * The Granted section of a Bot's page, which used to list what a Bot holds and say nothing about
 * whether the person reading could use any of it.
 *
 * Each app is named by its own name — never "Composio Gmail" — and says what it is for the person
 * looking, with the one move they have. An admin keeps the way to the Bot's grants for each
 * app; nobody gets anybody else's connection state, because the read answers for the asker alone.
 */

beforeAll(() => GlobalRegistrator.register());
afterEach(cleanup);
afterAll(async () => {
  await settleReactWork();
  GlobalRegistrator.unregister();
});

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

const BOT: AgentProfile = {
  id: "expenses",
  name: "Expenses",
  title: "Finance",
  roleDescription: "Receipts.",
  avatarSeed: "e",
  visibility: "public",
  endpoint: null,
  builtIn: true,
  hasAuth: false,
  hasCallbackToken: false,
  isolated: false,
  isolationActive: false,
  isolationOffReason: null,
  hidden: false,
  pinned: false,
  systemOwned: false,
  canManage: false,
  mine: false,
};

const tool = (ref: string, toolName: string) => ({
  ref,
  toolName,
  description: "",
  inputSchema: {},
});

function serving(options: {
  role?: "admin" | "user";
  apps?: AppAccess[] | "fail";
  tools?: ReturnType<typeof tool>[];
}) {
  const { role = "user", apps = [], tools = [] } = options;
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/plugins/for/expenses/apps"))
      return apps === "fail"
        ? Response.json({ error: "nope" }, { status: 500 })
        : Response.json({ apps });
    if (url.endsWith("/api/plugins/for/expenses"))
      return Response.json({ tools, skills: [] });
    if (url.includes("/handoff"))
      return Response.json({
        handoff: {
          enabled: false,
          canGrant: false,
          reachable: [],
          grantable: false,
        },
      });
    if (url.includes("/api/agents")) return Response.json({ agents: [] });
    return Response.json({
      user: { id: "me", role, email: "me@example.test", name: "Me" },
    });
  }) as unknown as typeof fetch;
}

function draw() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const root = createRootRoute({ component: Outlet });
  const page = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <AccessSections agent={BOT} />,
  });
  const grants = createRoute({
    getParentRoute: () => root,
    path: "/admin/plugins/$key/bots/$agentId",
    component: () => null,
  });
  const settings = createRoute({
    getParentRoute: () => root,
    path: "/connections/$key",
    component: () => null,
  });
  const router = createRouter({
    routeTree: root.addChildren([page, grants, settings]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );
}

const row = async (view: ReturnType<typeof draw>, key: string) => {
  await view.findByText("O que ele pode usar");
  const found = await view.findByText((_, element) =>
    Boolean(element?.getAttribute("data-app") === key),
  );
  return within(found);
};

test("each app is named by its own name and says it is ready, with its tools", async () => {
  serving({
    apps: [appAccess()],
    tools: [
      tool(
        "composio-gmail/GMAIL_SEND_EMAIL",
        "mcp__composio-gmail__GMAIL_SEND_EMAIL",
      ),
      tool(
        "composio-gmail/GMAIL_FETCH_EMAILS",
        "mcp__composio-gmail__GMAIL_FETCH_EMAILS",
      ),
    ],
  });
  const view = draw();
  const gmail = await row(view, "composio-gmail");
  expect(gmail.getByText("Gmail")).toBeTruthy();
  expect(gmail.getByText(/^Pronto para usar\./)).toBeTruthy();
  expect(gmail.getByText("2 ferramentas")).toBeTruthy();
  expect(view.queryByText(/Composio Gmail/)).toBeNull();
  expect(gmail.queryByRole("button")).toBeNull();
});

test("an app this person has not connected says so and offers Connect", async () => {
  serving({ apps: [appAccess({ state: "not_connected" })] });
  const gmail = await row(draw(), "composio-gmail");
  expect(
    gmail.getByText("Você ainda não conectou sua conta Gmail."),
  ).toBeTruthy();
  expect(gmail.getByRole("button", { name: "Conectar Gmail" })).toBeTruthy();
});

test("an app only an admin can fix offers Request access, and a pending one reads Requested", async () => {
  serving({
    apps: [
      appAccess({
        key: "composio-slack",
        displayName: "Slack",
        state: "shared_not_connected",
        account: "shared",
        accountMode: "shared",
        requestKind: "connect_shared",
      }),
      appAccess({
        key: "notion",
        displayName: "Notion",
        provider: "catalogue",
        state: "disabled",
        requestKind: "enable",
        request: {
          id: "req_1",
          kind: "enable",
          createdAt: "2026-10-20T10:00:00.000Z",
        },
      }),
    ],
  });
  const view = draw();
  const slack = await row(view, "composio-slack");
  expect(
    slack.getByText(
      "A conta Slack da sua organização ainda não está conectada. Só um administrador pode conectá-la.",
    ),
  ).toBeTruthy();
  expect(
    slack.getByRole("button", { name: "Request access to Slack" }),
  ).toBeTruthy();
  const notion = await row(view, "notion");
  expect(
    notion.getByText(
      "Notion isn't turned on yet. Only an admin can turn it on.",
    ),
  ).toBeTruthy();
  expect(notion.getByText("Solicitado")).toBeTruthy();
  expect(
    notion.getByRole("button", { name: "Withdraw request for Notion" }),
  ).toBeTruthy();
});

test("an admin keeps the way to this Bot's grants on each app, beside the action", async () => {
  serving({ role: "admin", apps: [appAccess({ state: "not_connected" })] });
  const gmail = await row(draw(), "composio-gmail");
  const manage = gmail.getByRole("button", {
    name: "Gerenciar Gmail neste Bot",
  });
  expect(manage.getAttribute("href")).toBe(
    "/admin/plugins/composio-gmail/bots/expenses",
  );
  expect(gmail.getByRole("button", { name: "Conectar Gmail" })).toBeTruthy();
});

test("an app's sentence is never cut short, so who can fix it stays on screen at a phone's width", async () => {
  serving({
    apps: [
      appAccess({
        state: "disabled",
        unavailable: "composio_unconfigured",
        requestKind: "enable",
      }),
    ],
  });
  const gmail = await row(draw(), "composio-gmail");
  const sentence = gmail.getByText(
    "Gmail ainda não está configurado. Um administrador precisa ativá-lo.",
  );
  expect(sentence.className).toContain("line-clamp-none");
  expect(sentence.className).not.toContain("line-clamp-2");
});

test("on somebody else's Team Bot, an app on its owner's account says so, and an owner's reconnection offers nothing", async () => {
  serving({
    apps: [
      appAccess({ accountHolder: "owner" }),
      appAccess({
        key: "notion",
        displayName: "Notion",
        provider: "catalogue",
        connect: "oauth",
        state: "reconnect",
        accountHolder: "owner",
      }),
    ],
  });
  const view = draw();
  const gmail = await row(view, "composio-gmail");
  expect(
    gmail.getByText(
      /^Pronto para usar\. Este Bot usa a conta Gmail do dono\./,
    ),
  ).toBeTruthy();
  const notion = await row(view, "notion");
  expect(
    notion.getByText(
      "This Bot uses its owner's Notion account, which needs reconnecting. Only the Bot's owner can reconnect it.",
    ),
  ).toBeTruthy();
  expect(notion.queryByRole("button")).toBeNull();
});

test("a person who is not an admin gets no way to the grants", async () => {
  serving({ apps: [appAccess()] });
  const gmail = await row(draw(), "composio-gmail");
  expect(gmail.queryByRole("button", { name: /Gerenciar/ })).toBeNull();
});

test("when the states cannot be read, the apps are still listed and the failure is said", async () => {
  serving({
    apps: "fail",
    tools: [
      tool("google-drive/search_files", "mcp__google-drive__search_files"),
    ],
  });
  const view = draw();
  expect((await view.findByRole("alert")).textContent).toContain(
    "Não foi possível verificar se cada app está pronto para você. Recarregue a página.",
  );
  expect(await view.findByText("Google Drive")).toBeTruthy();
});
