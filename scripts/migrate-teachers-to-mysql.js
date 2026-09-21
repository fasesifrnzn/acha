const fs = require('fs');
const path = require('path');

(function loadDotEnv(){
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v.replace(/\\n/g, '\n');
  }
})();

const mysql = require('mysql2/promise');

const ROOT = path.resolve(__dirname, '..');
const DB_FILE = process.env.DB_FILE || path.join(ROOT, 'data', 'db.json');

function json(v) { return JSON.stringify(v ?? null); }
function num(v) { return v === '' || v === undefined || v === null ? null : Number(v); }

async function execSchema(conn) {
  const schemaPath = path.join(ROOT, 'database', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema não encontrado: ${schemaPath}`);
  }
  const schema = fs.readFileSync(schemaPath, 'utf8');
  for (const statement of schema.split(';').map(s => s.trim()).filter(Boolean)) {
    await conn.query(statement);
  }
}

async function main() {
  if (!fs.existsSync(DB_FILE)) {
    throw new Error(`Arquivo DB_FILE não encontrado: ${DB_FILE}`);
  }

  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const teachers = Array.isArray(db.teachers) ? db.teachers : [];

  if (!teachers.length) {
    throw new Error(`Nenhum docente encontrado em ${DB_FILE}. Migração cancelada para evitar apagar a tabela docentes.`);
  }

  const ids = teachers.map(t => Number(t.id)).filter(Number.isFinite);
  if (ids.length !== teachers.length || new Set(ids).size !== ids.length) {
    throw new Error('Os docentes do backup possuem IDs inválidos ou duplicados. Migração cancelada.');
  }

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'acha',
    multipleStatements: false
  });

  try {
    await execSchema(conn);
    await conn.beginTransaction();

    try {
      // Importante: esta migração altera SOMENTE a tabela docentes.
      // As demais tabelas (ofertas, aprovações, notificações etc.) permanecem intactas.
      const [beforeRows] = await conn.query('SELECT id FROM docentes');
      const beforeIds = beforeRows.map(r => Number(r.id));
      const backupIdSet = new Set(ids);

      const insertSql = `INSERT INTO docentes
        (id,nome,disciplina,grupo,titulacao,regime,percentual_regime,
         situacao_afastamento,percentual_afastamento,gestao,percentual_gestao,
         fator_aula,vinculo,matricula,coordenador_curso_id,coordenador_curso_nome,
         substituto_id,substituto_de_id,area_gestao,grupos_distribuicao,dados_legado)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          nome=VALUES(nome),
          disciplina=VALUES(disciplina),
          grupo=VALUES(grupo),
          titulacao=VALUES(titulacao),
          regime=VALUES(regime),
          percentual_regime=VALUES(percentual_regime),
          situacao_afastamento=VALUES(situacao_afastamento),
          percentual_afastamento=VALUES(percentual_afastamento),
          gestao=VALUES(gestao),
          percentual_gestao=VALUES(percentual_gestao),
          fator_aula=VALUES(fator_aula),
          vinculo=VALUES(vinculo),
          matricula=VALUES(matricula),
          coordenador_curso_id=VALUES(coordenador_curso_id),
          coordenador_curso_nome=VALUES(coordenador_curso_nome),
          substituto_id=VALUES(substituto_id),
          substituto_de_id=VALUES(substituto_de_id),
          area_gestao=VALUES(area_gestao),
          grupos_distribuicao=VALUES(grupos_distribuicao),
          dados_legado=VALUES(dados_legado)`;

      for (const t of teachers) {
        await conn.query(insertSql, [
          t.id,
          t.name,
          t.discipline,
          t.group,
          t.degree,
          t.regime,
          num(t.regimePct),
          t.leave,
          num(t.leavePct),
          t.management,
          num(t.managementPct),
          num(t.classFactor),
          t.vinculo,
          t.matricula,
          t.coordinatorCourseId,
          t.coordinatorCourseName,
          num(t.substituteId),
          num(t.substituteForId),
          t.managementArea,
          json(t.distributionGroups || []),
          json(t)
        ]);
      }

      // Remove docentes que existiam no MySQL, mas não existem no backup.
      // Se algum deles estiver referenciado por outra tabela, o DELETE falha
      // e toda a operação é revertida, evitando deixar referências quebradas.
      const idsToDelete = beforeIds.filter(id => !backupIdSet.has(id));
      for (const id of idsToDelete) {
        await conn.query('DELETE FROM docentes WHERE id=?', [id]);
      }

      await conn.commit();

      const [afterRows] = await conn.query('SELECT id FROM docentes ORDER BY id');
      const afterIds = afterRows.map(r => Number(r.id));
      const sameIds = afterIds.length === ids.length && afterIds.every((id, i) => id === [...ids].sort((a,b)=>a-b)[i]);

      console.log('Migração de docentes concluída com sucesso.');
      console.log(`Fonte: ${DB_FILE}`);
      console.log(`Docentes no backup: ${teachers.length}`);
      console.log(`Docentes no MySQL após migração: ${afterRows.length}`);
      console.log(`IDs exatamente correspondentes: ${sameIds ? 'SIM' : 'NÃO'}`);
      console.log(`Docentes novos/atualizados: ${ids.filter(id => !beforeIds.includes(id)).length} novos; ${ids.filter(id => beforeIds.includes(id)).length} existentes atualizados.`);
      console.log(`Docentes removidos do MySQL por não estarem no backup: ${idsToDelete.length}`);
      console.log('Nenhuma outra tabela foi alterada por este script.');
    } catch (e) {
      await conn.rollback();
      throw e;
    }
  } finally {
    await conn.end();
  }
}

main().catch(e => {
  console.error('ERRO na migração de docentes:', e.stack || e);
  process.exit(1);
});
