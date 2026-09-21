# Deploy ACHA no Portainer — v1.0.105

## Por que a v1.0.105 mudou o Compose?

O Portainer pode tentar fazer pull de imagens dos serviços auxiliares de uma Stack quando o ambiente não faz build de `build:` como esperado. Isso causava:

`pull access denied for acha-acha-migrate`

Agora existe apenas um serviço: `acha`, construído diretamente a partir do repositório Git da Stack.

A inicialização ocorre dentro do próprio container:

1. `init-mysql-schema.js`
2. `migrate-json-to-mysql.js` em modo `initial`
3. `server.js`

## Primeiro deploy

No servidor, disponibilize:

```text
docker-compose.yml
data/db.json
Dockerfile
docker-entrypoint.sh
...
```

O MySQL `acha` já deve existir e estar acessível pela `database_network`.

No Portainer, a Stack usa:

```text
5002:5000
```

e:

```text
database_network
proxy_network
```

## Importante: data/db.json

O arquivo de origem da primeira migração precisa existir no servidor em:

```text
./data/db.json
```

Ele é montado como somente leitura.

Não coloque esse arquivo no Git.

## Logs

Depois de subir a Stack:

```bash
docker logs -f acha
```

Esperado:

```text
[1/3] Verificando/criando schema MySQL...
[2/3] Verificando migração inicial...
[3/3] Iniciando ACHA...
```

## Redeploy

O script de migração em modo `initial` verifica o banco antes de limpar qualquer coisa.

- banco vazio: migra;
- banco já migrado: não limpa;
- banco parcialmente preenchido: interrompe para evitar perda de dados.


## Portainer usando repositório Git

O Compose **não define `image:`**. Isso é intencional: o Portainer deve construir a imagem a partir do `Dockerfile` do repositório Git, como no deploy anterior que já funcionava.

Não é necessário fazer `docker login` nem publicar a imagem em Docker Hub.

## Arquivo da primeira migração

Como `data/db.json` não deve ser versionado no Git, informe no Portainer a variável:

```text
ACHA_DATA_PATH=/caminho/no/servidor/onde/está/o/data
```

Esse diretório precisa conter:

```text
db.json
```

O Compose monta esse diretório em `/app/data` somente para leitura.

Se o arquivo estiver dentro do diretório de trabalho da própria Stack, pode deixar:

```text
ACHA_DATA_PATH=./data
```



### Importante: schema.sql no Git

O arquivo `database/schema.sql` precisa estar versionado. O `.gitignore` não pode ignorar esse arquivo, pois o Dockerfile o copia para a imagem de produção.
