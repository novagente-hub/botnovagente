# NovaBot · NOVAGENTE

NovaBot é o agente da NOVAGENTE: um fork do [OpenBot](https://github.com/CopilotKit/OpenBot)
(licença MIT, © CopilotKit) que roda **sem o CopilotKit Intelligence**, usando só Postgres, com
modelo DeepSeek, memória própria por agente e um computador isolado por bot.

O que mudou em relação ao OpenBot está em [`NOVABOT_CHANGES.md`](NOVABOT_CHANGES.md). O README
original está em [`README.openbot.md`](README.openbot.md).

## Como funciona

| Serviço      | O que faz                                                            | Limite de RAM |
| ------------ | -------------------------------------------------------------------- | ------------- |
| `postgres`   | pgvector/pg17: usuários, conversas (`nb_threads`), memória (`nb_agent_memory`), locks | 320 MB |
| `migrate`    | aplica as migrações e sai                                            | 256 MB        |
| `server`     | API + app web, porta **127.0.0.1:13010**                             | 640 MB        |
| `worker`     | rotinas agendadas                                                    | 160 MB        |
| `agent-bot`  | bot remoto AG-UI (Analista NovaBot) usando DeepSeek                  | 128 MB        |
| `embed`      | embeddings locais multilingual-e5-small (384 dims), sem API externa  | 512 MB        |
| `supervisor` | cria/para o computador de cada bot (no máx. 1 ligado, desliga após 15 min parado) | 96 MB |
| computador   | sob demanda, um por bot, com perfil de navegador e volumes próprios  | 640 MB        |

## Acessar a interface

Nada é publicado na internet. Abra um túnel SSH e use o navegador:

```bash
ssh -L 13010:127.0.0.1:13010 root@187.77.228.127
# depois abra http://localhost:13010
```

## Atualizar a VPS

```bash
cd /opt/novabot && ./scripts/novabot-update.sh
```

O script:
1. confere a RAM disponível (aborta abaixo de 2 GB);
2. guarda o commit e as imagens atuais (tag `:rollback`);
3. faz `git fetch` + fast-forward da branch `novabot`;
4. reconstrói as imagens **uma de cada vez**, com prioridade baixa (`nice`);
5. sobe só o projeto compose `novabot` e espera o `/health`;
6. se algo falhar, volta sozinho para a versão anterior.

Opções: `--with-computer` também reconstrói a imagem do computador dos bots (pesada, Chromium);
`--rollback` volta para a versão anterior manualmente.

O script nunca para, reinicia ou remove containers de outros projetos e nunca roda `prune`.

## Desenvolver

```bash
git remote -v          # origin = este repositório, upstream = CopilotKit/OpenBot
git fetch upstream     # novidades do OpenBot
git merge upstream/main  # resolva conflitos, rode os testes, faça push em novabot
bun install && bun run --cwd server typecheck
```

## Configuração principal (`/opt/novabot/.env`, chmod 600)

- `NOVABOT_LOCAL_RUNTIME=true`: modo sem Intelligence.
- `OPENAI_API_KEY` (chave DeepSeek), `OPENAI_BASE_URL=https://api.deepseek.com`, `COPILOTKIT_OPENAI_API=chat`.
- `SUPERVISOR_TOKEN`, `COMPUTER_TOKEN`: segredos dos computadores dos bots.
- Marca: `examples/novagente` (`brand.yaml`, `theme.css`, bots em português).
