# ACHA — Assistente de Carga Horária Acadêmica

Aplicação web do IFRN Campus Natal-Zona Norte para apoiar o planejamento da oferta acadêmica, gestão de docentes, alocação, turmas, matrizes curriculares e projeções de carga horária.

## Estado desta versão

**Versão: 1.0.6**

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

