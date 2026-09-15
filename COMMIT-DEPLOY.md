# ACHA — commit e deploy

## 1. Antes do commit

No diretório do projeto:

```bash
git status
git diff
npm install
```

O repositório não deve conter:
- `.env`;
- `data/db.json`;
- `data/backups/`;
- `acha-data/`;
- backups SQL;
- arquivos ZIP;
- `node_modules/`.

Para conferir:

```bash
git status --short
git check-ignore -v .env data/db.json
```

## 2. Commit da versão 1.0.98

```bash
git add .
git status
git diff --cached
git commit -m "feat: adicionar migração seletiva de docentes"
git tag v1.0.98
```

Se o repositório remoto estiver configurado:

```bash
git push origin main
git push origin v1.0.98
```

## 3. Teste da migração de docentes

Use o backup desejado sem substituir o `data/db.json` local:

### Windows CMD

```bat
set DB_FILE=C:\caminho\acha-db-backup-2026-09-15T18-07-22-668Z.json
npm run migrate:mysql:docentes
```

Depois:

```sql
SELECT COUNT(*) AS total FROM docentes;
SELECT id, nome, matricula FROM docentes ORDER BY id;
```

O backup enviado para esta versão contém 78 docentes.

## 4. Deploy Docker

A stack usa uma instância MySQL já existente no servidor.

Configure:

```text
MYSQL_HOST=<nome-ou-host-do-mysql-na-database_network>
MYSQL_PORT=3306
MYSQL_USER=<usuario>
MYSQL_PASSWORD=<senha>
MYSQL_DATABASE=acha
```

O ACHA utiliza:
- porta `5001`;
- rede externa `database_network`;
- rede externa `proxy_network`.

O Compose do ACHA **não cria serviço MySQL**.

Antes do deploy, as redes externas precisam existir no Docker:

```bash
docker network ls
```

Se necessário:

```bash
docker network create database_network
docker network create proxy_network
```

O schema do ACHA é inicializado pelo código da aplicação com `CREATE TABLE IF NOT EXISTS`; isso não cria outro servidor MySQL.

## 5. Deploy

```bash
docker compose build
docker compose up -d
docker compose ps
```

Teste:

```text
GET /api/health
```

E verifique:

```text
GET /api/mysql/status
```

Não remova nem recrie o banco `acha` durante o deploy.
