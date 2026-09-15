# ACHA — migração somente de docentes

Esta versão adiciona o comando:

    npm run migrate:mysql:docentes

O script lê `DB_FILE` (ou `data/db.json` por padrão) e altera **somente a tabela `docentes`**.
Ofertas, aprovações, notificações, cursos, matrizes e demais tabelas não são migradas nem apagadas.

Para usar especificamente o backup enviado:

Windows CMD:
    set DB_FILE=C:\caminho\acha-db-backup-2026-09-15T18-07-22-668Z.json
    npm run migrate:mysql:docentes

PowerShell:
    $env:DB_FILE="C:\caminho\acha-db-backup-2026-09-15T18-07-22-668Z.json"
    npm run migrate:mysql:docentes

O script:
- valida que o backup possui docentes;
- cria/garante o schema, se necessário;
- atualiza os docentes existentes pelo ID;
- insere docentes novos;
- remove do MySQL docentes que não existem no backup;
- executa tudo em transação;
- não toca nas demais tabelas.
