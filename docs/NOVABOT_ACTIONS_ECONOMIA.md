# NovaBot — auditoria de custos GitHub Actions

## Diagnóstico

Segundo a tela de cobrança enviada em 2 de novembro de 2026, o Actions
registrava US$ 13,01 de uso bruto, US$ 13,01 de descontos e US$ 0 faturável;
a franquia de processamento incluída era de US$ 12. Estes números
NÃO significam dívida de US$ 13,01.

GitHub Actions retornou que um job não começou por pagamento recusado ou
limite de gastos. Corrigir os workflows não elimina esse bloqueio; a
titular deve conferir Billing & Licensing.

## Fluxos auditados

- CI: roda em todo Pull Request e em todo push para main. Seu grafo
  contém cerca de 19 jobs efetivos quando todas as matrizes executam,
  incluindo 5 alvos Helm, 2 runtimes de startup (macOS/Windows),
  2 verificações de deployables, navegador Chromium e harness Python.
- NOVAGENTE UI: valida app em separado quando o frontend muda.
- Desktop, Windows signing, publicação de release, segurança/zizmor:
  sem mudança nesta primeira otimização.
- Docker images já eram reservadas à main/release ou PR com label
  full-ci. A salvaguarda é mantida.

## Mudança nesta branch

1. Um classificador barato (scope) calcula os caminhos alterados num PR
   e habilita apenas os grupos relevantes. Conjunto desconhecido,
   arquivo crítico ou falha no diff exige verificação completa.
2. Apenas docs recebe scope e verify. Alteração normal da interface
   recebe static, test, build e o workflow UI existente.
3. Alterações no navegador mantêm testes com Chromium real; no banco
   mantêm migrações; no chart mantêm as cinco variantes Helm.
4. Main e workflow_call (releases) continuam sempre com CI completo.
5. Um revisor pode marcar full-ci no PR para disparar a verificação
   completa, inclusive após o PR já existir, sem novo commit.
6. O job verify segue exigindo que cada job executado passe e que
   o próprio classificador passe; skips seletivos são explícitos.
7. São incluídos testes da política e validação de sintaxe YAML local.

## Economia potencial e limites

Para um PR simples de UI, o CI geral tende a reduzir de aproximadamente
19 jobs potenciais para 5: scope, static, test, build e verify.
O workflow UI separado continua existindo. Isso não equivale a uma
estimativa monetária: duração real, matriz, cancelamentos e tipo de
runner mudam o valor, e não verificamos faturas detalhadas por job.

Manter CI completo em main e releases ainda consome minutos.
Se o uso permanecer excessivo, considerar runners próprios isolados,
com hardening, sem acesso irrestrito ao Docker socket de produção.
O patch não faz merge, deploy, alteração de billing nem de produção.
