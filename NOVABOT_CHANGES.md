# NovaBot: mudanças sobre o OpenBot (upstream 743649e)

## Modo local sem CopilotKit Intelligence (`NOVABOT_LOCAL_RUNTIME=true`)
- `server/src/local/mode.ts`: liga/desliga o modo e define endereços fictícios (nunca usados).
- `server/src/local/pg-runner.ts`: `PostgresAgentRunner`, que estende o `InMemoryAgentRunner` do runtime 1.83 (modo SSE self-hosted). Depois de cada run, grava as runs e o snapshot de mensagens em `nb_threads`. No boot, recarrega tudo no store global do runtime. Um runner por processo, compartilhado por chat, rotinas e handoffs.
- `server/src/local/local-intelligence.ts`: substituto do cliente Intelligence. Threads vêm do runner. O lock de run é um por thread, em processo (o server roda um processo só). Memória, learning e entitlements respondem 503, e aí o OpenBot cai na memória Postgres própria (`memory/store.ts`).
- `server/src/local/agent-memory.ts`: tabela `nb_agent_memory` (pgvector `vector(1024)` + full-text em português), sempre filtrada por `agent_id` + `user_id`, para não misturar a memória de um agente com a de outro. **Ainda não está ligada às ferramentas dos bots.**
- Pontos de ligação: `config.ts` (não exige mais `INTELLIGENCE_*` em modo local), `intelligence-client.ts`, `copilot.ts` (`runner` em vez de `intelligence`), `index.ts` (cliente e runner das rotinas), `agents/handoff-wiring.ts`, `learning/auto-assign.ts`.
- As tabelas são criadas com `CREATE TABLE IF NOT EXISTS` no boot, fora do journal do Drizzle.

## Docker
- `server/Dockerfile`: copia `agent-computer/src` (só o código, sem Chromium), que o server importa (`egress.ts`, `web-bot-auth.ts`), e liga `agent-computer/node_modules` ao `server/node_modules`.
- `docker-compose.novabot.yml`: postgres próprio, migrate, server, worker e agent-bot, tudo com `mem_limit`, sem supervisor nem agent-computer, porta só em 127.0.0.1:13010.

## Limitações conhecidas / pendências
- Lock de thread em processo, não advisory lock do Postgres (basta enquanto houver uma réplica só).
- Learning (skills aprendidas), transcript e canais gerenciados do Intelligence ficam desativados.
- O browser em tempo real "assistir run em andamento" usa o connect/replay do runner em memória.
- `nb_agent_memory` ainda não exposta como ferramenta; recall semântico depende de um provedor de embeddings.
- `examples/fintech/model.yaml`: modelo padrão `deepseek-flash` (bots built-in); o compose define `COPILOTKIT_OPENAI_API=chat` e o Risk Analyst aponta para o agent-bot (DeepSeek).
