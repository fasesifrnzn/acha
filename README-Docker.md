# ACHA — implantação Docker / Portainer

## Stack

O projeto possui:

- `Dockerfile`;
- `docker-compose.yml`;
- `docker-compose.bind.yml`;
- `.dockerignore`;
- endpoint `/api/health`;
- volume persistente para o banco;
- variável `DB_FILE=/var/data/db.json`.

### Deploy no Portainer

1. Acesse **Stacks → Add stack**.
2. Use o `docker-compose.yml` do repositório.
3. Faça o deploy.
4. Acesse `http://IP-DO-SERVIDOR:3000`.

### Persistência

O banco deve ficar fora do container, em armazenamento persistente:

```text
acha_data:/var/data
```

O arquivo utilizado pelo servidor é:

```text
/var/data/db.json
```

**Não remova o volume durante uma atualização.**

### Atualização

1. atualize o código no repositório;
2. faça o rebuild/redeploy da Stack;
3. preserve o volume de dados.

### Backup

Antes de atualizações importantes, faça backup do `db.json` persistido.

### Teste de saúde

```text
GET /api/health
```

A resposta deve indicar `ok: true` e o serviço `acha`.

### Porta

A configuração padrão publica:

```text
3000:3000
```

Se necessário, altere somente a porta externa, por exemplo `8080:3000`.

## Bind mount

`docker-compose.bind.yml` permite manter o banco em uma pasta explícita do host:

```text
./acha-data:/var/data
```

Para produção, o volume nomeado é a opção preferencial da configuração inicial.
