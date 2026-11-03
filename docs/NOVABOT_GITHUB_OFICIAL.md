# Repositório oficial do NovaBot — NOVAGENTE

**Fonte oficial:** https://github.com/novagente-hub/botnovagente  
**Branch estável:** `main`  
**Repositório anterior:** https://github.com/tmbmartell/novabot

## Regra operacional

A partir de 2026-11-03, qualquer desenvolvimento novo do NovaBot deve partir de
`novagente-hub/botnovagente`. O repositório anterior é um espelho histórico,
não uma segunda fonte de verdade. Não faça push, merge ou deploy a partir do
repositório pessoal sem uma decisão de reversão registrada.

Não apague ou arquive o repositório antigo antes de revisar links externos,
integrações, deploys e acessos. A transição do remoto não é um deploy.

## Configurar uma cópia de trabalho

Verifique o remoto antes de alterar qualquer arquivo:

```bash
git remote -v
bash scripts/novabot-canonical-remote.sh --check
```

Para configurar o endereço oficial de forma explícita:

```bash
bash scripts/novabot-canonical-remote.sh --apply
bash scripts/novabot-canonical-remote.sh --check
```

O script não faz fetch, push, merge, reset, deploy ou alteração de credenciais.
Execute-o separadamente em cada checkout do NovaBot que precisa ser migrado.

## Política de integração

1. Crie uma branch a partir da `main` do repositório NOVAGENTE.
2. Abra PR com descrição, testes e impacto em banco/autorização.
3. Exija verificações de formatação, lint, tipo, testes e segurança antes do merge.
4. Migrations devem ter numeração consistente e ser validadas em PostgreSQL
   descartável; não aplique diretamente em produção.
5. Deploy e alterações no servidor são uma ação separada do merge.

## Pendências verificadas em 2026-11-03

- PR de integração: https://github.com/novagente-hub/botnovagente/pull/1
- CI geral do PR falhou em formatação e testes; verificações focadas passaram.
- A versão `main` dos dois repositórios foi conferida no mesmo commit
  `a076c5964e4527d04a16c6d001c27b6ae4ad6fe9`.
- O GitHub identifica `novagente-hub` como conta de usuário, e a conexão
  atual oferece push, mas não acesso de administração. Uma organização
  GitHub com papéis/teams seria recomendável para a governança da equipe.
