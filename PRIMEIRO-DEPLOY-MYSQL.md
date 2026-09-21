# Primeiro deploy do ACHA após a migração para MySQL

## Pré-requisitos

- banco MySQL `acha` já criado no servidor;
- MySQL acessível pela `database_network`;
- `data/db.json` disponível no servidor junto ao Compose;
- variáveis `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD` e `MYSQL_DATABASE` configuradas no Portainer.

## Sequência automática

```text
acha-schema
    ↓
cria/verifica tabelas
    ↓
acha-migrate
    ↓
importa data/db.json
    ↓
acha
    ↓
container:3000 (sem publicação de porta no host)
```

## Segurança da migração inicial

A migração usa `MIGRATION_MODE=initial`.

- Se as tabelas estiverem vazias, importa o JSON.
- Se o banco já tiver semestres, cursos e matrizes, considera a migração inicial concluída e não apaga nada.
- Se houver dados parciais, interrompe para impedir uma limpeza acidental.

## Logs

```bash
docker logs acha-schema
docker logs acha-migrate
docker logs -f acha
```

O log esperado da migração é:

```text
Migração concluída com sucesso.
```
