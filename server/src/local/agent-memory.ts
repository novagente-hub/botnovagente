import { localDatabase } from "./pg-runner";

/**
 * NovaBot: memory scoped to ONE agent (and the person it works for).
 *
 * Every read and write names `agent_id`, so one Bot can never recall what another Bot stored: the
 * isolation is in the WHERE clause, not in a prompt. Recall is PostgreSQL full-text search today;
 * the `embedding` column (pgvector, 1024 dims) is there for semantic recall once an embedding
 * provider is chosen (DeepSeek has no embeddings endpoint).
 */
let ready: Promise<void> | undefined;
function schema() {
  const { sql, ready: base } = localDatabase();
  ready ??= base.then(async () => {
    await sql.unsafe(`
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE TABLE IF NOT EXISTS nb_agent_memory (
        id         bigserial PRIMARY KEY,
        agent_id   text NOT NULL,
        user_id    text NOT NULL,
        content    text NOT NULL,
        tsv        tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', content)) STORED,
        embedding  vector(1024),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS nb_agent_memory_scope ON nb_agent_memory (agent_id, user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS nb_agent_memory_tsv ON nb_agent_memory USING gin (tsv);
    `);
  });
  return { sql, ready };
}

export async function rememberForAgent(agentId: string, userId: string, content: string) {
  const { sql, ready } = schema();
  await ready;
  const [row] = await sql`
    INSERT INTO nb_agent_memory (agent_id, user_id, content)
    VALUES (${agentId}, ${userId}, ${content}) RETURNING id`;
  return String(row.id);
}

export async function recallForAgent(agentId: string, userId: string, query: string, limit = 8) {
  const { sql, ready } = schema();
  await ready;
  return (await sql`
    SELECT id::text, content, ts_rank(tsv, plainto_tsquery('portuguese', ${query})) AS score
    FROM nb_agent_memory
    WHERE agent_id = ${agentId} AND user_id = ${userId}
      AND (${query} = '' OR tsv @@ plainto_tsquery('portuguese', ${query}))
    ORDER BY score DESC, created_at DESC
    LIMIT ${limit}`) as { id: string; content: string; score: number }[];
}

export async function forgetForAgent(agentId: string, userId: string, id: string) {
  const { sql, ready } = schema();
  await ready;
  await sql`DELETE FROM nb_agent_memory WHERE id = ${id}::bigint AND agent_id = ${agentId} AND user_id = ${userId}`;
}
