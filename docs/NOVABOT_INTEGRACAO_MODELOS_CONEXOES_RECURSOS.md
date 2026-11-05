# NOVAGENTE NovaBot — reconciliação de modelos, Conexões e recursos

## Objetivo

Preparar no GitHub da NOVAGENTE uma integração testável e revisável, sem
modificar os serviços em produção. A branch de integração combina:

- Cadastro seguro de chaves para sete provedores de IA (catálogo e cofre);
- NOVAGENTE Conexões MVP1 (catálogo de aplicações, permissões e auditoria);
- Recursos compartilhados entre Bots e isolamento multiempresa;
- Controle de capacidade dos computadores dos Bots.

## Resolução do conflito de migrações

Duas branches definiam a migração de número 0070. A ordem agora é:

- 0069_isolated_bots: schema preexistente;
- 0070_novagente_conexoes: aplicações e permissões;
- 0071_novabot_shared_resources: recursos privados e concessões de acesso.

O snapshot 0071 contém as quatro tabelas novas e aponta para 0070.
O journal mantém um registro único por número. Foram preservadas as rotas,
os schemas e os componentes visuais de ambas as funcionalidades. A migração
0071 divide seus comandos para execução segura pelo migrador Drizzle.

## Homologação local isolada

- 20 testes Python sobre CI, números, journal e snapshots: aprovados;
- Drizzle Kit check: aprovado;
- Drizzle Kit generate: não encontrou deriva de schema;
- TypeScript do servidor e da interface: aprovado;
- 25 testes de API Keys, Conexões, revogação, capacidade e recursos: aprovados;
- Dois testes Docker Compose: aprovados em modo de leitura da configuração;
- Migrações 0070 e 0071 aplicadas em PostgreSQL descartável e sem rede:
  quatro tabelas e dez constraints verificadas.

Os testes de Docker Compose passaram a comparar os nomes físicos de redes
e volumes qualificados por projeto, e não aliases lógicos compartilhados.

## Limites

- O catálogo de provedores NÃO ativa roteamento automático de inferência
  para todos eles. OAuth é um fluxo separado.
- Conexões MVP1 NÃO ativa login externo real ou sessão de navegador.
- A branch de integração NÃO faz deploy, merge na main nem provisiona
  automaticamente computadores ou clientes.
- Tradução massiva, interface visual experimental e outros workstreams
  permanecem em suas branches para avaliação individual.

## Publicação

Revisar a integração antes do merge. Validar migrations em banco de testes
com dados realistas e permissões multiempresa antes de deploy. Nunca
registrar credenciais reais no Git.

Destino: novagente-hub/botnovagente.
