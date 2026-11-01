import { Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { AppVariables } from "../auth/guards";
import { ResourceRefusedError, type SharedResourceStore } from "./store";

const resourceInput = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().max(16_000),
}).strict();
const grantInput = z.object({
  permission: z.enum(["read", "write"]),
}).strict();

/** Owner-scoped API. Only the person can grant Bots access. */
export function createSharedResourceRoutes(
  store: SharedResourceStore,
  requireUser: MiddlewareHandler<{ Variables: AppVariables }>,
  canGrantBot: (actor: AppVariables["actor"], botId: string) => Promise<boolean>,
) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use("*", requireUser);
  app.use("*", bodyLimit({ maxSize: 24_000 }));

  app.get("/", async (context) =>
    context.json({ resources: await store.listOwned(context.var.actor.id) }),
  );
  app.post("/", async (context) => {
    const parsed = resourceInput.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "Invalid resource input." }, 400);
    return context.json(
      { resource: await store.create(context.var.actor.id, parsed.data.title, parsed.data.content) },
      201,
    );
  });
  app.get("/:id", async (context) => {
    try {
      return context.json({
        resource: await store.readOwned(context.var.actor.id, context.req.param("id")),
      });
    } catch (error) {
      if (error instanceof ResourceRefusedError)
        return context.json({ error: "Resource not found." }, 404);
      throw error;
    }
  });
  app.put("/:id", async (context) => {
    const parsed = resourceInput.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "Invalid resource input." }, 400);
    try {
      return context.json({
        resource: await store.updateOwned(
          context.var.actor.id,
          context.req.param("id"),
          parsed.data.title,
          parsed.data.content,
        ),
      });
    } catch (error) {
      if (error instanceof ResourceRefusedError)
        return context.json({ error: "Resource not found." }, 404);
      throw error;
    }
  });
  app.delete("/:id", async (context) => {
    try {
      await store.removeOwned(context.var.actor.id, context.req.param("id"));
      return context.json({ deleted: true });
    } catch (error) {
      if (error instanceof ResourceRefusedError)
        return context.json({ error: "Resource not found." }, 404);
      throw error;
    }
  });
  app.get("/:id/grants", async (context) => {
    try {
      return context.json({
        grants: await store.grantsFor(context.var.actor.id, context.req.param("id")),
      });
    } catch (error) {
      if (error instanceof ResourceRefusedError)
        return context.json({ error: "Resource not found." }, 404);
      throw error;
    }
  });
  app.put("/:id/grants/:botId", async (context) => {
    const parsed = grantInput.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "Invalid grant." }, 400);
    const botId = context.req.param("botId");
    if (!(await canGrantBot(context.var.actor, botId)))
      return context.json({ error: "Bot not accessible." }, 403);
    try {
      return context.json({
        grant: await store.grant(
          context.var.actor.id,
          context.req.param("id"),
          botId,
          parsed.data.permission,
        ),
      });
    } catch (error) {
      if (error instanceof ResourceRefusedError)
        return context.json({ error: "Resource not found." }, 404);
      throw error;
    }
  });
  app.delete("/:id/grants/:botId", async (context) => {
    try {
      await store.revoke(
        context.var.actor.id,
        context.req.param("id"),
        context.req.param("botId"),
      );
      return context.json({ revoked: true });
    } catch (error) {
      if (error instanceof ResourceRefusedError)
        return context.json({ error: "Resource not found." }, 404);
      throw error;
    }
  });
  return app;
}
