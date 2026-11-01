import {
  afterAll,
  afterEach,
  beforeAll,
  expect,
  test,
} from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render } from "@testing-library/react";
import { BotDirectory } from "@/components/app-sidebar/bot-directory";
import { type AgentProfile, agentKeys } from "@/lib/agents/queries";
import type { ChannelSummary } from "@/lib/channels/queries";

beforeAll(() => GlobalRegistrator.register());
afterEach(cleanup);
afterAll(() => GlobalRegistrator.unregister());

function bot(id: string, name: string): AgentProfile {
  return {
    id,
    name,
    title: name,
    roleDescription: "Agente especializado",
    avatarSeed: id,
    visibility: "private",
    endpoint: null,
    builtIn: false,
    hasAuth: false,
    hasCallbackToken: false,
    isolated: false,
    isolationActive: false,
    isolationOffReason: null,
    hidden: false,
    pinned: false,
    systemOwned: false,
    canManage: true,
    mine: true,
  };
}

function channel(
  id: string,
  agentId: string,
  lastMessage: string,
  createdAt: string,
): ChannelSummary {
  return {
    id,
    name: "Conversa",
    agentIds: [agentId],
    threadId: id,
    active: true,
    lastMessageAt: createdAt,
    summary: null,
    lastMessage,
    lastMessageAgentId: agentId,
    createdAt,
    pinned: false,
    lastReadAt: null,
  };
}

function fixture(search = "") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(agentKeys.list(false), [
    bot("jojo", "Jojo"),
    bot("nova-midia", "NovaMídia"),
    bot("analista", "Analista"),
  ]);
  const channels = [
    channel("old", "jojo", "Mensagem antiga", "2026-10-01T12:00:00.000Z"),
    channel("recent-jojo", "jojo", "Último relatório da Jojo", "2026-11-01T12:00:00.000Z"),
    channel("media", "nova-midia", "Campanha revisada", "2026-11-01T11:00:00.000Z"),
  ];
  const root = createRootRoute({
    component: () => <BotDirectory channels={channels} search={search} />,
  });
  const channelRoute = createRoute({
    getParentRoute: () => root,
    path: "/channel/$channelId",
    component: () => null,
  });
  const newRoute = createRoute({
    getParentRoute: () => root,
    path: "/channel/new",
    component: () => null,
  });
  const botsRoute = createRoute({
    getParentRoute: () => root,
    path: "/bots",
    component: () => null,
  });
  const router = createRouter({
    routeTree: root.addChildren([channelRoute, newRoute, botsRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );
}

test("the agent directory shows one row per Bot, not one row per conversation", async () => {
  const view = fixture();
  expect((await view.findAllByText("Jojo")).length).toBeGreaterThan(0);
  expect(view.getAllByTitle("Abrir conversa com Jojo")).toHaveLength(1);
  expect(view.queryByText("Mensagem antiga")).toBeNull();
  expect(view.getByText("Último relatório da Jojo")).toBeTruthy();
  expect(view.getByText("Campanha revisada")).toBeTruthy();
});

test("a Bot with history resumes the latest channel; one without history opens a new chat", async () => {
  const view = fixture();
  const resume = await view.findByTitle("Abrir conversa com Jojo");
  expect(resume.getAttribute("href")).toBe("/channel/recent-jojo");
  const newChat = view.getByTitle("Começar conversa com Analista");
  expect(newChat.getAttribute("href")).toContain("/channel/new");
  expect(newChat.getAttribute("href")).toContain("analista");
});

test("search filters Bots and their last message preview, without exposing old threads", async () => {
  const view = fixture("campanha");
  expect(await view.findByText("Campanha revisada")).toBeTruthy();
  expect(view.queryByTitle("Abrir conversa com Jojo")).toBeNull();
  expect(view.getByTitle("Abrir conversa com NovaMídia")).toBeTruthy();
});
