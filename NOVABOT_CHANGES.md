# NovaBot: mudanças sobre o OpenBot (upstream 743649e)

## Modo local sem CopilotKit Intelligence (`NOVABOT_LOCAL_RUNTIME=true`)
- `server/src/local/mode.ts`: liga/desliga o modo e define endereços fictícios (nunca usados).
- `server/src/local/pg-runner.ts`: `PostgresAgentRunner`, que estende o `InMemoryAgentRunner` do runtime 1.83 (modo SSE self-hosted). Depois de cada run, grava as runs e o snapshot de mensagens em `nb_threads`. No boot, recarrega tudo no store global do runtime. Um runner por processo, compartilhado por chat, rotinas e handoffs.
- `server/src/local/local-intelligence.ts`: substituto do cliente Intelligence. Threads vêm do runner. O lock de run é uma linha de lease em `nb_thread_locks` (run_id + expiração de 10 min), sempre alterada dentro de uma transação que pega `pg_advisory_xact_lock(hashtext(thread_id))`. O `PostgresAgentRunner.run` pega o lease antes de iniciar a run e solta no fim, e os métodos de lock do shim usam as mesmas funções. Funciona entre reinícios e com mais de um processo. Memória, learning e entitlements respondem 503, e aí o OpenBot cai na memória Postgres própria (`memory/store.ts`).
- `server/src/local/agent-memory.ts`: tabela `nb_agent_memory` (pgvector `vector(384)` + full-text em português; a coluna é recriada se a dimensão mudar), sempre filtrada por `agent_id` + `user_id` no SQL. Exposta aos bots como `agent_memory_remember`, `agent_memory_recall` e `agent_memory_forget` (`memory/tools.ts`). A busca é híbrida: cosseno pgvector sobre embeddings `multilingual-e5-small` (384 dims, container `embed`) + rank full-text em português. Se o `embed` cair, a busca vira só full-text, e as linhas sem vetor são preenchidas depois (backfill).
- Pontos de ligação: `config.ts` (não exige mais `INTELLIGENCE_*` em modo local), `intelligence-client.ts`, `copilot.ts` (`runner` em vez de `intelligence`), `index.ts` (cliente e runner das rotinas), `agents/handoff-wiring.ts`, `learning/auto-assign.ts`.
- As tabelas são criadas com `CREATE TABLE IF NOT EXISTS` no boot, fora do journal do Drizzle.

## Docker
- `server/Dockerfile`: copia `agent-computer/src` (só o código, sem Chromium), que o server importa (`egress.ts`, `web-bot-auth.ts`), e liga `agent-computer/node_modules` ao `server/node_modules`.
- `docker-compose.novabot.yml`: postgres próprio, migrate, server, worker e agent-bot, tudo com `mem_limit`, sem supervisor nem agent-computer, porta só em 127.0.0.1:13010.

## Correções
- `pg-runner.ts`: as runs e mensagens são gravadas como jsonb de verdade (`(texto::text)::jsonb`), não como string JSON. A leitura aceita os dois formatos.

## Marca NOVAGENTE
- `examples/novagente/`: pacote do tenant (`brand.yaml` com product_name NovaBot, `theme.css` preto #0A0A0A / branco / azul #1E7BFF, bots e canais em português). O compose usa `TENANT_PACKAGE_DIR=../examples/novagente` no build e na execução (o Dockerfile ganhou o `ARG`).
- `app/public/`: `favicon.svg`, `novabot-mark.svg` (chevron azul), `novagente-logo.svg` (NOVAGENTE em branco com o A como chevron azul).
- `app/index.html`: `lang="pt-BR"`, título "NovaBot · NOVAGENTE", favicon e theme-color. Marca na barra lateral (`app-sidebar.tsx`).
- Textos em pt-BR: saudação inicial, "Entrar no NovaBot", "Boas-vindas ao NovaBot". O resto da interface é texto fixo em inglês no upstream (não há i18n).
- Ícones: o app já usa o conjunto **Tabler Icons**, equivalente ao Lucide. Não foi trocado, porque isso mexeria em centenas de arquivos e quebraria os merges com o upstream.

## Computador por bot
- `agents/isolation.ts`: `NOVABOT_ISOLATE_EVERY_BOT=true` dá a TODO bot o seu próprio computador (container, perfil de navegador e volumes próprios, sem cookies compartilhados).
- `supervisor/src/novabot-limits.ts`: no máximo `NOVABOT_MAX_COMPUTERS` (1) ligados, com o menos usado parado antes de ligar outro; só liga com `MemAvailable >= NOVABOT_MIN_AVAILABLE_MB` (3072), senão responde 503; desliga após `NOVABOT_COMPUTER_IDLE_MINUTES` (15) sem ações. Limite de RAM por computador: `COMPUTER_MEMORY_BYTES=671088640` (640 MB).
- Compose: serviços `supervisor` (socket do Docker, 96 MB) e `embed` (512 MB). Total em execução: 1856 MB + no máximo 1 computador (640 MB) = 2496 MB.

## Atualização
- `scripts/novabot-update.sh`: confere a RAM, guarda o commit e as imagens (`:rollback`), faz fast-forward da branch `novabot`, reconstrói uma imagem por vez com `nice`, sobe o compose `novabot`, espera o `/health` e faz rollback sozinho se algo falhar.
- `README.md` em pt-BR (o original virou `README.openbot.md`). `LICENSE` MIT mantém o copyright da CopilotKit.

## Limitações conhecidas / pendências
- Learning (skills aprendidas), transcript e canais gerenciados do Intelligence ficam desativados.
- O browser em tempo real "assistir run em andamento" usa o connect/replay do runner em memória.
- `examples/fintech/model.yaml`: modelo padrão `deepseek-flash` (bots built-in); o compose define `COPILOTKIT_OPENAI_API=chat` e o Risk Analyst aponta para o agent-bot (DeepSeek).
