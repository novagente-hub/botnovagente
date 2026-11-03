# NovaBot — MVP 2: missões persistentes e retomada segura

## Decisão

Este PR é empilhado sobre `feat/novabot-autonomia-harness-mvp1` (PR #4).
Não integra nenhuma branch à `main`, não modifica produção nem implanta
na VPS de execução. O MVP 2 é um **piloto de backend**: ainda não há painel
de missões nem ferramenta de criação por linguagem natural na interface.

## Funcionamento implementado

- Missão salva em PostgreSQL (`nb_missions`) com objetivo, resultado esperado,
  proprietário, bot, canal, chave de idempotência, ciclo e estado.
- Livro de eventos ordenado (`nb_mission_events`) para auditar cada mudança.
- Criação pela **API autenticada**, que valida a participação do usuário no
  canal e o Bot associado; outras operações sempre filtram pelo usuário.
- Executor headless que reutiliza o `createTurnRunner` atual e a fila
  PostgreSQL `work_items`; um ciclo consulta as missões pendentes, oferece
  trabalhos com chave única e reivindica no máximo uma por vez.
- Uma missão gravada mas ainda não oferecida volta à fila após reinício.
- A fila usa lease. Quando uma execução perdeu o lease, uma nova reivindicação
  **não repete as ferramentas**, pois seus efeitos podem ser desconhecidos:
  a missão passa para revisão humana.
- Toda ação usa as concessões atuais do proprietário; o Bot/canal são
  revalidados imediatamente antes de executar.
- A resposta do modelo vai para `needs-review`, nunca diretamente para
  `completed`. Somente uma confirmação autenticada com evidência fecha
  a missão neste MVP.
- No máximo três ciclos (primeiro + até duas retomadas autorizadas). Não se
  retoma uma pendência de aprovação por um botão comum, impedindo bypass.
- Cancelamento rejeitado durante execução: o usuário deve pausar o Bot por
  seu fluxo próprio; não declaramos cancelado algo que pode estar executando.

## Estados

`queued` → `running` → `needs-review` → confirmação `completed`.

Em caso de ferramenta que precise de pessoa:
`running` → `needs-approval`.

Em caso de execução interrompida:
`running` → `needs-review`, com erro indicando resultado desconhecido.

O proprietário pode reenfileirar de `needs-review` explicitamente, após
revisar possíveis efeitos externos. `cancelled` e `completed` são terminais.

## Ativação somente em homologação

Configurar no arquivo de ambiente de uma instalação de **testes isolada**:

```dotenv
NOVABOT_MISSIONS_ENABLED=true
NOVABOT_AUTONOMY_ENABLED=true
```

Ambas vêm desligadas por padrão. A primeira liga API, armazenamento e executor;
a segunda liga o comportamento orientado a resultado criado no MVP 1.
`server` recebe essas variáveis pelo `env_file` do Compose; o `agent-bot`
recebe `NOVABOT_AUTONOMY_ENABLED` conforme PR #4.

### API autenticada (piloto técnico)

Todos os endpoints exigem a sessão do usuário e não aceitam `ownerId` no
corpo. O identificador do usuário vem do middleware de autenticação.

```http
POST /api/missions
Content-Type: application/json

{
  "agentId": "bot-existente",
  "channelId": "canal-do-usuario",
  "goal": "Identifique e corrija a falha no ambiente de homologação.",
  "successCriteria": "Os testes relevantes passam e há um resultado comprovável.",
  "idempotencyKey": "uuid-estavel-gerado-pelo-cliente"
}
```

O servidor responde **202** com a missão. O `idempotencyKey` impede que dois
cliques ou uma retransmissão criem duas missões. Um mesmo valor com objetivo
diferente é rejeitado.

- `GET /api/missions`: últimas 100 missões do usuário autenticado.
- `GET /api/missions/:id`: missão e histórico de estados.
- `POST /api/missions/:id/resume`, corpo
  `{"acknowledgeUnknownEffects":true}`: apenas após revisão dos efeitos.
- `POST /api/missions/:id/verify`, corpo
  `{"evidence":"Conferi o resultado no ambiente de testes"}`: confirmação
  humana, não produzida pelo modelo.
- `POST /api/missions/:id/cancel`: só se não estiver executando.

## Estratégia de persistência

O PostgreSQL existente hospeda `nb_missions` e `nb_mission_events`, criadas
por `CREATE TABLE IF NOT EXISTS` **somente com a flag habilitada**. Isso segue
o padrão experimental `nb_threads` / `nb_agent_memory` da modalidade local.

É uma decisão **provisória** para não competir com as migrações `0070` e
`0071` que estão em PR aberto. Antes de liberar para clientes, padronizar a
migração no journal Drizzle, testar rollback, backup, retenção e limites por
usuário/empresa. Não migrar esta branch sozinha para `main`.

## Testes obrigatórios antes de qualquer push

1. Testes de estado e retomada sem replay.
2. Testes da fila com executor simulado, inclusive lease reobtido.
3. Testes HTTP com autenticação e recusa de usuário/canal diferente.
4. Teste de PostgreSQL temporário isolado: idempotência, concorrência,
   trilha de eventos, transições, autorização e retomada.
5. `bun run --cwd server typecheck`, Biome lint e format nos arquivos alterados.
6. Conferir `git diff --check` e ausência de segredos.
7. Rodar GitHub CI no PR e homologar o fluxo real com um Bot de testes.

## Limites conhecidos

- A interface ainda não possui botão de missão, nem criação conversacional.
  O piloto é exercido pela API; o painel fica para o MVP 4.
- A verificação de resultado é **humana**, não outro modelo/verificador
  independente. Validador automatizado fica para o MVP 3.
- O runner suporta um turno headless por ciclo; uma tarefa longa que exceda
  esse turno precisará de nova rodada explicitamente autorizada.
- O lease de execução é de 10 minutos, acima do limite de 5 minutos do
  `runTurn` existente. Nenhuma ação externa é refeita automaticamente
  após falha ambígua.
- Sem migração nativa multiempresa ainda. Para clientes externos, continuar
  usando instalações separadas, como recomenda `NOVABOT_MULTIEMPRESA.md`.
- Sem limites monetários de uso ou métricas completas de custo por missão.
  Isso precisa ser concluído antes de ativação comercial.

## Próxima entrega

MVP 3: validador independente por tipo de missão, orçamento de custo/tempo,
aprovações e acesso a evidências; MVP 4: painel visual de missões e criação
conversacional.
