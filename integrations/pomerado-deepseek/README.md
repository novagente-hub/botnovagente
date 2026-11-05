# NovaBot: Pomerado MCP com DeepSeek (piloto isolado)

**Estado:** testes locais, não conectado à produção.

Este adaptador usa o Pomerado como dependência MIT isolada. Preserva o
harness de criação de integrações MCP (navegação, testes, Guardian e
controle de operações) e substitui exclusivamente o provedor de IA.
Nenhuma chave da OpenAI é exigida.

## Execução

Node 24.21+, na pasta `integrations/pomerado-deepseek`:

```bash
npm ci
npm test
node src/mcp.mjs mint --root /caminho/isolado/para/integracoes
```

O processo precisa de `DEEPSEEK_API_KEY` no ambiente de execução.
Se o NovaBot já usa a chave DeepSeek sob o nome `OPENAI_API_KEY`,
ela somente será aceita se `OPENAI_BASE_URL` for exatamente
`https://api.deepseek.com`. Não coloque segredos no código ou em chats.

O mapeamento do Pomerado usa `deepseek-v4-pro` para construir e
`deepseek-flash` para revisão. Ambos usam a Responses API da DeepSeek.
A criação real de integrações consome créditos DeepSeek; apenas iniciar o
MCP e listar as quatro ferramentas não gera chamadas pagas.

## Testes verificados

- Testes automatizados de mapeamento, credenciais e solicitações sem sessão.
- Inicialização MCP e listagem de ferramentas `mint`, `get_job`,
  `provide_input`, `cancel_job` sem chave OpenAI.

**Ainda falta:** realizar um mint real de leitura, revisão de Guardian,
execução do artefato e conectar com o gateway do NovaBot, que aceita
MCP remoto HTTPS aprovado pelo administrador e não stdio local.

## OAuth da OpenAI

O OAuth do ChatGPT é distinto de um segredo da API. Para usar inferência
por OAuth, a conta deve aprovar escopos próprios da Responses API,
ser elegível, possuir tokens renováveis por usuário e ser usada de forma
isolada, com `store:false` e `stream:true`.

Este piloto **não copia tokens do navegador**, não altera sessões
ChatGPT e não alega que OAuth já está funcionando. A conexão OAuth
depende de fluxo oficial e consentimento do usuário.

## Segurança e próxima integração

Primeiro executar uma tarefa **somente leitura** em site público controlado,
validar um MCP gerado com testes reais, depois criar uma ponte MCP HTTPS
autenticada com isolamento, autorização, auditoria e limites de execução.
Ações de escrita requerem aprovação. Não instalar automaticamente na VPS
de produção ou expor portas de origem.
