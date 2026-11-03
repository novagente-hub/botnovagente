# NovaBot — auditoria de alterações e migração do GitHub

**Data:** 02/11/2026
**Destino:** novagente-hub/botnovagente
**Origem:** tmbmartell/novabot

## Conferência

A migração anterior preservou as 11 branches e os hashes de seus commits.
A main de destino foi confirmada idêntica à origem após o espelhamento
(commit a076c5964e4527d04a16c6d001c27b6ae4ad6fe9).

Nos checkouts de desenvolvimento do NovaBot acessíveis na VPS,
não foram encontradas alterações rastreadas sem commit.
Isto não cobre computadores pessoais ou servidores não acessíveis.

## Funcionalidades já comitadas no novo GitHub

| Mudança | Situação | Branch |
| --- | --- | --- |
| PWA instalável e correção do editor no celular | Integrado | main |
| Otimização de custos de GitHub Actions | Integrado | main |
| Cadastro de 7 provedores de API Keys | Comitado, não integrado | feat/model-api-provider-catalog |
| Conexões MVP1: grants, revogação e isolamento | Comitado, não integrado | feat/conexoes-mvp1-permissoes |
| Multiempresa e computadores paralelos | Comitado, não integrado | feature/tenant-isolation-parallel-computers |
| Correções de CI pendentes de revisão | Comitado, não integrado | fix/novabot-ci-final |
| Testes do computador por bot em staging | Comitado, não integrado | feat/computador-por-bot-staging |
| Nova interface conversacional | Comitado, não integrado | feat/novagente-chat-first-ui |
| Traduções de interface para pt-BR | Comitado, não integrado | feat/ui-pt-br |

O catálogo de provedores não ativa automaticamente todos os modelos no runtime.
O MVP de Conexões não ativa login real nem sessão de navegador externa.

## Arquivos locais ainda não versionados

- /opt/novabot/suite-prod.sh: procedimento manual com comandos específicos
  de ambiente e operações sobre contêineres. Não publicado.
- /opt/novabot-staging/suite.sh: diagnóstico de staging. Não publicado;
  testes/staging/suite.sh já existe na branch de computador por bot.
- /opt/novabot-staging/suite-result.txt: resultado de execução, não código.
  Não publicado.

Arquivos operacionais não foram adicionados ao GitHub público para
evitar expor detalhes do ambiente ou executar testes destrutivos por engano.

## Cuidados antes de integrar branches na main

1. As branches de Conexões e de isolamento multiempresa modificam partes
   comuns do aplicativo e contêm migrações 0070 diferentes. Exigem
   reconciliação de esquema, migrações e controle de acesso antes do merge.
2. Mudanças na interface/tradução podem conflitar com a PWA publicada.
3. Validar os testes e revisões da conta GitHub de destino; restrições de
   faturamento da conta anterior não equivalem a falhas do código.
4. Não fazer deploy somente porque o código foi copiado ou comitado.
5. Não publicar tokens, credenciais, cookies, senhas nem dados reais de
   clientes no repositório, atualmente público.

## Resultado

Este registro foi comitado em branch de auditoria sem alterar a main,
as features existentes ou a VPS de produção. A integração de cada
funcionalidade deverá ser avaliada separadamente.
