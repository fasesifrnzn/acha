
## V17 — gestão de vínculos docentes

- Substituto temporário exige docente titular associado no cadastro e na edição.
- Associação docente ↔ substituto é 1:1: um titular pode ter no máximo um substituto e um substituto pertence a no máximo um titular.
- Conflitos de associação são rejeitados pela API, sem substituir silenciosamente outro vínculo.
- Novo vínculo `Visitante`, temporário e sem associação a outro docente.
- Ao abrir o cadastro de substituto a partir de um titular, o titular já aparece selecionado.
- A tabela de docentes usa o mesmo padrão visual dos cabeçalhos ordenáveis da tabela de ofertas.
- A lista de `Disciplina / área` dos docentes permanece independente das disciplinas das matrizes dos cursos.

# Oferta Acadêmica — IFRN Campus Natal-Zona Norte

Aplicação web para planejamento de ofertas, turmas, grupos e projeção de carga-horária.

## Estrutura

- `index.html` — oferta por turma e disciplina.
- `projecao.html` — projeção por grupo, com média semestral/anual e edição de docentes.
- `matrizes.html`, `turmas.html`, `grupos.html`, `regras.html` — páginas auxiliares.
- `server.js` — servidor HTTP e API de persistência.
- `data/db.json` — banco de dados inicial da aplicação.

## Execução local

Requer Node.js.

```bash
npm install
npm start
```

Depois acesse `http://localhost:3000`.

## Banco de dados em produção

Por padrão, o servidor usa `./data/db.json`.

Para hospedagem com armazenamento persistente, defina a variável de ambiente:

```text
DB_FILE=/var/data/db.json
```

No Render, o caminho deve corresponder ao diretório onde o Persistent Disk for montado.

## Deploy

- Build Command: `npm install`
- Start Command: `npm start`
- Runtime: Node
- Branch: `main`

O banco **não deve ser tratado como código**: em produção, mantenha `db.json` em armazenamento persistente ou migre posteriormente para PostgreSQL.


## V15 — Gestão de docentes
- Edição completa por linha e exclusão com confirmação.
- Associação bidirecional entre docente titular e professor substituto.
- Cadastro de novo substituto já vinculado ao titular.
- Ordenação pelas colunas e arrastar/reordenar colunas com persistência local.
- Integrações externas (incluindo SUAP) permanecem fora desta versão para manter o núcleo estável.


## V16
- Correções de atualização imediata de vínculos docente-substituto.
- Titulação: Graduação, Especialização, Mestrado, Doutorado e não informado.
- Regime 40h/40 unificado como 40.
- Substituto exibido somente para capacitação, cessão ou cargo de direção.
- Disciplina/área passou a usar combobox com opções das matrizes e edição inline na Oferta.


## Implantação Docker / Portainer

Consulte `README-Docker.md`. A aplicação usa `DB_FILE=/var/data/db.json` e volume persistente `pocv_data`.
