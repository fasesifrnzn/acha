# ACHA — Assistente de Carga Horária Acadêmica

Aplicação web do IFRN Campus Natal-Zona Norte para apoiar o planejamento da oferta acadêmica, gestão de docentes, alocação, turmas, matrizes curriculares e projeções de carga horária.

## Estado desta versão

Esta é a primeira versão organizada para retomada do repositório após a última versão historicamente commitada (v17). O código incorpora o desenvolvimento realizado posteriormente, atualmente identificado como v76, mas o projeto passa a adotar **ACHA** como nome oficial.

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
- foto do usuário obtida do SUAP no perfil.

## Perfis de acesso

O ACHA possui três níveis institucionais principais:

- **Diretor Geral** — acesso integral;
- **Diretoria Acadêmica** — acesso integral;
- **Coordenador de Curso** — acesso às funcionalidades acadêmicas permitidas, com filtragem pelo curso vinculado.

A autenticação do SUAP confirma a identidade institucional. A autorização dentro do ACHA continua sendo determinada pelo cadastro local de usuários e seus vínculos.

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
- `data/db.json` — base inicial da aplicação.

## Execução local

Requer **Node.js**.

### Windows

Pode ser usado o arquivo `Iniciar-ACHA.bat`, que localiza o Node.js, encerra um servidor anterior na porta 3000 e inicia o ACHA.

### Terminal

```bash
npm install
npm start
```

Depois acesse `http://localhost:3000`.

O ACHA é uma aplicação Node.js com HTML/CSS/JavaScript no frontend. Não é necessário Django.

## Banco de dados

A fonte única de dados da aplicação é `data/db.json`, acessada pelas páginas por meio da API HTTP do `server.js`.

Em produção, recomenda-se usar armazenamento persistente e definir:

```text
DB_FILE=/var/data/db.json
```

O banco de produção deve ser preservado durante atualizações do container.

## Integração SUAP/IFRN

O login institucional utiliza o fluxo documentado pelo cliente JavaScript oficial do IFRN:

- Authorization Grant Type: **Implicit**;
- Client Type: **Public**;
- Redirect URI local: `http://localhost:3000/login.html`;
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
- Redirect URI: `http://localhost:3000/login.html`;
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
