import { describe, expect, test } from "bun:test";
import { Hono, type MiddlewareHandler } from "hono";
import type { AppVariables } from "../src/auth/guards";
import type { ChannelStore } from "../src/channels/routes";
import { createMissionRoutes } from "../src/missions/routes";
import type { Mission, MissionStore } from "../src/missions/store";

function fixture() {
  const calls: string[] = [];
  const mission: Mission = {
    id: "mission-u1",
    ownerId: "u1",
    agentId: "bot1",
    channelId: "channel1",
    goal: "Corrigir autenticação",
    successCriteria: "O login passa no teste",
    idempotencyKey: "request-1",
    status: "queued",
    cycle: 0,
    revision: 0,
    result: null,
    lastError: null,
    verifiedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const store = {
    create: async (input: { ownerId: string }) => {
      calls.push(`create:${input.ownerId}`);
      return mission;
    },
    listFor: async (owner: string) =>
      owner === mission.ownerId ? [mission] : [],
    getFor: async (owner: string, id: string) =>
      owner === mission.ownerId && id === mission.id ? mission : null,
    eventsFor: async () => [
      {
        revision: 0,
        status: "queued",
        detail: "Mission accepted",
        createdAt: new Date(),
      },
    ],
    resume: async (owner: string) => {
      calls.push(`resume:${owner}`);
      return mission;
    },
    verify: async (owner: string) => {
      calls.push(`verify:${owner}`);
      return mission;
    },
    cancel: async (owner: string) => {
      calls.push(`cancel:${owner}`);
      return mission;
    },
  } as unknown as MissionStore;
  const channels = {
    get: async (actor: { id: string }, channelId: string) =>
      actor.id === "u1" && channelId === "channel1"
        ? { threadId: "thread1", agentIds: ["bot1"] }
        : null,
  } as unknown as Pick<ChannelStore, "get">;
  const requireUser: MiddlewareHandler<{ Variables: AppVariables }> = async (
    c,
    next,
  ) => {
    const owner = c.req.header("x-test-user");
    if (!owner) return c.json({ error: "Authentication required" }, 401);
    c.set("actor", { id: owner, email: `${owner}@example.test`, role: "user" });
    await next();
  };
  const app = new Hono<{ Variables: AppVariables }>();
  app.route("/api/missions", createMissionRoutes(store, channels, requireUser));
  const request = (
    method: "GET" | "POST",
    path: string,
    owner = "u1",
    body?: unknown,
  ) =>
    app.request(`http://localhost/api/missions${path}`, {
      method,
      headers: {
        "x-test-user": owner,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const payload = {
    agentId: "bot1",
    channelId: "channel1",
    goal: "Corrigir autenticação",
    successCriteria: "O login passa no teste",
    idempotencyKey: "request-1",
  };
  return { calls, request, payload };
}

describe("NovaBot mission HTTP API", () => {
  test("refuses unauthenticated requests", async () => {
    const { request } = fixture();
    const res = await request("GET", "", "");
    expect(res.status).toBe(401);
  });
  test("creates work only for a member of the channel and that Bot", async () => {
    const { request, payload, calls } = fixture();
    expect((await request("POST", "", "u1", payload)).status).toBe(202);
    expect(calls).toEqual(["create:u1"]);
    expect((await request("POST", "", "u2", payload)).status).toBe(404);
    expect(
      (await request("POST", "", "u1", { ...payload, agentId: "otherbot" }))
        .status,
    ).toBe(404);
    expect(calls).toEqual(["create:u1"]);
  });
  test("uses the authenticated owner for all reads", async () => {
    const { request } = fixture();
    expect((await (await request("GET", "", "u2")).json()).missions).toEqual(
      [],
    );
    expect((await request("GET", "/mission-u1", "u2")).status).toBe(404);
    expect((await request("GET", "/mission-u1", "u1")).status).toBe(200);
  });
  test("requires explicit review before retry, and evidence before completion", async () => {
    const { request, calls } = fixture();
    expect(
      (
        await request("POST", "/mission-u1/resume", "u1", {
          acknowledgeUnknownEffects: false,
        })
      ).status,
    ).toBe(400);
    expect(calls).toEqual([]);
    expect(
      (
        await request("POST", "/mission-u1/resume", "u1", {
          acknowledgeUnknownEffects: true,
        })
      ).status,
    ).toBe(200);
    expect((await request("POST", "/mission-u1/verify", "u1", {})).status).toBe(
      400,
    );
    expect(
      (
        await request("POST", "/mission-u1/verify", "u1", {
          evidence: "Validado",
        })
      ).status,
    ).toBe(200);
    expect(calls).toEqual(["resume:u1", "verify:u1"]);
  });
});
