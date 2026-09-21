# CHANGELOG

## 1.0.114
- Reformulação das ações da visão do Coordenador: validar + menu de opções por linha.
- Solicitação de alteração de nome e mudança de grupo com modais específicos.
- Escolha de optativa disponível no menu e atualização imediata do nome exibido enquanto aguarda aprovação.
- Permissões de visualização bloqueiam ações também no backend.

# ACHA v1.0.112

## 1.0.112 — correções do fluxo do coordenador

- Corrige a abertura da janela de demanda avulsa na visão do coordenador.
- Permite solicitar alterações de oferta mesmo quando a única alteração é o turno.
- Corrige o salvamento das optativas para coordenadores, registrando a solicitação para validação.
- A visão do coordenador passa a iniciar com o filtro de status em “Todos”, mantendo as ofertas visíveis após confirmação, alteração ou exclusão.
- Ajusta o botão de limpar filtros para preservar esse comportamento na visão do coordenador.

# ACHA v1.0.111

## 1.0.111 — correção do menu lateral no celular

- corrige o conflito de CSS que mantinha a barra lateral com `display: none` em telas móveis;
- o menu lateral volta a ser exibido ao clicar no botão de menu;
- mantém o backdrop/escurecimento e o fechamento ao clicar fora ou em um item do menu.

# ACHA v1.0.110

## 1.0.110 — porta interna 3000 e acesso via Nginx Proxy Manager

- altera a porta HTTP interna do ACHA de 5000 para 3000;
- remove a publicação da porta no host;
- mantém a porta 3000 disponível na rede Docker para acesso pelo Nginx Proxy Manager;
- atualiza o healthcheck para a porta 3000;
- atualiza a identificação de versão exibida pelo servidor para 1.0.110.

# ACHA v1.0.109

## Deploy Docker — migração inicial para MySQL
- `db.json` passa a ser empacotado na imagem Docker e deixa de depender de volume externo no primeiro deploy.
- Removido o volume `./data:/app/data` do `docker-compose.yml`, que sobrescrevia o `db.json` presente na imagem.
- Removida a exclusão de `data/db.json` do `.dockerignore`, garantindo que o arquivo seja incluído no build.
- Mantida a migração em modo `initial`: o `db.json` é usado como fonte somente quando o banco MySQL ainda não contém dados.
- O MySQL continua sendo a fonte de dados de produção após a migração.

# Changelog

## 1.0.115
- Corrige os eventos dos botões de validar e do menu de ações do Coordenador.
- Ativa abertura/fechamento do menu suspenso e execução das ações solicitar exclusão, alteração de nome, mudança de grupo e escolha de optativa.


## 1.0.107 — incluir schema.sql no build Git/Docker

- corrigido o `.gitignore`, que estava ignorando `*.sql` e impedia o `database/schema.sql` de ser versionado no Git;
- `database/schema.sql` passa a ser explicitamente incluído na imagem Docker;
- corrige `Schema não encontrado: /app/database/schema.sql` no primeiro deploy pelo Portainer;
- mantém o fluxo schema → migração inicial → aplicação.


## 1.0.106 — correção do build no Portainer

- removido `image: acha:...` do Compose;
- Portainer volta a construir a imagem diretamente do repositório Git configurado na Stack;
- elimina o erro `pull access denied for acha`;
- mantém o primeiro deploy no mesmo container: schema → migração inicial → aplicação;
- adicionada variável `ACHA_DATA_PATH` para disponibilizar o `db.json` sem versioná-lo no Git;
- mantém `5002:5000` e as redes externas.


## 1.0.105 — Docker/Portainer: inicialização em container único

- removidos os serviços `acha-schema` e `acha-migrate` do Compose;
- schema e migração inicial passam a ser executados pelo entrypoint do próprio ACHA;
- evita que Portainer tente fazer pull de imagens intermediárias como `acha-acha-migrate`;
- mantém MySQL externo;
- mantém `5002:5000`;
- primeira inicialização: schema → migração segura → aplicação;
- redeploy: se o banco já estiver populado, a migração inicial não limpa nem recarrega os dados.


## 1.0.104 — primeiro deploy MySQL: schema + migração inicial

- o Compose passa a executar três etapas na ordem: `acha-schema` → `acha-migrate` → `acha`;
- a primeira migração usa `data/db.json` como fonte;
- a migração inicial é protegida: se o banco já contiver dados completos, não limpa nem migra novamente;
- se o banco estiver parcialmente preenchido, a migração é interrompida para evitar perda de dados;
- o ACHA só inicia depois da conclusão bem-sucedida da migração inicial;
- `acha-migrate` monta `./data` em modo somente leitura;
- permanece o MySQL externo, sem serviço `mysql:` no Compose;
- porta externa `5002` e porta interna `5000`.


## 1.0.103 — inicialização resiliente do schema MySQL

- o ACHA passa a verificar/criar o schema antes da primeira leitura do MySQL;
- `readDatabase()` não depende mais exclusivamente do serviço `acha-schema` do Docker Compose;
- mantém-se o serviço `acha-schema` como inicialização explícita do deploy;
- corrige o cenário em que o container ACHA inicia com o banco criado, mas sem as tabelas `semestres` e demais tabelas do schema;
- inicialização continua idempotente com `CREATE TABLE IF NOT EXISTS`.


## 1.0.102 — compactação da tabela de projeção

- grade de carga horária passa a ocupar toda a largura disponível;
- colunas de semestre ficam compactadas para exibir o período completo em telas desktop;
- rolagem horizontal é preservada apenas para telas menores, mantendo legibilidade;
- tabela de ofertas recebe o mesmo comportamento de largura no desktop.


## 1.0.100 — correção POCV/projeção

- restauradas as funções auxiliares da POCV removidas durante a limpeza do pacote;
- corrigidos `ensurePocvScenarios`, `buildInitialPocvScenario` e `normalizePocvScenario`;
- restaurados `matrixDuration` e `cohortTurn` necessários à projeção;
- corrige o erro `ensurePocvScenarios is not defined` na página de Cenários;
- a Projeção volta a receber os cenários e ofertas reconstruídos do MySQL.


## 1.0.99 — Docker + inicialização do schema MySQL

- porta externa `5002` e porta interna `5000`;
- serviço `acha-schema` para inicialização idempotente do schema;
- MySQL continua sendo externo e compartilhado;
- ACHA depende da conclusão bem-sucedida do inicializador de schema;
- redes externas `database_network` e `proxy_network` mantidas;
- nenhum dado é apagado pelo inicializador do schema;
- adicionada documentação do fluxo de produção.


## 1.0.98 — migração seletiva de docentes

- adicionada `npm run migrate:mysql:docentes`;
- migração lê `DB_FILE` e trabalha exclusivamente com `teachers` → `docentes`;
- atualização por ID com inserção de novos docentes;
- remoção de docentes ausentes no backup;
- operação transacional com rollback em caso de erro;
- demais tabelas não são alteradas;
- versão preparada para versionamento Git;
- `.gitignore` reforçado para não versionar credenciais, dados persistidos, backups e arquivos ZIP;
- Docker ajustado para porta 5001 e redes externas `database_network` e `proxy_network`;
- Docker não cria instância MySQL própria.

# ACHA 1.0.96

- Corrigido o parser JSON das requisições HTTP (`body(req)`), necessário ao login SUAP e demais endpoints POST/PUT.
- Mantida a arquitetura MySQL como fonte única.

# ACHA — Changelog

## 1.0.95 — correção do endpoint JSON
- Corrigida a função `send()` ausente no servidor, que causava `ReferenceError` nas APIs.
- Mantida a arquitetura MySQL como fonte única operacional.
- Mantidos backups JSON apenas para recuperação/compatibilidade.

# CHANGELOG

## 1.0.95

- MySQL passa a ser a fonte única de dados operacionais.
- Estado inicial da aplicação é carregado do MySQL antes de abrir a porta HTTP.
- Removido fallback silencioso para `db.json` na leitura operacional.
- `db.json` passa a ser exclusivamente snapshot de recuperação/compatibilidade.
- Gravações atualizam o snapshot JSON somente após sucesso da transação MySQL.
- Falha definitiva de persistência recarrega o estado do MySQL para evitar manter no cache uma alteração não persistida.
- Docker/Compose passam a declarar `mysql2` e as variáveis `MYSQL_*` corretamente.
- Versão HTTP/terminal atualizada para 1.0.95.

# Changelog

## 1.0.107 — incluir schema.sql no build Git/Docker

- corrigido o `.gitignore`, que estava ignorando `*.sql` e impedia o `database/schema.sql` de ser versionado no Git;
- `database/schema.sql` passa a ser explicitamente incluído na imagem Docker;
- corrige `Schema não encontrado: /app/database/schema.sql` no primeiro deploy pelo Portainer;
- mantém o fluxo schema → migração inicial → aplicação.


## 1.0.106 — correção do build no Portainer

- removido `image: acha:...` do Compose;
- Portainer volta a construir a imagem diretamente do repositório Git configurado na Stack;
- elimina o erro `pull access denied for acha`;
- mantém o primeiro deploy no mesmo container: schema → migração inicial → aplicação;
- adicionada variável `ACHA_DATA_PATH` para disponibilizar o `db.json` sem versioná-lo no Git;
- mantém `5002:5000` e as redes externas.


## 1.0.105 — Docker/Portainer: inicialização em container único

- removidos os serviços `acha-schema` e `acha-migrate` do Compose;
- schema e migração inicial passam a ser executados pelo entrypoint do próprio ACHA;
- evita que Portainer tente fazer pull de imagens intermediárias como `acha-acha-migrate`;
- mantém MySQL externo;
- mantém `5002:5000`;
- primeira inicialização: schema → migração segura → aplicação;
- redeploy: se o banco já estiver populado, a migração inicial não limpa nem recarrega os dados.


## 1.0.104 — primeiro deploy MySQL: schema + migração inicial

- o Compose passa a executar três etapas na ordem: `acha-schema` → `acha-migrate` → `acha`;
- a primeira migração usa `data/db.json` como fonte;
- a migração inicial é protegida: se o banco já contiver dados completos, não limpa nem migra novamente;
- se o banco estiver parcialmente preenchido, a migração é interrompida para evitar perda de dados;
- o ACHA só inicia depois da conclusão bem-sucedida da migração inicial;
- `acha-migrate` monta `./data` em modo somente leitura;
- permanece o MySQL externo, sem serviço `mysql:` no Compose;
- porta externa `5002` e porta interna `5000`.


## 1.0.103 — inicialização resiliente do schema MySQL

- o ACHA passa a verificar/criar o schema antes da primeira leitura do MySQL;
- `readDatabase()` não depende mais exclusivamente do serviço `acha-schema` do Docker Compose;
- mantém-se o serviço `acha-schema` como inicialização explícita do deploy;
- corrige o cenário em que o container ACHA inicia com o banco criado, mas sem as tabelas `semestres` e demais tabelas do schema;
- inicialização continua idempotente com `CREATE TABLE IF NOT EXISTS`.


## 1.0.102 — compactação da tabela de projeção

- grade de carga horária passa a ocupar toda a largura disponível;
- colunas de semestre ficam compactadas para exibir o período completo em telas desktop;
- rolagem horizontal é preservada apenas para telas menores, mantendo legibilidade;
- tabela de ofertas recebe o mesmo comportamento de largura no desktop.


## 1.0.100 — correção POCV/projeção

- restauradas as funções auxiliares da POCV removidas durante a limpeza do pacote;
- corrigidos `ensurePocvScenarios`, `buildInitialPocvScenario` e `normalizePocvScenario`;
- restaurados `matrixDuration` e `cohortTurn` necessários à projeção;
- corrige o erro `ensurePocvScenarios is not defined` na página de Cenários;
- a Projeção volta a receber os cenários e ofertas reconstruídos do MySQL.
 — ACHA

## 1.0.93
- Define o MySQL como fonte primária de persistência.
- `writeDB()` deixa de atualizar o `db.json` antes da gravação; a transação MySQL é executada primeiro.
- O `db.json` passa a ser mantido como cópia de recuperação/compatibilidade somente após sucesso no MySQL.
- Cria backups automáticos em `data/backups/` após sincronizações bem-sucedidas.
- Adiciona `npm run backup:mysql` para exportar manualmente o estado atual do MySQL para JSON.
- Mantém o mecanismo de retry da sincronização e o endpoint `/api/mysql/status`.

## 1.0.92
- Avança a migração para MySQL como fonte efetiva de leitura da API.
- Remove a sobreposição silenciosa das estruturas operacionais pelo `db.json` quando o modo MySQL está ativo.
- A API aguarda a sincronização MySQL pendente antes de realizar novas leituras.
- Persiste `extraOffers` e `pocvConfig` em `sistema_metadados` para não depender desses dados exclusivamente do JSON.
- Atualiza o identificador de versão exibido pelo servidor e pelo backup.

## 1.0.91
- Corrige a persistência imediata das confirmações críticas no MySQL.
- Confirmação direta de oferta agora salva no JSON e aguarda a sincronização MySQL antes de responder sucesso.
- Em falha do MySQL, mantém o JSON e agenda nova tentativa.
- Adiciona `/api/mysql/status` para diagnóstico do último estado de sincronização.
- Adiciona `npm run test:mysql:sync` para verificar ofertas e confirmações no MySQL.

## v1.0.113 — Permissões por configuração na visão Coordenador

- A visualização de Coordenador pela Direção passa a usar a configuração real de acesso do perfil, sem forçar Edição.
- Perfil com Visualização não exibe ações de cadastro, edição, exclusão, validação, seleção em lote ou salvamento.
- Perfil com Edição mantém as ações e permite salvar normalmente.
- O modo "Visualizar como" também respeita o nível configurado no backend, impedindo mutações quando o perfil simulado é somente leitura.
