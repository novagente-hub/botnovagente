# NOVAGENTE NovaBot — login por código no e-mail + aprovação

## Objetivo

Jacques, Thais, Arthur e outras pessoas informam **o próprio e-mail**, recebem um código de **seis dígitos** válido por **cinco minutos** e solicitam acesso automaticamente. Tiara não precisa informar antecipadamente os e-mails dos colaboradores.

A confirmação do código cria uma identidade individual, **sem permissão** de trabalhar no NovaBot. Em **Administração → Pessoas**, a administradora vê a pessoa como **Aguardando aprovação** e escolhe **Aprovar acesso** (papel `user`) ou **Recusar**. Os demais endpoints continuam protegidos por `requireUser`. A solicitação não dá acesso a agentes, conversas, memória ou arquivos.

## Implementação no código

- Plugin `emailOTP` do Better Auth (servidor e cliente); OTP de seis dígitos, validade de cinco minutos, máximo de cinco tentativas de verificação.
- Limites de requisição por IP para envio (três por minuto) e confirmação (cinco por minuto).
- Remetente: serviço **Resend** via HTTPS, sem dependência npm adicional. Nenhuma credencial é enviada ao navegador nem salva no GitHub.
- O envio deve ser aceito pelo serviço; falhas não são tratadas como e-mail entregue. O e-mail contém somente o código e o aviso de expiração.
- Entrada: `/sign`; autenticação em duas etapas (e-mail → código). A própria tela informa quando está pendente e acompanha a aprovação.
- Status individual: `GET /api/access-status` → `signed_out`, `pending`, `approved` ou `revoked`; não expõe diretório nem segredos.
- Painel: `Administração → Pessoas`; `POST /api/admin/people/:userId/role` aprova somente como `user` quando pendente; `POST /api/admin/people/:userId/access` recusa ou revoga.
- O identificador de usuário é individual no banco, sem compartilhar a identidade `dev-local-user`.

## Configuração necessária para ativar

A configuração somente por e-mail **não precisa Google Cloud**. Entretanto, exige uma conta de envio de e-mails (Resend), um domínio remetente verificado no serviço e e-mail **da administradora** para o primeiro login. Não são necessários os e-mails dos outros integrantes.

No backend, em ambiente protegido, configurar:

```dotenv
NOVABOT_APPROVAL_REQUIRED=true
NOVABOT_OTP_RESEND_API_KEY=<segredo_fornecido_pelo_servico>
NOVABOT_OTP_FROM=login@dominio-verificado.example
BETTER_AUTH_URL=https://novabot.novagente.com.br
BETTER_AUTH_SECRET=<segredo_aleatorio_forte>
INITIAL_ADMIN_EMAILS=<email_verificado_da_administradora>
```

Não colocar valores reais no GitHub, mensagens, logs ou documentos. O código exige `NOVABOT_OTP_RESEND_API_KEY` e `NOVABOT_OTP_FROM` juntos; o remetente precisa ter domínio verificado. A flag de aprovação, quando não configurada, mantém o comportamento anterior.

## Migração obrigatória do NovaBot atual

**Não desligar `OPENBOT_SINGLE_USER` diretamente em produção.** O sistema atual usa o ator `dev-local-user` e um único HTTP Basic Auth externo. Conversas, agentes, memória, dados e credenciais podem estar ligados ao id antigo. Trocar apenas o login criaria uma conta nova e daria a impressão de perda desses dados.

1. Fazer backup verificável do PostgreSQL, dos volumes e de arquivos do agente.
2. Inspecionar tabelas que referenciam `dev-local-user`; planejar migração do proprietário para a nova identidade de administradora preservando integridade, controles de acesso e vínculos.
3. Testar em staging o primeiro login da administradora com e-mail, aprovar perfis e verificar os dados migrados. Preparar rollback.
4. Substituir o gateway HTTP Basic compartilhado por uma entrada pública compatível com código por e-mail e **autenticação interna** da aplicação; não deixar rotas de agente sem proteção.
5. Testar solicitações, limites de tentativas, código expirado/inválido, aprovação, recusa, revogação, sessões independentes, compartilhamento intencional de bots, controle do Chrome e downloads, Cloudflare e PWA.
6. Só publicar depois de testar com um e-mail real e confirmação da administradora, acompanhando a saúde e mantendo rollback.

## Estado da entrega

**Código implementado e testado em branch/PR. Não está ativo em produção.** Sem chave e domínio remetente válidos, a entrega real do código por e-mail não pode ser testada; sem migração da conta atual, não se deve mudar a autenticação pública.
