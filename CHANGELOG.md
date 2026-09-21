# Changelog

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

# Changelog — ACHA

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
