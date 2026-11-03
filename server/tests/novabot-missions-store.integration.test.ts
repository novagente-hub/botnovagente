import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  createMissionStore,
  MissionNotFoundError,
  MissionRefusedError,
} from "../src/missions/store";

const address = process.env.NOVABOT_TEST_DATABASE_URL;
if (!address)
  throw new Error(
    "NOVABOT_TEST_DATABASE_URL must point to an isolated disposable PostgreSQL test database.",
  );
const db = new SQL(address);
const store = createMissionStore(db);

beforeAll(async () => {
  await store.ready;
});
afterAll(async () => {
  await db.close();
});

const input = {
  ownerId: "account-A",
  agentId: "bot-A",
  channelId: "channel-A",
  goal: "Corrigir o problema de login",
  successCriteria: "O teste de autenticação passa",
  idempotencyKey: "test-request-01",
};

describe("NovaBot missions: real isolated PostgreSQL", () => {
  test("persists a mission, its event log and enforces an idempotency key", async () => {
    const original = await store.create(input);
    const duplicate = await store.create(input);
    expect(duplicate.id).toBe(original.id);
    expect(original.status).toBe("queued");
    expect(await store.eventsFor(input.ownerId, original.id)).toHaveLength(1);
    expect((await store.getFor(input.ownerId, original.id))?.goal).toBe(
      input.goal,
    );
    await expect(
      store.create({ ...input, goal: "Outra missão" }),
    ).rejects.toThrow(MissionRefusedError);
  });

  test("two concurrent identical requests persist one mission with no missing return", async () => {
    const key = `concurrent-${crypto.randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        store.create({ ...input, idempotencyKey: key }),
      ),
    );
    expect(new Set(results.map((m) => m.id)).size).toBe(1);
    expect(await store.eventsFor(input.ownerId, results[0]!.id)).toHaveLength(
      1,
    );
  });

  test("enforces user isolation in SQL (read, list, events, verify and resume)", async () => {
    const original = (await store.listFor(input.ownerId))[0]!;
    expect(await store.getFor("account-B", original.id)).toBeNull();
    expect(await store.eventsFor("account-B", original.id)).toEqual([]);
    expect(await store.listFor("account-B")).toEqual([]);
    await expect(store.resume("account-B", original.id, true)).rejects.toThrow(
      MissionNotFoundError,
    );
    await expect(
      store.verify("account-B", original.id, "Conferi"),
    ).rejects.toThrow(MissionNotFoundError);
    const other = await store.create({ ...input, ownerId: "account-B" });
    expect(other.id).not.toBe(original.id);
    expect((await store.listFor("account-B")).map((row) => row.id)).toEqual([
      other.id,
    ]);
  });

  test("claims each cycle at most once, requires review and writes evidence", async () => {
    const original = (await store.listFor(input.ownerId))[0]!;
    expect(await store.begin(original.id, 1)).toBeNull(); // stale/future worker
    const first = await store.begin(original.id, 0);
    expect(first?.status).toBe("running");
    expect(await store.begin(original.id, 0)).toBeNull();
    await expect(store.cancel(input.ownerId, original.id)).rejects.toThrow(
      MissionRefusedError,
    );
    const result = await store.finish(
      original.id,
      "needs-review",
      "Consegui abrir a página e conferir o login.",
    );
    expect(result?.status).toBe("needs-review");
    expect(result?.verifiedBy).toBeNull();
    await expect(
      store.resume(input.ownerId, original.id, false),
    ).rejects.toThrow(MissionRefusedError);
    const resumed = await store.resume(input.ownerId, original.id, true);
    expect(resumed.cycle).toBe(1);
    expect(resumed.status).toBe("queued");
    expect(
      await store.recoverUnknown(original.id, "stale lease", 0),
    ).toBeNull(); // old lease must not poison next cycle
    expect((await store.begin(original.id, 1))?.status).toBe("running");
    await store.finish(
      original.id,
      "needs-review",
      "Agora passou no ambiente de teste.",
    );
    const verified = await store.verify(
      input.ownerId,
      original.id,
      "Eu conferi o teste de login.",
    );
    expect(verified.status).toBe("completed");
    expect(verified.verifiedBy).toBe(input.ownerId);
    expect(
      (await store.eventsFor(input.ownerId, original.id)).map(
        (event) => event.status,
      ),
    ).toEqual([
      "queued",
      "running",
      "needs-review",
      "queued",
      "running",
      "needs-review",
      "completed",
    ]);
    await expect(
      store.resume(input.ownerId, original.id, true),
    ).rejects.toThrow(MissionRefusedError);
  });

  test("interrupted work goes to human review instead of replay, and cancellation stays terminal", async () => {
    const job = await store.create({
      ...input,
      idempotencyKey: "interrupted",
      goal: "Fazer um trabalho pontual",
    });
    await store.begin(job.id, 0);
    const unknown = await store.recoverUnknown(
      job.id,
      "Servidor caiu durante o processamento.",
      0,
    );
    expect(unknown?.status).toBe("needs-review");
    expect(await store.begin(job.id, 0)).toBeNull();
    expect(await store.resume(input.ownerId, job.id, true)).toMatchObject({
      status: "queued",
      cycle: 1,
    });
    expect((await store.cancel(input.ownerId, job.id)).status).toBe(
      "cancelled",
    );
    expect(await store.begin(job.id, 1)).toBeNull();
  });
});
