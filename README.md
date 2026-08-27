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
