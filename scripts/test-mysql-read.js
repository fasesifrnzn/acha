const fs = require('fs');
const path = require('path');
const { readDatabase, testConnection } = require('../database/mysql-db');

const ROOT = path.resolve(__dirname, '..');
const JSON_FILE = process.env.DB_FILE || path.join(ROOT, 'data', 'db.json');
const jsonDb = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

function count(v) { return Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0; }
function offerCount(db) { return Object.values(db.offers || {}).reduce((n, rows) => n + Object.keys(rows || {}).length, 0); }
function placementCount(db) { return (db.pocvScenarios || []).reduce((n, s) => n + (s.placements || []).length, 0); }
function sequenceCount(db) { return Object.values(db.data?.semesters || {}).reduce((n, rows) => n + rows.length, 0); }
function disciplineCount(db) { return Object.values(db.data?.matrices || {}).reduce((n, m) => n + (m.disciplines || []).length, 0); }

(async () => {
  const conn = await testConnection();
  console.log('ACHA — teste da camada de leitura MySQL');
  console.log(`Banco: ${conn.banco} | MySQL: ${conn.versao}`);
  const mysqlDb = await readDatabase();
  const checks = [
    ['semestres', count(jsonDb.data?.semesters), count(mysqlDb.data?.semesters)],
    ['sequencias_matriz_semestre', sequenceCount(jsonDb), sequenceCount(mysqlDb)],
    ['cursos', count(jsonDb.data?.courses), count(mysqlDb.data?.courses)],
    ['matrizes', count(jsonDb.data?.matrices), count(mysqlDb.data?.matrices)],
    ['disciplinas', disciplineCount(jsonDb), disciplineCount(mysqlDb)],
    ['docentes', count(jsonDb.teachers), count(mysqlDb.teachers)],
    ['ofertas', offerCount(jsonDb), offerCount(mysqlDb)],
    ['cenarios_pocv', count(jsonDb.pocvScenarios), count(mysqlDb.pocvScenarios)],
    ['alocacoes_pocv', placementCount(jsonDb), placementCount(mysqlDb)],
    ['usuarios_autenticacao', count(jsonDb.authUsers), count(mysqlDb.authUsers)],
    ['aprovacoes', count(jsonDb.approvals), count(mysqlDb.approvals)],
    ['notificacoes', count(jsonDb.notifications), count(mysqlDb.notifications)]
  ];
  let ok = true;
  for (const [name, a, b] of checks) { const same = a === b; ok &&= same; console.log(`${same ? 'OK  ' : 'ERRO'} ${name.padEnd(32)} JSON=${String(a).padStart(4)} MySQL=${String(b).padStart(4)}${same ? '' : ' <-- diferença'}`); }
  if (ok) console.log('\nLEITURA MySQL CONSISTENTE'); else { console.log('\nFORAM ENCONTRADAS DIFERENÇAS NA LEITURA'); process.exitCode = 1; }
})().catch(err => { console.error(`ERRO: ${err.message}`); process.exitCode = 1; });
