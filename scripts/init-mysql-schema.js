const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(function loadDotEnv(){
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v.replace(/\\n/g, '\n');
  }
})();

async function main() {
  const root = path.resolve(__dirname, '..');
  const schemaPath = path.join(root, 'database', 'schema.sql');
  if (!fs.existsSync(schemaPath)) throw new Error(`Schema não encontrado: ${schemaPath}`);

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'acha',
    multipleStatements: false
  });

  try {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const statements = schema.split(';').map(s => s.trim()).filter(Boolean);

    for (const statement of statements) {
      await conn.query(statement);
    }

    console.log(`Schema MySQL inicializado/verificado com sucesso no banco "${process.env.MYSQL_DATABASE || 'acha'}".`);
    console.log(`Comandos SQL processados: ${statements.length}.`);
    console.log('Nenhuma tabela é apagada e nenhum dado existente é removido por este inicializador.');
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('ERRO ao inicializar schema MySQL:', err.stack || err);
  process.exit(1);
});
