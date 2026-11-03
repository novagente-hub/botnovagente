import { randomUUID } from "node:crypto";
import type { SQL } from "bun";
import {
  MAX_MISSION_GOAL_CHARS,
  MAX_MISSION_RESULT_CHARS,
  missionCanResume,
  type MissionStatus,
} from "./policy";

export type Mission = {
  id: string;
  ownerId: string;
  agentId: string;
  channelId: string;
  goal: string;
  successCriteria: string;
  idempotencyKey: string;
  status: MissionStatus;
  cycle: number;
  revision: number;
  result: string | null;
  lastError: string | null;
  verifiedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MissionEvent = {
  revision: number;
  status: MissionStatus;
  detail: string;
  createdAt: Date;
};

export type NewMission = Pick<
  Mission,
  | "ownerId"
  | "agentId"
  | "channelId"
  | "goal"
  | "successCriteria"
  | "idempotencyKey"
>;

export class MissionRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissionRefusedError";
  }
}
export class MissionNotFoundError extends Error {
  constructor() {
    super("Mission not found.");
    this.name = "MissionNotFoundError";
  }
}

type Row = {
  id: string;
  owner_id: string;
  agent_id: string;
  channel_id: string;
  goal: string;
  success_criteria: string;
  idempotency_key: string;
  status: MissionStatus;
  cycle: number;
  revision: number;
  result: string | null;
  last_error: string | null;
  verified_by: string | null;
  created_at: Date;
  updated_at: Date;
};
type EventRow = {
  revision: number;
  status: MissionStatus;
  detail: string;
  created_at: Date;
};

const asMission = (row: Row): Mission => ({
  id: row.id,
  ownerId: row.owner_id,
  agentId: row.agent_id,
  channelId: row.channel_id,
  goal: row.goal,
  successCriteria: row.success_criteria,
  idempotencyKey: row.idempotency_key,
  status: row.status,
  cycle: row.cycle,
  revision: row.revision,
  result: row.result,
  lastError: row.last_error,
  verifiedBy: row.verified_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function validInput(input: NewMission): void {
  if (
    !input.ownerId ||
    !input.agentId ||
    !input.channelId ||
    !input.goal.trim() ||
    !input.successCriteria.trim() ||
    !input.idempotencyKey.trim()
  )
    throw new MissionRefusedError(
      "Mission needs an owner, Bot, channel, goal, success criteria and idempotency key.",
    );
  if (
    input.goal.length > MAX_MISSION_GOAL_CHARS ||
    input.successCriteria.length > MAX_MISSION_GOAL_CHARS ||
    input.idempotencyKey.length > 120 ||
    input.agentId.length > 200 ||
    input.channelId.length > 200
  )
    throw new MissionRefusedError("One of the mission fields is too long.");
}

export type MissionStore = {
  ready: Promise<void>;
  create(input: NewMission): Promise<Mission>;
  listFor(ownerId: string): Promise<Mission[]>;
  getFor(ownerId: string, id: string): Promise<Mission | null>;
  eventsFor(ownerId: string, id: string): Promise<MissionEvent[]>;
  /** Queue recovery: read-only, never takes an action. */
  queued(limit?: number): Promise<Mission[]>;
  /** The executor may run only a queued mission it claims for the first time. */
  begin(id: string, cycle: number): Promise<Mission | null>;
  finish(
    id: string,
    status: "needs-review" | "needs-approval",
    detail: string,
  ): Promise<Mission | null>;
  recoverUnknown(
    id: string,
    detail: string,
    expectedCycle: number,
  ): Promise<Mission | null>;
  /** Only an authenticated owner can restart potentially uncertain work. */
  resume(
    ownerId: string,
    id: string,
    acknowledgeUnknownEffects: boolean,
  ): Promise<Mission>;
  /** A human, never the language model, verifies completion in MVP2. */
  verify(ownerId: string, id: string, evidence: string): Promise<Mission>;
  cancel(ownerId: string, id: string): Promise<Mission>;
};

export function createMissionStore(db: SQL): MissionStore {
  // Isolated, opt-in nb_* table (local runtime already uses the same approach
  // for nb_threads and nb_agent_memory). Formal Drizzle migration is deferred
  // until conflicting integration migrations 0070/0071 have merged.
  const ready = db
    .unsafe(`
    CREATE TABLE IF NOT EXISTS nb_missions (
      id text PRIMARY KEY,
      owner_id text NOT NULL,
      agent_id text NOT NULL,
      channel_id text NOT NULL,
      goal text NOT NULL,
      success_criteria text NOT NULL,
      idempotency_key text NOT NULL,
      status text NOT NULL DEFAULT 'queued',
      cycle integer NOT NULL DEFAULT 0 CHECK (cycle >= 0 AND cycle < 3),
      revision integer NOT NULL DEFAULT 0,
      result text,
      last_error text,
      verified_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, idempotency_key),
      CHECK (status IN ('queued','running','needs-review','needs-approval','completed','cancelled'))
    );
    CREATE INDEX IF NOT EXISTS nb_missions_owner_idx ON nb_missions (owner_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS nb_missions_queue_idx ON nb_missions (status, created_at) WHERE status = 'queued';
    CREATE TABLE IF NOT EXISTS nb_mission_events (
      mission_id text NOT NULL REFERENCES nb_missions(id) ON DELETE CASCADE,
      revision integer NOT NULL,
      status text NOT NULL,
      detail text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (mission_id, revision)
    );
  `)
    .then(() => undefined);
  const isReady = () => ready;
  const one = (rows: Row[]): Mission | null =>
    rows[0] ? asMission(rows[0]) : null;

  async function change(
    id: string,
    fromStatuses: MissionStatus[],
    toStatus: MissionStatus,
    detail: string,
    opts: {
      ownerId?: string;
      result?: string | null;
      error?: string | null;
      verifiedBy?: string | null;
      cycle?: number;
      expectedCycle?: number;
    } = {},
  ): Promise<Mission | null> {
    await isReady();
    // One statement atomically updates state and appends a versioned event.
    const rows = (await db`
      WITH moved AS (
        UPDATE nb_missions
        SET status = ${toStatus}, revision = revision + 1,
            updated_at = now(),
            cycle = coalesce(${opts.cycle ?? null}::int, cycle),
            result = CASE WHEN ${opts.result === undefined} THEN result ELSE ${opts.result ?? null} END,
            last_error = CASE WHEN ${opts.error === undefined} THEN last_error ELSE ${opts.error ?? null} END,
            verified_by = coalesce(${opts.verifiedBy ?? null}::text, verified_by)
        WHERE id = ${id}
          AND (status = ${fromStatuses[0] ?? ""} OR status = ${fromStatuses[1] ?? ""} OR status = ${fromStatuses[2] ?? ""})
          AND (${opts.ownerId ?? null}::text IS NULL OR owner_id = ${opts.ownerId ?? null})
          AND (${opts.expectedCycle ?? null}::int IS NULL OR cycle = ${opts.expectedCycle ?? null})
        RETURNING *
      ), recorded AS (
        INSERT INTO nb_mission_events (mission_id, revision, status, detail)
        SELECT id, revision, status, ${detail} FROM moved
        RETURNING mission_id
      )
      SELECT moved.* FROM moved JOIN recorded ON recorded.mission_id = moved.id
    `) as Row[];
    return one(rows);
  }

  return {
    ready,
    async create(input) {
      validInput(input);
      await isReady();
      const id = randomUUID();
      const rows = (await db`
        WITH upserted AS (
          INSERT INTO nb_missions (id, owner_id, agent_id, channel_id, goal, success_criteria, idempotency_key)
          VALUES (${id}, ${input.ownerId}, ${input.agentId}, ${input.channelId}, ${input.goal.trim()},
                  ${input.successCriteria.trim()}, ${input.idempotencyKey})
          ON CONFLICT (owner_id, idempotency_key) DO UPDATE
            SET idempotency_key = EXCLUDED.idempotency_key
          RETURNING *
        ), event AS (
          INSERT INTO nb_mission_events (mission_id, revision, status, detail)
          SELECT id, 0, 'queued', 'Mission accepted' FROM upserted
          ON CONFLICT (mission_id, revision) DO NOTHING
          RETURNING mission_id
        )
        SELECT * FROM upserted
      `) as Row[];
      const mission = one(rows);
      if (!mission)
        throw new MissionRefusedError("The mission could not be saved.");
      if (
        mission.agentId !== input.agentId ||
        mission.channelId !== input.channelId ||
        mission.goal !== input.goal.trim() ||
        mission.successCriteria !== input.successCriteria.trim()
      )
        throw new MissionRefusedError(
          "Idempotency key already belongs to a different mission.",
        );
      return mission;
    },
    async listFor(ownerId) {
      await isReady();
      return (
        (await db`SELECT * FROM nb_missions WHERE owner_id = ${ownerId}
        ORDER BY created_at DESC LIMIT 100`) as Row[]
      ).map(asMission);
    },
    async getFor(ownerId, id) {
      await isReady();
      return one(
        (await db`SELECT * FROM nb_missions WHERE owner_id = ${ownerId}
        AND id = ${id}`) as Row[],
      );
    },
    async eventsFor(ownerId, id) {
      await isReady();
      const rows = (await db`SELECT e.revision, e.status, e.detail, e.created_at
        FROM nb_mission_events e
        JOIN nb_missions m ON m.id = e.mission_id
        WHERE m.owner_id = ${ownerId} AND m.id = ${id}
        ORDER BY e.revision ASC LIMIT 100`) as EventRow[];
      return rows.map((row) => ({
        revision: row.revision,
        status: row.status,
        detail: row.detail,
        createdAt: row.created_at,
      }));
    },
    async queued(limit = 30) {
      await isReady();
      return (
        (await db`SELECT * FROM nb_missions WHERE status = 'queued'
        ORDER BY created_at ASC LIMIT ${Math.min(Math.max(limit, 1), 100)}`) as Row[]
      ).map(asMission);
    },
    begin(id, cycle) {
      return change(id, ["queued"], "running", "Execution started", {
        expectedCycle: cycle,
      });
    },
    finish(id, status, detail) {
      const summary = detail.slice(0, MAX_MISSION_RESULT_CHARS);
      return change(id, ["running"], status, summary, {
        ...(status === "needs-review"
          ? { result: summary }
          : { error: summary }),
      });
    },
    recoverUnknown(id, detail, expectedCycle) {
      return change(id, ["queued", "running"], "needs-review", detail, {
        error: detail,
        expectedCycle,
      });
    },
    async resume(ownerId, id, acknowledgeUnknownEffects) {
      const mission = await this.getFor(ownerId, id);
      if (!mission) throw new MissionNotFoundError();
      const decision = missionCanResume(
        mission.status,
        mission.cycle + 1,
        acknowledgeUnknownEffects,
      );
      if (!decision.allowed) throw new MissionRefusedError(decision.reason);
      const updated = await change(
        id,
        ["needs-review"],
        "queued",
        "Owner requested a new attempt after reviewing possible external effects",
        {
          ownerId,
          cycle: mission.cycle + 1,
          error: null,
        },
      );
      if (!updated)
        throw new MissionRefusedError(
          "Mission state changed. Read it and try again.",
        );
      return updated;
    },
    async verify(ownerId, id, evidence) {
      if (!evidence?.trim() || evidence.length > 2000)
        throw new MissionRefusedError(
          "Human verification needs concise evidence.",
        );
      const updated = await change(
        id,
        ["needs-review"],
        "completed",
        evidence.trim(),
        {
          ownerId,
          verifiedBy: ownerId,
        },
      );
      if (!updated) {
        if (!(await this.getFor(ownerId, id))) throw new MissionNotFoundError();
        throw new MissionRefusedError(
          "Only reviewed missions can be marked completed.",
        );
      }
      return updated;
    },
    async cancel(ownerId, id) {
      const updated = await change(
        id,
        ["queued", "needs-review", "needs-approval"],
        "cancelled",
        "Cancelled by mission owner",
        { ownerId },
      );
      if (!updated) {
        if (!(await this.getFor(ownerId, id))) throw new MissionNotFoundError();
        throw new MissionRefusedError(
          "A running mission must finish or be stopped safely before cancellation.",
        );
      }
      return updated;
    },
  };
}
