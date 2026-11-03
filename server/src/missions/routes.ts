import { Hono, type MiddlewareHandler } from "hono";
import type { AppVariables } from "../auth/guards";
import type { ChannelStore } from "../channels/routes";
import {
  MissionNotFoundError,
  MissionRefusedError,
  type MissionStore,
} from "./store";

function responseError(error: unknown): { code: 400 | 404; message: string } {
  if (error instanceof MissionNotFoundError)
    return { code: 404, message: error.message };
  if (error instanceof MissionRefusedError)
    return { code: 400, message: error.message };
  throw error;
}

/**
 * Owner-scoped mission API. No API action grants a new tool permission;
 * runner tools still resolve against the owner's CURRENT grants.
 */
export function createMissionRoutes(
  store: MissionStore,
  channelStore: Pick<ChannelStore, "get">,
  requireUser: MiddlewareHandler<{ Variables: AppVariables }>,
) {
  const routes = new Hono<{ Variables: AppVariables }>();

  routes.post("/", requireUser, async (c) => {
    const body = (await c.req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (
      !body ||
      [
        "agentId",
        "channelId",
        "goal",
        "successCriteria",
        "idempotencyKey",
      ].some((key) => typeof body[key] !== "string")
    )
      return c.json(
        {
          error:
            "agentId, channelId, goal, successCriteria and idempotencyKey are required.",
        },
        400,
      );
    const ownerId = c.var.actor.id;
    const agentId = body.agentId as string;
    const channelId = body.channelId as string;
    const channel = await channelStore.get(
      { id: ownerId, role: "user" },
      channelId,
    );
    if (!channel?.agentIds.includes(agentId))
      return c.json(
        { error: "The Bot or channel is not available to this user." },
        404,
      );
    try {
      const mission = await store.create({
        ownerId,
        agentId,
        channelId,
        goal: body.goal as string,
        successCriteria: body.successCriteria as string,
        idempotencyKey: body.idempotencyKey as string,
      });
      return c.json({ mission }, 202);
    } catch (error) {
      const refusal = responseError(error);
      return c.json({ error: refusal.message }, refusal.code);
    }
  });

  routes.get("/", requireUser, async (c) =>
    c.json({ missions: await store.listFor(c.var.actor.id) }),
  );

  routes.get("/:id", requireUser, async (c) => {
    const mission = await store.getFor(c.var.actor.id, c.req.param("id"));
    if (!mission) return c.json({ error: "Mission not found." }, 404);
    return c.json({
      mission,
      events: await store.eventsFor(c.var.actor.id, mission.id),
    });
  });

  routes.post("/:id/resume", requireUser, async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      acknowledgeUnknownEffects?: unknown;
    } | null;
    if (body?.acknowledgeUnknownEffects !== true)
      return c.json(
        {
          error:
            "First review potential external effects and explicitly acknowledge them.",
        },
        400,
      );
    try {
      const mission = await store.resume(
        c.var.actor.id,
        c.req.param("id"),
        true,
      );
      return c.json({ mission });
    } catch (error) {
      const refusal = responseError(error);
      return c.json({ error: refusal.message }, refusal.code);
    }
  });

  routes.post("/:id/verify", requireUser, async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      evidence?: unknown;
    } | null;
    if (typeof body?.evidence !== "string")
      return c.json({ error: "Verification evidence is required." }, 400);
    try {
      const mission = await store.verify(
        c.var.actor.id,
        c.req.param("id"),
        body.evidence,
      );
      return c.json({ mission });
    } catch (error) {
      const refusal = responseError(error);
      return c.json({ error: refusal.message }, refusal.code);
    }
  });

  routes.post("/:id/cancel", requireUser, async (c) => {
    try {
      const mission = await store.cancel(c.var.actor.id, c.req.param("id"));
      return c.json({ mission });
    } catch (error) {
      const refusal = responseError(error);
      return c.json({ error: refusal.message }, refusal.code);
    }
  });
  return routes;
}
