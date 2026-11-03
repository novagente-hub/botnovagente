# NovaBot — Autonomia verificável (MVP 1)

## Objetivo

Quando alguém pedir um resultado, o Bot deve tentar resolvê-lo com os recursos
que **já está autorizado** a utilizar: diagnosticar, executar, observar a
resposta, corrigir a estratégia quando uma tentativa falhar e só declarar
conclusão mediante evidência.

Arquitetura inspirada na abordagem de tarefas, execução e recuperação de
`deepseek-ai/dsh-superagent-prototype` (MIT). **Não** instala o DeepSeek
Harness, nem copia seu runtime, nem muda o provedor de IA atual.

## Escopo implementado

- Guia de atuação com objetivo -> tentativa -> observação -> nova hipótese ->
  verificação de resultado, injetado pelo mesmo ponto central de orientação
  dos Bots com computador e pelas integrações AG-UI.
- Flag por processo `NOVABOT_AUTONOMY_ENABLED=true`. O padrão é **desligado**,
  sem alteração no comportamento da instalação atual.
- `agent-bot` tem guarda de execução obrigatória: no máximo **12 ações de
  ferramenta por pedido** e **4 resultados classificados como falha**;
  resultados de permissão negada ou ação sem resposta verificável interrompem
  novas chamadas de ferramentas. O limite também vale para várias chamadas
  propostas no mesmo retorno do modelo.
- A contagem é refeita a partir do histórico AG-UI do pedido atual, que o
  NovaBot já persiste; não depende de contador de memória no processo.
- As outras integrações que recebem a orientação central têm por ora **apenas
  o comportamento orientado por prompt**, sem a guarda de execução do
  `agent-bot`. Nunca apresentar o limite como proteção global.
- Testes unitários para recuperação, limites, falta de confirmação, nova
  solicitação, recusa por política e diferenciação entre erro e sucesso.

## O que este MVP ainda não faz

- Não cria uma missão autônoma independente da conversa, com fila própria,
  disparadores sem solicitação ou continuidade sem um novo turno AG-UI.
- Não automatiza PR, deploy, revisão ou uso de ferramentas não concedidas.
- Não transforma uma recusa de permissão em autorização para tentar por outro
  caminho.
- Não prova sucesso funcional apenas porque os testes de unidade passam.
- Não implementa limite de custo monetário nem de tempo entre turnos; esses
  exigem telemetria e permissões controladas no servidor.

## Homologação segura

1. Manter esta branch em PR; não atualizar a VPS de produção neste ciclo.
2. Instalar a aplicação em ambiente de teste separado e configurar
   `NOVABOT_AUTONOMY_ENABLED=true` no arquivo `.env` **do ambiente de testes**.
   O Compose passa a flag aos serviços **server** e **agent-bot**; configurar
   **agent-langgraph** separadamente apenas quando esse serviço existir.
3. Confirmar: uma ferramenta falha com erro recuperável; o Bot usa outra
   alternativa permitida e verifica se resolveu.
4. Confirmar: uma ferramenta reporta recusa por política; o Bot informa o
   impedimento e não repete a operação.
5. Confirmar: um efeito externo retorna sem comprovante de resultado; o Bot
   não repete a ação potencialmente irreversível.
6. Confirmar: após o limite de tentativas, o Bot reporta o resultado parcial,
   sem novas chamadas.
7. Confirmar: pedido novo tem orçamento de tentativas próprio.
8. Revisar logs, limite de custo/tempo, uso de computador, privacidade e
   isolamento antes de avaliar produção.

## Próximos ciclos

- **MVP 2: Missões persistentes** no Postgres/queue já existentes: objetivo,
  estados, responsável, evidências, conclusão e retomada após reinício, sem
  depender de uma aba de chat aberta.
- **MVP 3: Validador independente** por tipo de tarefa, plano de contingência,
  budgets de custo/tempo e aprovação humana para operações sensíveis.
- **MVP 4: Painel da autonomia** mostrando Trabalhando, Validando, Aguardando
  autorização, Bloqueado, Concluído e evidências.

O protótipo da DeepSeek declara explicitamente ser pesquisa, não produto
pronto. Este MVP adapta princípios, não adota código de execução privilegiada.
