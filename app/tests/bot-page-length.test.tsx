import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  activitySummary,
  BotActivityGlance,
} from "@/components/bot-profile/activity";
import { SuggestionsInbox } from "@/components/suggestions/proactive-panel";
import type { ActivityItem, BotActivity } from "@/lib/bot-lifecycle/queries";
import { settleReactWork } from "./settle-react-work";

/**
 * A Bot's page stays short enough to reach its settings: what it is running and has scheduled shows
 * at a glance with the full lists on a page of their own, and its suggestions show the newest few
 * with the rest folded away.
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

const items = (count: number, name = "Item", needsYou = false) =>
  Array.from(
    { length: count },
    (_, index) =>
      ({
        id: `${name}-${index}`,
        kind: "routine",
        title: `${name} ${index + 1}`,
        detail: null,
        status: "running",
        at: "2026-10-09T10:00:00Z",
        channelId: null,
        needsYou,
        stoppable: false,
        cancellable: false,
      }) as ActivityItem,
  );
const activity = (inProgress: number, scheduled: number, completed: number) =>
  ({
    inProgress: items(inProgress),
    scheduled: items(scheduled),
    completed: items(completed),
  }) as BotActivity;

test("the activity row counts what is running and what is lined up", () => {
  expect(activitySummary(activity(2, 3, 9))).toBe(
    "2 em andamento · 3 agendado(s)",
  );
  expect(activitySummary(activity(0, 1, 0))).toBe("1 scheduled");
  expect(activitySummary(activity(0, 0, 4))).toBe(
    "Nada em execução ou agendado",
  );
  expect(activitySummary(activity(0, 0, 0))).toBe("Nada ainda");
});

test("the newest three suggestions show, and the rest open in place", async () => {
  global.fetch = (async (input: RequestInfo | URL) => {
    if (String(input) === "/api/proactive/suggestions")
      return Response.json({
        suggestions: Array.from({ length: 5 }, (_, index) => ({
          id: `s${index}`,
          agentId: "scout",
          title: `Suggestion ${index + 1}`,
          detail: "",
          sourceApp: null,
          sourceLink: null,
          createdAt: "2026-10-09T10:00:00Z",
        })),
      });
    return Response.json({ error: "unexpected" }, { status: 404 });
  }) as typeof fetch;
  const view = render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SuggestionsInbox agentId="scout" />
    </QueryClientProvider>,
  );

  expect(await view.findByText("Suggestion 3")).toBeTruthy();
  expect(view.queryByText("Suggestion 4")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Show 2 more" }));
  expect(view.getByText("Suggestion 5")).toBeTruthy();
  expect(view.queryByRole("button", { name: /more$/ })).toBeNull();
});

function glance(data: BotActivity) {
  global.fetch = (async (input: RequestInfo | URL) =>
    String(input).endsWith("/activity")
      ? Response.json({ activity: data })
      : Response.json(
          { error: "unexpected" },
          { status: 404 },
        )) as typeof fetch;
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <BotActivityGlance agentId="scout" />,
    }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );
}

test("running and scheduled work shows on the Bot's page, running first, three at most", async () => {
  const view = glance({
    inProgress: items(2, "Executando", true),
    scheduled: items(3, "Agendada"),
    completed: items(9, "Concluído"),
  });

  expect(await view.findByText("Running 1")).toBeTruthy();
  const titles = [
    ...view.container.querySelectorAll("[data-slot=item-title]"),
  ].map((title) => title.textContent);
  expect(titles).toEqual([
    "Running 1",
    "Running 2",
    "Scheduled 1",
    "Toda a atividade",
  ]);
  expect(view.getByText("2 em andamento · 3 agendado(s)")).toBeTruthy();
  expect(view.queryByText("Done 1")).toBeNull();
});

test("with nothing running or scheduled, the section is the one row to all activity", async () => {
  const view = glance({
    inProgress: [],
    scheduled: [],
    completed: items(4, "Concluído"),
  });

  expect(await view.findByText("Nada em execução ou agendado")).toBeTruthy();
  expect(view.container.querySelectorAll("[data-slot=item]")).toHaveLength(1);
});
