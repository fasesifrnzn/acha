# Banco MySQL do ACHA

## Padrão de nomenclatura

As tabelas do banco são nomeadas em **português**, seguindo o domínio do ACHA. Exemplos: `semestres`, `matrizes`, `disciplinas`, `ofertas`, `aprovacoes`, `notificacoes`.

## Carga inicial

1. Crie o banco vazio `acha`.
2. Configure o `.env` com as credenciais MySQL.
3. Execute `npm install`.
4. Execute `npm run migrate:mysql`.
5. Valide com `npm run validate:mysql`.

A migração limpa e recarrega as tabelas do ACHA a partir do snapshot JSON. Use-a apenas para carga inicial, recuperação controlada ou reconstrução do banco; ela não faz parte do fluxo operacional normal.

## Divergências corrigidas na 1.0.84

- `sequencias_matriz_semestre`: a estrutura real fica em `data.semesters` e soma 750 registros no banco atual.
- `turnos`: a estrutura real é `turn[matriz][periodo] = [turnos]`; a carga correta é de 243 registros.
- `alocacoes_pocv`: os IDs são reutilizados entre cenários; a tabela usa chave composta `(cenario_id, id)`, preservando os 342 registros.

## Fonte de persistência — 1.0.94

O MySQL é a fonte única de persistência operacional. O `data/db.json` não é atualizado antes da transação MySQL; após uma gravação bem-sucedida, ele é mantido como cópia de recuperação/compatibilidade. Backups automáticos são gravados em `data/backups/`.

Para exportar manualmente o estado atual do MySQL para JSON:

```bash
npm run backup:mysql
```
