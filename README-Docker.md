# ACHA — implantação Docker / Portainer

## Arquitetura atual

A partir da versão 1.0.95, o **MySQL é a fonte única de dados operacionais** do ACHA.

O arquivo `db.json` não é banco operacional. Ele é mantido apenas como **cópia de recuperação/backup** no volume persistente.

### Variáveis obrigatórias

Configure no Portainer/ambiente do container:

```text
MYSQL_HOST=<nome-ou-host-do-mysql-na-database_network>
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=<senha>
MYSQL_DATABASE=acha
```

O container não inicia se não conseguir carregar o estado do ACHA a partir do MySQL. Isso evita que uma indisponibilidade do banco seja mascarada por dados antigos em JSON.

## Deploy no Portainer

1. Atualize o código do repositório.
2. Garanta que a rede do MySQL esteja disponível para o container.
3. Configure as variáveis `MYSQL_*`.
4. Faça **Rebuild/Deploy** da Stack.
5. Preserve o volume `acha_data` (ou o bind mount configurado).

## Persistência

O banco operacional fica no MySQL:

```text
acha
```

O volume do ACHA é usado para backups:

```text
/var/data/backups
```

O arquivo `/var/data/db.json` também é mantido como snapshot de recuperação, mas **não é utilizado como fonte operacional**.

## Backup

Exportação manual do MySQL para JSON:

```bash
npm run backup:mysql
```

Também são gerados snapshots automáticos após gravações bem-sucedidas.

## Atualização

1. faça backup do MySQL;
2. atualize o código;
3. faça rebuild/redeploy;
4. não remova o banco `acha`;
5. não remova o volume de backups.

## Saúde

```text
GET /api/health
```

A aplicação também disponibiliza:

```text
GET /api/mysql/status
```

para consultar o estado da última persistência.
