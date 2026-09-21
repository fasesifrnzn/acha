# ACHA — Arquitetura de dados

## Versão 1.0.95

### Fonte única

O **MySQL é a fonte única de dados operacionais**. A aplicação carrega o estado do ACHA a partir do banco durante a inicialização e mantém esse estado em memória para atender as requisições.

As gravações são persistidas no MySQL primeiro. Somente após uma transação bem-sucedida o snapshot JSON é atualizado como recuperação/compatibilidade.

### Fluxo

```text
                ┌──────────────┐
                │     ACHA     │
                └──────┬───────┘
                       │
              leitura / gravação
                       │
                       ▼
                ┌──────────────┐
                │    MySQL     │
                │    acha      │
                └──────────────┘
                       │
                 backup após
                  sucesso
                       ▼
                ┌──────────────┐
                │   db.json    │
                │ recuperação  │
                └──────────────┘
```

### Regra de operação

- Não editar `db.json` manualmente para alterar dados de produção.
- Não usar `db.json` como fonte alternativa quando o MySQL estiver indisponível.
- Se o MySQL não estiver acessível na inicialização, o ACHA não sobe.
- O comando `npm run backup:mysql` exporta um snapshot do MySQL.

### Migração

Os scripts `migrate-json-to-mysql.js`, `validate-json-vs-mysql.js` e `test-mysql-read.js` permanecem no repositório para auditoria, recuperação e validação. Eles não fazem parte do fluxo operacional normal.
