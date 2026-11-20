# NOVABOT — revisão de sincronização da versão 95 (20/11/2026)

> **Documento de integração. Não representa atualização do código executável deste repositório.**
> A versão pública do site e o repositório de código da organização são destinos distintos.

## Situação verificada

- Imagem de produção: `botnovagente:release-20261120-95`, saudável na Contabo no momento da conferência.
- Referência do código usado no build: `52ad7c0dd353e60a34cb886265564dfed2eed70f`.
- Esta branch foi criada a partir de `novagente-hub/botnovagente:main` para revisão, sem substituir código ou histórico.
- A comparação entre o código de build e esta `main` apontou **11.170 arquivos divergentes**, incluindo grandes remoções e inclusões. Os repositórios não compartilham o mesmo ancestral adequado para um simples fast-forward.
- O commit do build não está disponível como objeto Git neste repositório; não pode ser apontado aqui sem uma importação de objetos.
- O repositório da organização é **público**. Uma importação integral de outro repositório precisa de auditoria de dados, segredos, dependências e licenças antes da publicação.

## Estratégia sem sobrescrita

1. **Manter a `main` atual intacta.** Nada de `force push` nem substituição da árvore inteira.
2. Inventariar funcionalidades específicas da NOVAGENTE, preservando as alterações que já existem neste repositório.
3. Auditar os arquivos a publicar: credenciais, dados de clientes, binários, mídia, dependências e proveniência de código.
4. Extrair módulos em mudanças pequenas e revisáveis, com testes de compatibilidade deste repositório.
5. Executar CI e homologar o comportamento de plugins/MCPs, isolamento de empresas e navegador persistente, antes de integrar código na `main`.
6. Publicar apenas após teste de rollback, segurança e confirmação da versão implantada.

## Limites explícitos

Esta proposta **não** habilita chamadas pagas da DeepSeek, acesso ao navegador, execução de MCPs, envio de mensagens ou novas permissões de rede. As funcionalidades de laboratório devem permanecer desligadas por padrão. Uma implantação saudável não equivale à homologação comercial.

**Decisão pendente da revisão:** reconciliar as arquiteturas ou designar um único repositório canônico para o código de produção, com o outro reservado a distribuição/documentação. Nenhum segredo, imagem Docker ou código privado integral é incluído neste PR.
