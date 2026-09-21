const fs = require('fs');
const path = require('path');
const { readDatabase } = require('../database/mysql-db');

(async()=>{
  try{
    const db = await readDatabase();
    const dataDir = path.join(__dirname, '..', 'data');
    const backupDir = path.join(dataDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(backupDir, `db-mysql-${stamp}.json`);
    fs.writeFileSync(target, JSON.stringify(db, null, 2), 'utf8');
    console.log('Backup JSON exportado do MySQL:');
    console.log(target);
  } catch (e) {
    console.error('Falha ao exportar backup do MySQL:', e.message);
    process.exitCode = 1;
  }
})();
