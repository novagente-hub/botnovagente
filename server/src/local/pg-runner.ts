import { SQL } from "bun";
import {
  type AgentRunnerRunRequest,
  InMemoryAgentRunner,
  ɵGLOBAL_STORE,
} from "@copilotkit/runtime/v2";
import type { BaseEvent, Message } from "@ag-ui/client";
import type { Observable } from "rxjs";

/**
 * NovaBot: the CopilotKit in-memory runner, made durable with PostgreSQL.
 *
 * Runs execute exactly as `InMemoryAgentRunner` runs them (same ownership checks, same replay on
 * connect, same local thread endpoints). After each run finishes, the thread's retained runs and
 * its message snapshot are written to `nb_threads`; at boot every stored thread is put back into the
 * runtime's process-global store, so a restart loses nothing the store had kept.
 */
type ThreadRow = {
  thread_id: string;
  owner_id: string;
  agent_id: string;
  name: string | null;
  runs: unknown;
  messages: unknown;
  created_at: Date;
};

type StoredRun = {
  runId: string;
  agentId: string;
  parentRunId: string | null;
  events: BaseEvent[];
  createdAt: number;
};

let shared: { sql: SQL; ready: Promise<void> } | undefined;
let registered: SQL | undefined;

/**
 * Hand the server's own connection pool to the local runtime. `db/client.ts` removes
 * `DATABASE_URL` from the environment once it has opened the pool, so the pool is the only
 * address left; index.ts calls this right after `createDatabase`.
 */
export function registerLocalSql(sql: SQL): void {
  registered ??= sql;
}

export function localDatabase(url = process.env.DATABASE_URL): { sql: SQL; ready: Promise<void> } {
  if (shared) return shared;
  if (!registered && !url) throw new Error("NovaBot local runtime needs the server's database.");
  const sql = registered ?? new SQL(url as string);
  const ready = (async () => {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS nb_threads (
        thread_id  text PRIMARY KEY,
        owner_id   text NOT NULL,
        agent_id   text NOT NULL,
        name       text,
        runs       jsonb NOT NULL DEFAULT '[]'::jsonb,
        messages   jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS nb_threads_owner ON nb_threads (owner_id, updated_at DESC);
    `);
  })();
  shared = { sql, ready };
  return shared;
}

export class PostgresAgentRunner extends InMemoryAgentRunner {
  readonly #db: { sql: SQL; ready: Promise<void> };
  readonly hydrated: Promise<void>;

  constructor(db = localDatabase()) {
    super({ onConcurrentRun: "throw" });
    this.#db = db;
    this.hydrated = this.#hydrate().catch((error) => {
      console.error("[novabot] could not load stored threads:", error);
    });
  }

  async #hydrate(): Promise<void> {
    await this.#db.ready;
    const rows = (await this.#db.sql`
      SELECT thread_id, owner_id, agent_id, name, runs, messages, created_at
      FROM nb_threads ORDER BY updated_at ASC`) as ThreadRow[];
    for (const row of rows) {
      const runs = (row.runs as StoredRun[]) ?? [];
      const messages = (row.messages as Message[]) ?? [];
      if (ɵGLOBAL_STORE.peek(row.thread_id)) continue;
      const writer = ɵGLOBAL_STORE.getOrCreate(row.thread_id, row.owner_id);
      runs.forEach((run, index) => {
        ɵGLOBAL_STORE.appendRun(row.thread_id, writer, {
          threadId: row.thread_id,
          runId: run.runId,
          agentId: run.agentId,
          parentRunId: run.parentRunId,
          events: run.events,
          // The snapshot rides the last run, which is where appendRun takes it from.
          messages: index === runs.length - 1 ? messages : [],
          createdAt: run.createdAt,
        });
      });
    }
    console.info(JSON.stringify({ type: "novabot-threads-loaded", count: rows.length }));
  }

  override run(request: AgentRunnerRunRequest): Observable<BaseEvent> {
    const observable = super.run(request);
    const persist = () =>
      // appendRun lands on the runner's own finalize; give it a moment, then write.
      setTimeout(() => {
        void this.persist(request.threadId, request.ownerId ?? "").catch((error) =>
          console.error("[novabot] could not store thread", request.threadId, error),
        );
      }, 250);
    observable.subscribe({ complete: persist, error: persist });
    return observable;
  }

  async persist(threadId: string, ownerHint: string): Promise<void> {
    const store = ɵGLOBAL_STORE.peek(threadId);
    if (!store) return;
    await this.#db.ready;
    const runs: StoredRun[] = store.historicRuns.map((run) => ({
      runId: run.runId,
      agentId: run.agentId,
      parentRunId: run.parentRunId,
      events: run.events,
      createdAt: run.createdAt,
    }));
    const agentId = runs.at(-1)?.agentId ?? "";
    const owner = store.ownerId || ownerHint;
    await this.#db.sql`
      INSERT INTO nb_threads (thread_id, owner_id, agent_id, runs, messages, updated_at)
      VALUES (${threadId}, ${owner}, ${agentId}, ${JSON.stringify(runs)}::jsonb,
              ${JSON.stringify(store.messagesSnapshot)}::jsonb, now())
      ON CONFLICT (thread_id) DO UPDATE SET
        agent_id = EXCLUDED.agent_id, runs = EXCLUDED.runs,
        messages = EXCLUDED.messages, updated_at = now()`;
  }
}

let runner: PostgresAgentRunner | undefined;
/** One runner per process: the runtime, routines and handoffs share it, like the global store. */
export function localRunner(): PostgresAgentRunner {
  runner ??= new PostgresAgentRunner();
  return runner;
}
