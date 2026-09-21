# Changelog

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
