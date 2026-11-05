# NOVAGENTE NovaBot — acesso individual com aprovação

## Objetivo
Cada integrante entra com sua própria conta Google ou Microsoft; **não é preciso a administradora cadastrar o e-mail dele previamente**. Na primeira autenticação válida, a identidade é registrada com status **Aguardando aprovação** e sem qualquer papel na aplicação. Só uma pessoa com papel **admin** pode liberar o usuário em **Administração → Pessoas → Aprovar acesso**.

## Código
- Alternância: `NOVABOT_APPROVAL_REQUIRED=true` (somente em implantação já configurada com provedor OAuth). Desativada por padrão: versões atuais preservam a autorização anterior.
- Primeira autenticação: a identidade é criada pelo Better Auth, mas não recebe `user_roles` (exceto `INITIAL_ADMIN_EMAILS`, para preservar o administrador bootstrap).
- `GET /api/access-status` mostra apenas `signed_out`, `pending`, `approved` ou `revoked` da própria sessão.
- `/api/me`, agentes, computadores, memórias e arquivos continuam exigindo `requireUser` com papel real.
- `GET /api/admin/people` exibe usuários com papel `pending`, nome, e-mail identificado pelo provedor e histórico de acesso.
- `POST /api/admin/people/:userId/role` com `{ "role": "user" }` aprova; `admin` diretamente para pendente é recusado.
- `POST /api/admin/people/:userId/access` com `{ "revoked": true }` recusa e revoga; auditoria permanece.
- A tela `/sign` orienta a entrar pelo provedor, avisa que falta aprovação e verifica o status periodicamente.

## Pré-requisitos antes de tornar público
1. **Não desligar `OPENBOT_SINGLE_USER` na VPS sem uma recuperação validada de administradora.** O sistema atual usa `dev-local-user`, e suas informações (conversas, agentes, preferências, credenciais) pertencem àquela identidade. É preciso criar um plano de migração relacional, backup testado e uma conta administradora OAuth que consiga acessar a mesma informação. Mudar somente a configuração de login pode separar os dados da pessoa que os criou.
2. Registrar um cliente **Google OAuth** ou **Microsoft OAuth** e obter identificador e segredo *sem incluí-los no GitHub ou no chat*. Redirect URI normal: `https://novabot.novagente.com.br/api/auth/callback/google` ou `.../microsoft` (confirmar com o provedor escolhido).
3. Configurar `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` **ou** `MICROSOFT_OAUTH_CLIENT_ID`/`MICROSOFT_OAUTH_CLIENT_SECRET`; `BETTER_AUTH_URL=https://novabot.novagente.com.br`, `BETTER_AUTH_SECRET` com pelo menos 32 caracteres, `INITIAL_ADMIN_EMAILS` com o e-mail real da administradora, e `NOVABOT_APPROVAL_REQUIRED=true`. Não usar segredos de exemplo.
4. O gateway atual usa **uma única credencial HTTP Basic** para todos e a aplicação interna está em `OPENBOT_SINGLE_USER`. **Não** dar três senhas do gateway como se fossem três usuários. Fazer uma substituição segura pelo login OAuth, com autenticação interna em todas as rotas e validação do acesso público. Se mantiver proteção externa, ela deve permitir o fluxo OAuth e sessões independentes sem criar uma entrada não autenticada para APIs privadas.
5. Validar em staging: login da administradora, preservação dos dados anteriores, primeiro login de novo usuário → `pending`, acesso negado em `/api/me`, requisições de agentes e arquivos negadas, aprovação como `user` → acesso próprio, recusa, revogação, segunda conta sem acesso à primeira, logout, Cloudflare e PWA.
6. Só então trocar a produção, monitorar a saúde do servidor e manter rollback preparado. Girar a senha compartilhada do gateway após migração, para evitar acessos antigos.

## Aceite
**Nenhuma conta é tratada como aprovada só porque concluiu OAuth; a administradora decide a autorização.** A solução está pronta no código, mas seu uso real depende de configuração OAuth e da migração da conta `dev-local-user`. Até ambos estarem validados, manter a implantação atual protegida.
