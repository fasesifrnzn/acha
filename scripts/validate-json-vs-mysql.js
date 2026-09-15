const fs = require('fs');
const mysql = require('mysql2/promise');
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
    if ((v.startsWith('\"') && v.endsWith('\"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v.replace(/\\n/g, '\n');
  }
})();
const ROOT=path.resolve(__dirname,'..');
const db=JSON.parse(fs.readFileSync(process.env.DB_FILE||path.join(ROOT,'data','db.json'),'utf8'));
const connCfg={host:process.env.MYSQL_HOST||'127.0.0.1',port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER||'root',password:process.env.MYSQL_PASSWORD||'',database:process.env.MYSQL_DATABASE||'acha'};
const count=o=>Array.isArray(o)?o.length:Object.values(o||{}).reduce((n,v)=>n+(Array.isArray(v)?v.length:typeof v==='object'&&v?count(v):0),0);
function jsonCounts(){
 const sem=Object.values(db.data?.semesters||{}).reduce((n,a)=>n+a.length,0);
 const turn=Object.values(db.turn||{}).reduce((n,periods)=>n+Object.values(periods||{}).reduce((m,a)=>m+(Array.isArray(a)?a.length:0),0),0);
 const placements=(db.pocvScenarios||[]).reduce((n,s)=>n+(s.placements||[]).length,0);
 return {semestres:Object.keys(db.data?.semesters||{}).length,sequencias_matriz_semestre:sem,cursos:(db.data?.courses||[]).length,matrizes:Object.keys(db.data?.matrices||{}).length,disciplinas:Object.values(db.data?.matrices||{}).reduce((n,m)=>n+(m.disciplines||[]).length,0),periodos_disciplinas:Object.values(db.data?.matrices||{}).reduce((n,m)=>n+(m.disciplines||[]).reduce((x,d)=>x+Object.keys(d.periods||{}).length,0),0),turnos:turn,docentes:(db.teachers||[]).length,ofertas:Object.values(db.offers||{}).reduce((n,r)=>n+Object.keys(r||{}).length,0),cenarios_pocv:(db.pocvScenarios||[]).length,alocacoes_pocv:placements,usuarios_autenticacao:(db.authUsers||[]).length,areas_pedagogicas:Object.keys(db.pedagogicalAreaResponsibilities||{}).length,grupos_areas_pedagogicas:Object.values(db.pedagogicalAreaResponsibilities||{}).reduce((n,a)=>n+(a.groups||[]).length,0),responsabilidades_distribuicao_grupos:Object.keys(db.groupDistributionResponsibility||{}).length,aprovacoes:(db.approvals||[]).length,notificacoes:(db.notifications||[]).length,exclusoes_ofertas:Object.values(db.offerDeletions||{}).reduce((n,r)=>n+Object.keys(r||{}).length,0)};
}
async function main(){const c=await mysql.createConnection(connCfg);const tables={semestres:'semestres',sequencias_matriz_semestre:'sequencias_matriz_semestre',cursos:'cursos',matrizes:'matrizes',disciplinas:'disciplinas',periodos_disciplinas:'periodos_disciplinas',turnos:'turnos',docentes:'docentes',ofertas:'ofertas',cenarios_pocv:'cenarios_pocv',alocacoes_pocv:'alocacoes_pocv',usuarios_autenticacao:'usuarios_autenticacao',areas_pedagogicas:'areas_pedagogicas',grupos_areas_pedagogicas:'grupos_areas_pedagogicas',responsabilidades_distribuicao_grupos:'responsabilidades_distribuicao_grupos',aprovacoes:'aprovacoes',notificacoes:'notificacoes',exclusoes_ofertas:'exclusoes_ofertas'};const jc=jsonCounts();let ok=true;console.log('\nACHA — validação db.json × MySQL');console.log(`Banco: ${connCfg.host}:${connCfg.port}/${connCfg.database}\n`);for(const [k,t] of Object.entries(tables)){const [r]=await c.query(`SELECT COUNT(*) total FROM ${t}`);const mv=Number(r[0].total),jv=jc[k];const good=mv===jv;ok=ok&&good;console.log(`${good?'OK ':'ERRO'} ${k.padEnd(35)} JSON=${String(jv).padStart(5)} MySQL=${String(mv).padStart(5)}${good?'':'  <-- diferença'}`);}console.log(ok?'\nVALIDAÇÃO CONSISTENTE':'\nVALIDAÇÃO COM DIVERGÊNCIAS');await c.end();process.exit(ok?0:2)}main().catch(e=>{console.error(e.stack||e);process.exit(1)});
