# POCV — implantação Docker / Portainer

## Opção recomendada: Stack no Portainer

O projeto já possui:

- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- endpoint `/api/health`
- volume persistente `pocv_data`
- variável `DB_FILE=/var/data/db.json`

### Deploy

No Portainer:

1. **Stacks → Add stack**.
2. Dê um nome, por exemplo `pocv`.
3. Use **Web editor** e cole o conteúdo do `docker-compose.yml`, ou faça o deploy a partir de um repositório Git que contenha estes arquivos.
4. Faça o deploy da stack.
5. Acesse:

`http://IP-DO-SERVIDOR:3000`

### Persistência

O banco não fica dentro do container. Ele fica no volume Docker:

`pocv_data:/var/data`

Portanto, recriar/atualizar o container não deve apagar os dados.

O arquivo persistido é:

`/var/data/db.json`

### Atualização

Ao alterar o código:

1. atualize os arquivos no repositório;
2. faça o redeploy/rebuild da Stack;
3. mantenha o volume `pocv_data`.

**Não remova o volume durante a atualização.**

### Backup

Antes de atualizações importantes, faça backup do volume `pocv_data` ou copie o `db.json` persistido.

## Teste de saúde

O container disponibiliza:

`GET /api/health`

Resposta esperada:

```json
{"ok":true,"service":"pocv","timestamp":"..."}
```

## Porta

Por padrão:

`3000:3000`

Se a porta 3000 já estiver ocupada, altere apenas a porta externa, por exemplo:

`8080:3000`

Nesse caso o acesso será:

`http://IP-DO-SERVIDOR:8080`

## Bind mount

Também existe `docker-compose.bind.yml`, caso o administrador prefira manter o banco em uma pasta explícita no host:

`./pocv-data:/var/data`

Para produção, a opção com volume nomeado é a recomendada inicialmente.
