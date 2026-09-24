# ACHA — Assistente de Carga Horária Acadêmica

Aplicação web do IFRN Campus Natal-Zona Norte para apoiar o planejamento da oferta acadêmica, gestão de docentes, alocação, turmas, matrizes curriculares e projeções de carga horária.

## Estado desta versão

**Versão: 1.0.99**

Esta é a versão organizada para retomada do repositório após a última versão historicamente commitada (v17). O desenvolvimento posterior foi consolidado no projeto **ACHA**, atualmente na linha 1.0.x.

Principais recursos consolidados:

- oferta acadêmica por semestre, turma, disciplina e grupo;
- cadastro e gestão de docentes;
- associação de docentes titulares e substitutos;
- docentes visitantes;
- matrizes curriculares e edição da estrutura curricular;
- turmas, grupos e demandas avulsas;
- alocação docente;
- projeções de carga horária por grupo, semestre, turno e cenário;
- cenários plurianuais da oferta;
- normalização de cursos e grupos;
- perfis de acesso por função;
- autenticação institucional via SUAP/IFRN;
- vínculo do usuário institucional por matrícula;
- identificação do curso do coordenador;
- foto do usuário obtida do SUAP no perfil;
- dashboard gerencial com distribuição por grupo, média e meta;
- funções de apoio à gestão para assessoria pedagógica de área, sem redução de sala de aula;
- responsáveis pela distribuição registrados por área/grupo.

## Perfis de acesso

O ACHA possui três níveis institucionais principais:

- **Diretor Geral** — acesso integral;
- **Diretoria Acadêmica** — acesso integral;
- **Coordenador de Curso** — acesso às funcionalidades acadêmicas permitidas, com filtragem pelo curso vinculado.

A autenticação do SUAP confirma a identidade institucional. A autorização dentro do ACHA continua sendo determinada pelo cadastro local de usuários e seus vínculos. As assessorias pedagógicas são funções de apoio à gestão e, nesta versão, não reduzem o índice de sala de aula do docente.

## Estrutura principal

- `index.html` — oferta acadêmica;
- `dashboard.html` — visão consolidada;
- `docentes.html` — gestão de docentes;
- `matrizes.html` — matrizes curriculares;
- `turmas.html` — turmas;
- `grupos.html` — grupos acadêmicos;
- `alocacao.html` — alocação docente;
- `demandas.html` — demandas avulsas;
- `projecao*.html` — projeções de carga horária;
- `pocv.html` — planejamento de cenários plurianuais;
- `perfil.html` — perfil do usuário autenticado;
- `app.js` — recursos compartilhados da interface;
- `style.css` — estilos globais;
- `server.js` — servidor HTTP, API, autenticação e persistência;
- `data/db.json` — snapshot de recuperação/backup; não é a fonte operacional.

## Execução local

Requer **Node.js**.

### Windows

Pode ser usado o arquivo `Iniciar-ACHA.bat`, que localiza o Node.js, encerra um servidor anterior na porta 3000 e inicia o ACHA.

### Terminal

```bash
npm install
npm start
```

Depois acesse `http://localhost:5002`.

O ACHA é uma aplicação Node.js com HTML/CSS/JavaScript no frontend. Não é necessário Django.

## Banco de dados

A partir da versão 1.0.95, o **MySQL é a fonte única de dados operacionais** do ACHA. O servidor carrega o estado do banco antes de abrir a porta HTTP e não usa `db.json` como fallback operacional.

Configure no `.env`:

```text
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=acha
```

O `data/db.json` é mantido apenas como snapshot de recuperação/compatibilidade após gravações bem-sucedidas. Para exportar o estado atual do MySQL:

```bash
npm run backup:mysql
```

## Integração SUAP/IFRN

O login institucional utiliza o fluxo documentado pelo cliente JavaScript oficial do IFRN:

- Authorization Grant Type: **Implicit**;
- Client Type: **Public**;
- Redirect URI local: `http://localhost:5002/login.html`;
- `response_type=token`;
- consulta à API do SUAP com `Bearer access_token`.

A rota utilizada para obter os dados do usuário autenticado é:

```text
GET /api/rh/meus-dados/
```

A documentação detalhada está em `SUAP-INTEGRACAO.md`.

**Não coloque Client Secret no repositório.** O fluxo atual não utiliza Client Secret.

Para configuração local, copie `.env.example` para `.env` e ajuste os valores quando necessário. O `.env` é ignorado pelo Git.

## Configuração da aplicação no SUAP

No cadastro da aplicação ACHA:

- Name: `ACHA`;
- Authorization grant type: `Implicit`;
- Client type: `Public`;
- Redirect URI: definida no ambiente; em produção deve ser `https://acha.fases.site/login.html` e, em desenvolvimento, `http://localhost:3000/login.html`.;
- Algorithm: `No OIDC support`;
- Ativo: marcado.

Não utilize a antiga rota `/api/suap/callback` para o fluxo atual.

## Docker / Portainer

A aplicação possui `Dockerfile` e arquivos Compose para implantação.

```bash
docker compose up -d --build
```

Em produção, use armazenamento persistente para `/var/data` e defina `DB_FILE=/var/data/db.json`.

Consulte `README-Docker.md` para o procedimento de implantação e atualização.


## Persistência e versionamento — 1.0.95

- Dados operacionais: **MySQL**.
- `db.json`: snapshot de recuperação, não fonte de verdade.
- Backups automáticos: `data/backups/` (ou `/var/data/backups` no Docker).
- Não faça alterações manuais no `db.json` para modificar dados de produção.
- Não é necessário versionar dados operacionais no Git.

## Saúde da aplicação

O servidor disponibiliza:

```text
GET /api/health
```

Resposta esperada:

```json
{"ok":true,"service":"acha","timestamp":"..."}
```

## Desenvolvimento e versionamento

O histórico de experimentação das versões intermediárias não faz parte do código de produção. Alterações relevantes consolidadas nesta retomada estão resumidas em `CHANGELOG.md`.

Backups, arquivos `.bak`, registros de testes, dumps temporários e credenciais locais não devem ser versionados.


## Alterações desta versão — 1.0.3

- inclusão da matriz de **Técnico em Manutenção e Suporte em Informática — Integrado**;
- inclusão da matriz de **Técnico em Artesanato — Subsequente**;
- classificação de **Matemática** na área de Ciências da Natureza;
- assessoria de Ciências da Natureza vinculada a Neto e aos grupos Biologia, Física, Química e Matemática;
- manutenção da assessoria de Linguagens e Humanidades vinculada a Luiz Henrique;
- criação do cenário **Simulação — Manutenção Integrado + Artesanato 2028**, clonado do cenário real;
- retirada, na simulação, das novas entradas de Manutenção diurno a partir de 2028;
- novas entradas anuais de Manutenção Integrado a partir de 2028, iniciando no turno vespertino e alternando anualmente;
- novas entradas anuais de Artesanato Subsequente a partir de 2028, sempre no turno oposto à nova entrada de Manutenção;
- cenário real protegido contra edição;
- formulários de criação de cenário, edição de oferta e variáveis da POCV apresentados em modais sobre a tela;
- seleção de cursos na criação de cenário com nome amigável, preservando o identificador interno.


### Indicadores
A página `indicadores.html` reproduz a estrutura da aba **Indicadores** da planilha de referência usando os dados disponíveis em cada cenário da POCV. O detalhamento do plano de oferta é alimentado diretamente pelos metadados cadastrados nas matrizes e pelas ofertas/coortes do cenário, incluindo vagas por semestre e turno.

As matrizes possuem campos específicos para: **Campus, Nível da oferta, Forma da oferta, Formato da oferta, Organização da oferta, Tipo de participação, Fomento externo para carga horária docente, Nome do curso, Carga horária anualizada (horas), Verticalização da oferta, Diretoria Acadêmica responsável e FCC**.

A carga horária anualizada é uma medida em **horas de relógio**, não em h/a. Indicadores que dependam de bases institucionais externas permanecem identificados como não disponíveis quando o banco do ACHA não possui os dados necessários.

### Docker — Redes externas

A aplicação principal é conectada, via `docker-compose.yml`, às redes Docker externas:

- `database_network`
- `proxy_network`

As redes devem existir previamente no host Docker. Para conferir/criar:

```bash
docker network ls
docker network create database_network
docker network create proxy_network
```

Depois:

```bash
docker compose up -d --build
```



## Migração seletiva de docentes — v1.0.98

A versão 1.0.98 inclui uma migração específica para atualizar **somente a tabela `docentes`** a partir de um backup JSON:

```bash
npm run migrate:mysql:docentes
```

A fonte pode ser informada pela variável `DB_FILE`. O script atualiza docentes existentes pelo ID, insere novos e remove do MySQL os docentes que não existem no backup informado. As demais tabelas não são alteradas.

Exemplo no Windows:

```bat
set DB_FILE=C:\caminho\acha-db-backup-2026-09-15T18-07-22-668Z.json
npm run migrate:mysql:docentes
```


## Docker — inicialização do schema MySQL

No Compose de produção existem dois serviços do projeto:

- `acha-schema`: executa `database/schema.sql` uma vez para criar/verificar as tabelas;
- `acha`: inicia somente depois que `acha-schema` termina com sucesso.

O MySQL **não é criado pelo Compose**. Ele deve existir previamente e estar acessível pela `database_network`.

Mapeamento de portas:

```text
host:5002 → container:5000
```

A inicialização do schema é idempotente e não apaga dados existentes.

Para subir:

```bash
docker compose build
docker compose up -d
```

Para acompanhar a preparação do schema:

```bash
docker logs acha-schema
```
