const http=require('http');
const fs=require('fs');
const path=require('path');
const url=require('url');
const crypto=require('crypto');
const https=require('https');
const { readDatabase: readMySQLDatabase } = require('./database/mysql-db');
const { syncDatabase: syncMySQLDatabase } = require('./database/mysql-sync');

// Carrega automaticamente o arquivo .env local, sem depender de dotenv.
// O segredo do SUAP permanece no servidor e nunca é enviado ao navegador.
(function loadDotEnv(){
  try{
    const envPath=path.join(__dirname,'.env');
    if(!fs.existsSync(envPath)) return;
    const lines=fs.readFileSync(envPath,'utf8').split(/\r?\n/);
    for(const line of lines){
      const trimmed=line.trim();
      if(!trimmed || trimmed.startsWith('#')) continue;
      const m=trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if(!m) continue;
      const key=m[1], raw=m[2];
      if(process.env[key]!==undefined) continue;
      let value=raw;
      if((value.startsWith('"')&&value.endsWith('"')) || (value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
      process.env[key]=value.replace(/\\n/g,'\n');
    }
  }catch(e){ console.warn('Não foi possível carregar .env:',e.message); }
})();

const SUAP_OAUTH={
  clientId:String(process.env.SUAP_CLIENT_ID||'Q5F9WuFPXVdTMVel6lBUdb3Z3kplWk17MiKools4').trim(),
  // O fluxo JavaScript do cliente oficial do IFRN é Implicit + Public:
  // o Client Secret NÃO é usado nem armazenado pelo ACHA.
  redirectUri:String(process.env.SUAP_REDIRECT_URI||'http://localhost:3000/login.html').trim(),
  baseUrl:String(process.env.SUAP_BASE_URL||'https://suap.ifrn.edu.br').replace(/\/$/,''),
  scope:String(process.env.SUAP_SCOPE||'identificacao email documentos_pessoais').trim()
};
function suapConfigured(){return !!(SUAP_OAUTH.clientId&&SUAP_OAUTH.redirectUri)}

function httpRequestJson(method,target,headers={},bodyText=''){
  return new Promise((resolve,reject)=>{
    const u=new URL(target);
    const finalHeaders={...headers,'Content-Length':Buffer.byteLength(bodyText)};
    const req=https.request({hostname:u.hostname,path:u.pathname+u.search,port:u.port||443,method,headers:finalHeaders},res=>{
      let data='';res.setEncoding('utf8');res.on('data',c=>data+=c);res.on('end',()=>{
        let parsed;try{parsed=JSON.parse(data)}catch(e){parsed={raw:data}};
        if(res.statusCode>=200&&res.statusCode<300)resolve(parsed);
        else {
          let detail=typeof parsed==='object'&&parsed?JSON.stringify(parsed):String(data||'').trim();
          if(detail.length>1000) detail=detail.slice(0,1000)+'...';
          const err=new Error(`SUAP HTTP ${res.statusCode} em ${u.pathname}${detail?` — ${detail}`:''}`);
          err.statusCode=res.statusCode;err.url=u.toString();err.body=parsed;reject(err);
        }
      });
    });
    req.on('error',reject);if(bodyText)req.write(bodyText);req.end();
  });
}

async function suapUserRequest(accessToken){
  const endpoint='/api/rh/meus-dados/';
  const headers={'Authorization':`Bearer ${accessToken}`,'Accept':'application/json'};
  return httpRequestJson('GET',`${SUAP_OAUTH.baseUrl}${endpoint}`,headers,'');
}
function normalizePersonName(v){return String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ')}
function authUserPayload(db,user){
  const teacher=(db.teachers||[]).find(t=>String(t.id)===String(user.teacherId));
  return {id:user.id,teacherId:user.teacherId,displayName:user.displayName,role:user.role,matricula:teacher?.matricula||user.suapMatricula||'',coordinatorCourseId:teacher?.coordinatorCourseId||'',coordinatorCourseName:teacher?.coordinatorCourseName||'',managementArea:teacher?.managementArea||'',distributionGroups:teacher?.distributionGroups||[],photoData:user.photoData||'',suapPhotoUrl:user.suapPhotoUrl||'',suapLinked:!!user.suapUsername};
}

const ROOT=__dirname;
// In production, set DB_FILE to a path on persistent storage (e.g. /var/data/db.json).
// Locally, the database lives in ./data/db.json.
const DB_FILE=process.env.DB_FILE || path.join(ROOT,'data','db.json');
let dbCache=null;
let dbReady=false;
const PORT=process.env.PORT||3000;
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};

function ensureDB(){
  const dir=path.dirname(DB_FILE);
  if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});
  if(!fs.existsSync(DB_FILE)){
    const legacyCandidates=[path.join(ROOT,'db.json'),path.join(ROOT,'data','db.json')];
    const legacy=legacyCandidates.find(f=>fs.existsSync(f));
    if(legacy)fs.copyFileSync(legacy,DB_FILE);
    else throw new Error(`Banco de dados não encontrado: ${DB_FILE}`);
  }
}
const MANAGEMENT_FACTORS={
  'Não se aplica':1,
  'Coordenação de Curso':0.5,
  'Função Gratificada (FG)':0.5,
  'Direção Acadêmica':0.15,
  'Função Sistêmica':0.15,
  'Direção-Geral':0,
  'Assessor Pedagógico de Área: Ciências da Natureza':1,
  'Assessor Pedagógico de Área: Linguagens e Humanidades':1
};

const PEDAGOGICAL_AREA_RESPONSIBILITIES={
  'Ciências da Natureza':['Biologia','Física','Química','Matemática'],
  'Linguagens e Humanidades':['Artes','Educação Física','Espanhol','Filosofia','Geografia','História','Inglês','Português','Sociologia']
};
function applyPedagogicalAreaResponsibility(teacher){
  const m=String(teacher?.management||'');
  if(m==='Assessor Pedagógico de Área: Ciências da Natureza'){
    teacher.managementArea='Ciências da Natureza';
    teacher.distributionGroups=[...PEDAGOGICAL_AREA_RESPONSIBILITIES['Ciências da Natureza']];
  }else if(m==='Assessor Pedagógico de Área: Linguagens e Humanidades'){
    teacher.managementArea='Linguagens e Humanidades';
    teacher.distributionGroups=[...PEDAGOGICAL_AREA_RESPONSIBILITIES['Linguagens e Humanidades']];
  }else{
    delete teacher.managementArea;
    delete teacher.distributionGroups;
  }
  return teacher;
}

const DEFAULT_POCV_CONFIG={
  defaultVacancies:40,
  specializationVacancies:60,
  teacherHours:20
};
function pocvConfig(db){
  const c=(db&&db.pocvConfig)||{};
  return {
    defaultVacancies:Number(c.defaultVacancies)>0?Number(c.defaultVacancies):DEFAULT_POCV_CONFIG.defaultVacancies,
    specializationVacancies:Number(c.specializationVacancies)>0?Number(c.specializationVacancies):DEFAULT_POCV_CONFIG.specializationVacancies,
    teacherHours:Number(c.teacherHours)>0?Number(c.teacherHours):DEFAULT_POCV_CONFIG.teacherHours
  };
}
function courseForMatrix(db,matrixId){
  return (db.data?.courses||[]).find(x=>String(x.matrix)===String(matrixId))||{};
}
function defaultVacanciesForMatrix(db,matrixId){
  const c=courseForMatrix(db,matrixId);
  const text=String(c.course_name||c.name||c.form||c.type||'');
  const type=String(c.type||'');
  const form=String(c.form||'');
  const isSpecial=/especializa[cç][aã]o/i.test(`${text} ${type} ${form}`) ||
    /p[oó]s[- ]?gradua[cç][aã]o/i.test(`${text} ${type} ${form}`);
  const cfg=pocvConfig(db);
  return isSpecial?cfg.specializationVacancies:cfg.defaultVacancies;
}

const LEAVE_FACTORS={
  'Não se aplica':1,
  'Redução por Saúde 25%':0.75,
  'Redução por Saúde 50%':0.5,
  'Cessão a outro órgão':0,
  'Afastamento capacitação (100%)':0,
  'Capacitação parcial – 50%':0.5
};
function normalizeRegime(value){const v=String(value??'').trim();if(!v)return '';if(/^40(?:h|\s*horas?)$/i.test(v))return '40';if(/^20(?:h|\s*horas?)$/i.test(v))return '20';return v}
function canHaveSubstitute(teacher){
  const leave=String(teacher?.leave||'');
  return (/capacita[cç][aã]o/i.test(leave) && !/parcial/i.test(leave)) ||
    /cess[aã]o/i.test(leave) ||
    /dire[cç][aã]o/i.test(String(teacher?.management||''));
}
function applyTeacherFactor(teacher){
  applyPedagogicalAreaResponsibility(teacher);
  teacher.regime=normalizeRegime(teacher.regime);
  teacher.regimePct=Number.isFinite(Number(teacher.regimePct))?Number(teacher.regimePct):1;
  teacher.managementPct=MANAGEMENT_FACTORS[teacher.management]??1;
  teacher.leavePct=LEAVE_FACTORS[teacher.leave]??1;
  teacher.classFactor=Number((teacher.regimePct*teacher.managementPct*teacher.leavePct).toFixed(2));
  return teacher;
}
function readDB(){
  if(!dbReady || !dbCache) throw new Error('Banco MySQL ainda não foi inicializado.');
  (dbCache.teachers||[]).forEach(applyTeacherFactor);
  ensureWorkflow(dbCache);
  return dbCache;
}

const PAGE_CATALOG=[
  ['dashboard.html','Início'],['index.html','Oferta'],['pocv.html','Cenários'],['alocacao.html','Alocação'],['projecao-cenario.html','Projeção'],['indicadores.html','Indicadores'],['matrizes.html','Matrizes'],['turmas.html','Turmas'],['docentes.html','Docentes'],['grupos.html','Grupos'],['regras.html','Regras'],['variaveis.html','Variáveis'],['demandas.html','Demandas avulsas'],['backup.html','Backup'],['perfil.html','Meu perfil'],['acessos.html','Gerenciamento de acesso'],['pendencias.html','Pendências'],['notificacoes.html','Notificações']
];
const PAGE_IDS=new Set(PAGE_CATALOG.map(([p])=>p));
const PERMISSION_LEVELS=new Set(['none','view','edit']);
const ACCESS_DEFAULTS={
  diretor_geral:{label:'Diretor Geral',pages:Object.fromEntries(PAGE_CATALOG.map(([p])=>[p,'edit'])),semesterFrom:'2024.1',semesterTo:'2034.2',features:{'oferta.previsao':true}},
  diretoria_academica:{label:'Diretoria Acadêmica',pages:Object.fromEntries(PAGE_CATALOG.map(([p])=>[p,'edit'])),semesterFrom:'2024.1',semesterTo:'2034.2',features:{'oferta.previsao':true}},
  coordenador_curso:{label:'Coordenador de Curso',pages:Object.fromEntries(PAGE_CATALOG.map(([p])=>[p,'none'])),semesterFrom:'2026.1',semesterTo:'2030.2',features:{'oferta.previsao':false}},
  coordenador_area:{label:'Coordenação de Área',pages:Object.fromEntries(PAGE_CATALOG.map(([p])=>[p,'none'])),semesterFrom:'2024.1',semesterTo:'2034.2',features:{'oferta.previsao':false}}
};
ACCESS_DEFAULTS.coordenador_curso.pages['dashboard.html']='edit';
ACCESS_DEFAULTS.coordenador_curso.pages['index.html']='edit';
ACCESS_DEFAULTS.coordenador_curso.pages['alocacao.html']='edit';
ACCESS_DEFAULTS.coordenador_curso.pages['matrizes.html']='edit';
ACCESS_DEFAULTS.coordenador_curso.pages['turmas.html']='edit';
ACCESS_DEFAULTS.coordenador_curso.pages['demandas.html']='edit';
ACCESS_DEFAULTS.coordenador_curso.pages['notificacoes.html']='edit';
['dashboard.html','index.html','alocacao.html','matrizes.html','turmas.html','perfil.html','notificacoes.html'].forEach(p=>ACCESS_DEFAULTS.coordenador_area.pages[p]='view');
ACCESS_DEFAULTS.diretor_geral.pages['pendencias.html']='edit';
ACCESS_DEFAULTS.diretor_geral.pages['notificacoes.html']='edit';
ACCESS_DEFAULTS.diretoria_academica.pages['pendencias.html']='edit';
ACCESS_DEFAULTS.diretoria_academica.pages['notificacoes.html']='edit';
function accessConfig(db){
  const src=db?.accessControl?.profiles||{};
  const out={version:1,profiles:{}};
  for(const [role,base] of Object.entries(ACCESS_DEFAULTS)){
    const cur=src[role]||{};
    const pages={...base.pages,...(cur.pages||{})};
    for(const p of PAGE_IDS) if(!PERMISSION_LEVELS.has(pages[p])) pages[p]=base.pages[p]||'none';
    out.profiles[role]={label:String(cur.label||base.label),pages,semesterFrom:String(cur.semesterFrom||base.semesterFrom),semesterTo:String(cur.semesterTo||base.semesterTo),features:{...base.features,...(cur.features||{})}};
  }
  return out;
}
function roleAccess(db,user){return accessConfig(db).profiles[user?.role]||null;}
function pagePermission(db,user,page){
  const a=roleAccess(db,user); if(!a)return 'none';
  return a.pages?.[page]||'none';
}
function hasPageAccess(user,page,db){
  if(!user)return false;
  return pagePermission(db,user,page)!=='none';
}
function hasPageEdit(user,page,db){return !!user && pagePermission(db,user,page)==='edit';}
function semesterInAccessRange(db,user,semester){
  const a=roleAccess(db,user); if(!a)return false;
  const idx=semesterIndex(semester), from=semesterIndex(a.semesterFrom), to=semesterIndex(a.semesterTo);
  if(idx==null)return false; return (from==null||idx>=from)&&(to==null||idx<=to);
}
function featureAccess(db,user,key){const a=roleAccess(db,user);return !!(a?.features?.[key]);}
const ROLE_PERMISSIONS={diretor_geral:'all',diretoria_academica:'all',coordenador_curso:['dashboard.html','index.html','alocacao.html','matrizes.html','turmas.html'],coordenador_area:['dashboard.html','index.html','alocacao.html','matrizes.html','turmas.html']};
const COORDINATOR_PAGES=new Set(ROLE_PERMISSIONS.coordenador_curso);
const sessions=new Map();
const suapStates=new Map();
function body(req){
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',chunk=>{
      raw+=chunk;
      if(raw.length>5_000_000){
        reject(new Error('Corpo da requisição muito grande.'));
        req.destroy();
      }
    });
    req.on('end',()=>{
      if(!raw.trim()) return resolve({});
      try{ resolve(JSON.parse(raw)); }
      catch(e){ reject(new Error('JSON inválido no corpo da requisição.')); }
    });
    req.on('error',reject);
  });
}
function send(res,status,payload){
  const body=JSON.stringify(payload===undefined?null:payload);
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma':'no-cache',
    'Expires':'0'
  });
  res.end(body);
}
function redirect(res,status,location){res.writeHead(status,{Location:location,'Cache-Control':'no-store'});res.end();}
function hashPassword(value){return crypto.createHash('sha256').update(String(value??''),'utf8').digest('hex')}
function firstLast(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  return {first:parts[0]||'',last:parts[parts.length-1]||''};
}
function roleForTeacher(t){
  const m=String(t?.management||'');
  if(m==='Direção-Geral') return 'diretor_geral';
  if(m==='Direção Acadêmica') return 'diretoria_academica';
  if(m==='Coordenação de Curso') return 'coordenador_curso';
  if(m.startsWith('Assessor Pedagógico de Área:')) return 'coordenador_area';
  if(m.startsWith('Assessor Pedagógico de Área:')) return 'coordenador_area';
  return null;
}
function ensureAuthUsers(db){
  db.authUsers=Array.isArray(db.authUsers)?db.authUsers:[];
  let changed=false;
  const managed=(db.teachers||[]).filter(t=>roleForTeacher(t));
  const managedIds=new Set(managed.map(t=>String(t.id)));
  managed.forEach(t=>{
    const role=roleForTeacher(t), {first,last}=firstLast(t.name);
    const username=first.toLowerCase();
    let u=db.authUsers.find(x=>String(x.teacherId)===String(t.id));
    if(!u){
      u={id:`usr-${t.id}`,teacherId:Number(t.id),username,displayName:t.name,role,passwordHash:hashPassword(last),photoData:'',suapUsername:'',suapMatricula:''};
      db.authUsers.push(u); changed=true;
    }else{
      const patch={teacherId:Number(t.id),username,displayName:t.name,role};
      Object.keys(patch).forEach(k=>{if(u[k]!==patch[k]){u[k]=patch[k];changed=true}});
      if(!u.passwordHash){u.passwordHash=hashPassword(last);changed=true}
    }
  });
  // Remove accounts whose underlying management role no longer exists.
  const filtered=db.authUsers.filter(u=>!u.teacherId || managedIds.has(String(u.teacherId)));
  if(filtered.length!==db.authUsers.length){db.authUsers=filtered;changed=true}
  if(changed)writeDB(db);
  return db.authUsers;
}
function userFromRequest(req,db){
  const raw=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('pocv_session='));
  const token=raw?decodeURIComponent(raw.slice('pocv_session='.length)):'';
  if(!token)return null;
  const sess=sessions.get(token); if(!sess)return null;
  if(sess.expires<Date.now()){sessions.delete(token);return null}
  const u=(db.authUsers||[]).find(x=>String(x.id)===String(sess.userId));
  return u||null;
}
function requireAuth(req,res,db){
  const user=userFromRequest(req,db);
  if(!user){send(res,401,{error:'Autenticação necessária'});return null}
  return user;
}
function coordinatorMatrixIds(db,user){
  const teacher=(db.teachers||[]).find(t=>String(t.id)===String(user.teacherId));
  const courseId=String(teacher?.coordinatorCourseId||'').trim();
  if(!courseId)return [];
  return (db.data?.courses||[]).filter(c=>String(c.course_id||'').trim()===courseId).map(c=>String(c.matrix));
}
function classTurn(db,matrixId,period,seq){
  const findTurn=(id)=>{
    const t=db.turn?.[String(id)]||{};
    const keys=Object.keys(t).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    if(!keys.length)return null;
    const eligible=keys.filter(k=>k<=Number(period));
    const key=eligible.length?eligible[eligible.length-1]:keys[0];
    const arr=t[String(key)];
    return Array.isArray(arr)&&arr.length?arr[(Math.max(1,Number(seq)||1)-1)%arr.length]:null;
  };
  const direct=findTurn(matrixId);
  if(direct)return direct;
  const c=(db.data?.courses||[]).find(x=>String(x.matrix)===String(matrixId));
  const cid=String(c?.course_id||'').trim();
  if(!cid)return 'A definir';
  const ids=(db.data?.matrices?Object.keys(db.data.matrices):[])
    .filter(id=>String((db.data.courses||[]).find(x=>String(x.matrix)===String(id))?.course_id||'').trim()===cid&&db.turn?.[String(id)])
    .sort((a,b)=>Number(b)-Number(a));
  for(const id of ids){const v=findTurn(id);if(v)return v;}
  return 'A definir';
}

function semesterIndex(s){
  const m=String(s||'').match(/^(\d{4})\.(1|2)$/);
  return m ? Number(m[1])*2 + Number(m[2])-1 : NaN;
}
function semesterFromIndex(i){
  const n=Number(i);
  if(!Number.isFinite(n)) return '';
  const year=Math.floor(n/2), part=n%2+1;
  return `${year}.${part}`;
}
function matrixDuration(matrix){
  const nums=(matrix?.disciplines||[]).flatMap(d=>Object.keys(d?.periods||{}).map(Number).filter(Number.isFinite));
  return Math.max(1,Number(matrix?.duration)||0,...nums,1);
}
function cohortTurn(courseId,startSemester,fallback){
  const id=String(courseId||'');
  const year=Number(String(startSemester||'').slice(0,4));
  if(!Number.isFinite(year)) return fallback||'A definir';
  // Regra de coorte: a alternância anual é entre novas entradas. Uma coorte
  // permanece no turno em que ingressou durante toda a duração do curso.
  if(id==='COMERCIO') return year%2===1?'Manhã':'Tarde';
  if(id==='INFORMATICA_INTERNET') return year%2===1?'Tarde':'Manhã';
  // Licenciatura em Informática: entrada anual alternada entre Noite e
  // Tarde. No cenário solicitado, 2027.1 é a entrada noturna.
  if(id==='LICENCIATURA_INFORMATICA') return year%2===1?'Noite':'Tarde';
  return fallback||'A definir';
}
function normalizePocvScenario(db,scenario,applyCoorteRule=false){
  if(!scenario || !Array.isArray(scenario.placements)) return scenario;
  scenario.placements.forEach(p=>{
    const m=db.data?.matrices?.[String(p.matrix)]||{};
    p.span=matrixDuration(m);
    if(!p.courseId){
      const c=(db.data?.courses||[]).find(x=>String(x.matrix)===String(p.matrix));
      if(c?.course_id)p.courseId=c.course_id;
    }
    if(!(Number(p.vacancies)>0)) p.vacancies=defaultVacanciesForMatrix(db,p.matrix);
    if(applyCoorteRule && ['COMERCIO','INFORMATICA_INTERNET','LICENCIATURA_INFORMATICA'].includes(String(p.courseId||'')) && p.startSemester){
      p.turn=cohortTurn(p.courseId,p.startSemester,p.turn);
      const base=semesterIndex(p.startSemester),schedule={};
      for(let k=0;k<p.span;k++)schedule[semesterFromIndex(base+k)]=p.turn;
      p.turnSchedule=schedule;
    }
  });
  return scenario;
}

function buildInitialPocvScenario(db){
  const min=semesterIndex('2027.1'), max=semesterIndex('2033.2');
  const semesters=Object.keys(db.data?.semesters||{})
    .sort((a,b)=>semesterIndex(a)-semesterIndex(b));
  const cohorts=new Map();

  // A tabela de turmas é a fonte de verdade do cenário real. Cada registro
  // representa uma turma em um período da matriz. A coorte é reconstruída
  // pelo semestre de início = semestre atual - (período - 1).
  semesters.forEach(sem=>{
    const si=semesterIndex(sem);
    (db.data.semesters[sem]||[]).forEach(cl=>{
      const matrix=Number(cl.matrix), period=Number(cl.period)||1, seq=Number(cl.seq)||1;
      if(!Number.isFinite(matrix)) return;
      const start=si-(period-1);
      const key=`${matrix}|${seq}|${start}`;
      if(!cohorts.has(key)) cohorts.set(key,{matrix,seq,start,observations:[]});
      cohorts.get(key).observations.push({sem,si,period,turn:classTurn(db,matrix,period,seq)});
    });
  });

  const placements=[]; let pid=1;
  [...cohorts.values()].sort((a,b)=>a.start-b.start||a.matrix-b.matrix||a.seq-b.seq).forEach(c=>{
    const m=db.data?.matrices?.[String(c.matrix)]||{};
    const duration=matrixDuration(m);
    // No cenário real, não projetamos além do que a tabela de turmas realmente
    // contém. Isso é importante para matrizes antigas que foram encerradas ou
    // substituídas antes de completar a duração nominal. Para uma coorte cujo
    // início é anterior ao primeiro semestre disponível no banco, usamos o
    // primeiro período observado e seguimos até o primeiro buraco da sequência.
    const obs=c.observations.slice().sort((a,b)=>a.si-b.si);
    let actualEnd=null;
    if(obs.length){
      let prevSi=null, prevPeriod=null;
      for(const o of obs){
        if(prevSi!==null && (o.si!==prevSi+1 || o.period!==prevPeriod+1)) break;
        actualEnd=o.si; prevSi=o.si; prevPeriod=o.period;
      }
    }
    const end=Math.min(c.start+duration-1, actualEnd==null?c.start+duration-1:actualEnd, max);
    if(end<min || c.start>max || actualEnd==null) return;

    // O turno é parte da configuração da coorte. Para matrizes em que o
    // turno muda conforme o período (ex.: Comércio, Informática para Internet,
    // Licenciatura e Marketing), preservamos a agenda por semestre em vez de
    // transformar cada período em uma nova "oferta".
    const turnSchedule={};
    c.observations.forEach(o=>{
      if(o.si>=min && o.si<=max && o.turn) turnSchedule[o.sem]=o.turn;
    });

    // Detecta a periodicidade das entradas (anual, semestral ou única) usando
    // os semestres de início observados para a mesma matriz/coorte-seq.
    const starts=[...new Set([...cohorts.values()]
      .filter(x=>x.matrix===c.matrix && x.seq===c.seq)
      .map(x=>x.start).sort((a,b)=>a-b))];
    let periodicity='unica';
    if(starts.length>1){
      const diffs=starts.slice(1).map((v,i)=>v-starts[i]);
      if(diffs.every(x=>x===2)) periodicity='anual';
      else if(diffs.every(x=>x===1)) periodicity='semestral';
      else periodicity='anual';
    }

    // Para a visualização, mantemos uma entrada por coorte. A interface pode
    // desenhar segmentos por turno a partir de turnSchedule sem perder a
    // identidade da oferta/coorte.
    const firstObserved=c.observations.slice().sort((a,b)=>a.si-b.si)[0];
    const course=(db.data?.courses||[]).find(x=>String(x.matrix)===String(c.matrix));
    const fallbackTurn=cohortTurn(course?.course_id,semesterFromIndex(c.start),firstObserved?.turn||'A definir');
    placements.push({
      id:`p${pid++}`,
      matrix:c.matrix,
      seq:c.seq,
      courseId:course?.course_id||'',
      startSemester:semesterFromIndex(c.start),
      turn:fallbackTurn,
      turnSchedule,
      quantity:1,
      vacancies:defaultVacanciesForMatrix(db,c.matrix),
      startPeriod:1,
      span:duration,
      source:'real',
      locked:false,
      periodicity,
      alternatesTurns:Object.values(turnSchedule).filter(Boolean).length>1 && new Set(Object.values(turnSchedule).filter(Boolean)).size>1,
      alternatingTurns:[...new Set(Object.values(turnSchedule).filter(Boolean))]
    });
  });

  return {
    id:'real',name:'Cenário Real',isReal:true,
    startSemester:'2027.1',endSemester:'2033.2',placements,
    realModelVersion:8,
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  };
}
function ensurePocvScenarios(db){
  if(!Array.isArray(db.pocvScenarios) || !db.pocvScenarios.length){
    db.pocvScenarios=[buildInitialPocvScenario(db)];
    writeDB(db);
  }else{
    let changed=false;
    const beforeNormalize=JSON.stringify(db.pocvScenarios);
    if(!db.pocvScenarios.some(x=>x&&x.isReal)){
      db.pocvScenarios[0].isReal=true;
      changed=true;
    }
    // Migração única da representação antiga do cenário real para a versão
    // que acompanha fielmente as entradas de data.semesters, inclusive quando
    // o turno muda entre períodos.
    const real=db.pocvScenarios.find(x=>x&&x.isReal);
    if(real && (Number(real.realModelVersion||0)<8 || (real.placements||[]).some(p=>Number(p.span||0)!==matrixDuration(db.data?.matrices?.[String(p.matrix)]||{})))){
      const rebuilt=buildInitialPocvScenario(db);
      rebuilt.createdAt=real.createdAt||rebuilt.createdAt;
      rebuilt.name=real.name||rebuilt.name;
      db.pocvScenarios=db.pocvScenarios.map(x=>x.id===real.id?{...rebuilt,id:real.id,isReal:true}:x);
      changed=true;
    }
    db.pocvScenarios.forEach(s=>normalizePocvScenario(db,s,!!s.isReal));
    const normalizedChanged=beforeNormalize!==JSON.stringify(db.pocvScenarios);
    if(changed||normalizedChanged) writeDB(db);
  }
  return db.pocvScenarios;
}

function normalizeOfferTurns(db){
  let changed=false;
  db.offers??={};
  Object.entries(db.offers).forEach(([semester,rows])=>{
    Object.entries(rows||{}).forEach(([key,offer])=>{
      const parts=String(key).split('|');
      const matrix=Number(parts[0]), period=Number(parts[1]), seq=Number(parts[2]);
      if(!Number.isFinite(matrix)||!Number.isFinite(period)||!Number.isFinite(seq)||!offer)return;
      const expected=classTurn(db,matrix,period,seq);
      // O turno da oferta regular nunca é uma escolha independente da disciplina:
      // ele pertence à turma (matriz + período + sequência). Corrige inclusive
      // registros antigos que tenham ficado salvos como "A definir" ou com outro turno.
      if(expected && expected!=='A definir' && offer.turn!==expected){
        offer.turn=expected;
        changed=true;
      }
    });
  });
  return changed;
}
function filterDbForArea(db,user){
  const teacher=(db.teachers||[]).find(t=>String(t.id)===String(user.teacherId));
  const area=String(teacher?.managementArea||'').trim();
  const groups=new Set((teacher?.distributionGroups||db.pedagogicalAreaResponsibilities?.[area]?.groups||[]).map(x=>String(x).trim()).filter(Boolean));
  const out=JSON.parse(JSON.stringify(db)); out.data=out.data||{}; out.data.matrices={};
  const allowedMatrices=new Set(), disciplineMap=new Map();
  Object.entries(db.data?.matrices||{}).forEach(([id,m])=>{const kept=[];const map=new Map();(m?.disciplines||[]).forEach((d,oldIndex)=>{if(groups.has(String(d?.group||'').trim())){map.set(String(oldIndex),kept.length);kept.push(d)}});if(!kept.length)return;out.data.matrices[id]={...m,disciplines:kept};allowedMatrices.add(String(id));disciplineMap.set(String(id),map);});
  out.data.courses=(db.data?.courses||[]).filter(c=>allowedMatrices.has(String(c.matrix)));
  out.data.semesters={};Object.entries(db.data?.semesters||{}).forEach(([sem,rows])=>{const rr=(rows||[]).filter(r=>allowedMatrices.has(String(r.matrix)));if(rr.length)out.data.semesters[sem]=rr;});
  out.turn={};allowedMatrices.forEach(id=>{if(db.turn?.[id])out.turn[id]=db.turn[id]});
  out.teachers=(db.teachers||[]).filter(t=>groups.has(String(t.group||'').trim())||String(t.id)===String(user.teacherId));
  out.offers={};Object.entries(db.offers||{}).forEach(([sem,rows])=>{const rr={};Object.entries(rows||{}).forEach(([key,val])=>{const parts=String(key).split('|'),matrix=parts[0],oldDi=String(parts[3]||'').split('::')[0],newDi=disciplineMap.get(matrix)?.get(oldDi);if(allowedMatrices.has(matrix)&&newDi!==undefined)rr[[parts[0],parts[1],parts[2],newDi].join('|')+(String(parts[3]||'').includes('::')?`::${String(parts[3]).split('::').slice(1).join('::')}`:'')]=val});if(Object.keys(rr).length)out.offers[sem]=rr});
  out.extraOffers={};Object.entries(db.extraOffers||{}).forEach(([sem,rows])=>{const rr=(rows||[]).filter(v=>groups.has(String(v?.group||'').trim()));if(rr.length)out.extraOffers[sem]=rr});
  out.pocvScenarios=[];out.authUsers=[user];out.authUser={id:user.id,teacherId:user.teacherId,displayName:user.displayName,role:user.role,managementArea:area,distributionGroups:[...groups]};return out;
}

function filterDbForUser(db,user){
  if(user.role==='coordenador_area')return filterDbForArea(db,user);
  if(user.role!=='coordenador_curso')return db;
  const ids=new Set(coordinatorMatrixIds(db,user));
  const out=JSON.parse(JSON.stringify(db));
  out.data.courses=(db.data?.courses||[]).filter(c=>ids.has(String(c.matrix)));
  out.data.matrices={}; ids.forEach(id=>{if(db.data?.matrices?.[id])out.data.matrices[id]=db.data.matrices[id]});
  out.data.semesters={};
  Object.entries(db.data?.semesters||{}).forEach(([sem,rows])=>{
    out.data.semesters[sem]=(rows||[]).filter(r=>ids.has(String(r.matrix)));
  });
  out.turn={}; ids.forEach(id=>{if(db.turn?.[id])out.turn[id]=db.turn[id]});
  const groups=new Set(); Object.values(out.data.matrices).forEach(m=>(m.disciplines||[]).forEach(d=>{if(d.group)groups.add(String(d.group).trim())}));
  out.teachers=(db.teachers||[]).filter(t=>groups.has(String(t.group||'').trim()) || String(t.id)===String(user.teacherId));
  out.offers={}; Object.entries(db.offers||{}).forEach(([sem,rows])=>{out.offers[sem]={};Object.entries(rows||{}).forEach(([key,val])=>{if(ids.has(String(key).split('|')[0]))out.offers[sem][key]=val})});
  out.extraOffers={}; Object.entries(db.extraOffers||{}).forEach(([sem,rows])=>{out.extraOffers[sem]=(rows||[]).filter(v=>{
    const course=String(v.course||'').trim(); return !course || ids.has(String((db.data?.courses||[]).find(c=>String(c.course_id||'')===course)?.matrix));
  })});
  out.pocvScenarios=[];
  out.authUsers=[user];
  out.authUser={id:user.id,teacherId:user.teacherId,displayName:user.displayName,role:user.role,coordinatorCourseId:(db.teachers||[]).find(t=>String(t.id)===String(user.teacherId))?.coordinatorCourseId||''};
  return out;
}

function filterDbByAccessWindow(db,user){
  if(!user || !['coordenador_curso','coordenador_area'].includes(user.role)) return db;
  const out=db;
  for(const key of Object.keys(out.data?.semesters||{})) if(!semesterInAccessRange(db,user,key)) delete out.data.semesters[key];
  for(const key of Object.keys(out.offers||{})) if(!semesterInAccessRange(db,user,key)) delete out.offers[key];
  for(const key of Object.keys(out.extraOffers||{})) if(!semesterInAccessRange(db,user,key)) delete out.extraOffers[key];
  return out;
}
function filterDbForUserWithAccess(db,user){const out=filterDbByAccessWindow(filterDbForUser(db,user),user);return annotateValidation(db,user,out);}

function ensureWorkflow(db){db.approvals=Array.isArray(db.approvals)?db.approvals:[];db.notifications=Array.isArray(db.notifications)?db.notifications:[];}
function userDisplay(db,id){return (db.authUsers||[]).find(x=>String(x.id)===String(id))?.displayName||'Usuário';}
function coordinatorOwnsOffer(db,user,semester,key){return semesterInAccessRange(db,user,semester)&&coordinatorMatrixIds(db,user).includes(String(key).split('|')[0]);}
function synthesizeOfferFromKey(db,semester,key){
  const parts=String(key||'').split('|');
  if(parts.length<4)return null;
  const matrix=String(parts[0]),period=String(parts[1]),seq=String(parts[2]),di=Number(String(parts[3]).split('::')[0]);
  if(!Number.isFinite(di))return null;
  const cl=(db.data?.semesters?.[semester]||[]).find(c=>String(c.matrix)===matrix&&String(c.period)===period&&String(c.seq)===seq);
  const m=db.data?.matrices?.[matrix]; const d=m?.disciplines?.[di];
  if(!cl||!m||!d)return null;
  const course=(db.data?.courses||[]).find(c=>String(c.matrix)===matrix)?.name||m.name||'';
  const baseCh=d.periods?.[String(period)];
  if(baseCh==null)return null;
  return {name:d.name||'',ch:Number(baseCh)||0,group:d.group||'',turn:classTurn(db,Number(matrix),Number(period),Number(seq))||'A definir',course};
}
function resolvePreviewOffer(db,semester,x){
  const rows=db.offers?.[semester]||{};
  const candidates=[];
  const add=(k)=>{if(k&&rows[k]&& !candidates.includes(k))candidates.push(k)};
  add(x?.key); add(x?.previewKey); add(x?.originalKey);
  const src=x?.source||{};
  const matrix=String(src.matrix||'').trim(), period=String(src.period||'').trim(), seq=String(src.seq||'').trim(), di=String(src.disciplineIndex||'').split('::')[0].trim();
  if(matrix&&period&&seq&&di){add(`${matrix}|${period}|${seq}|${di}`);}
  const prefix=matrix&&period&&seq?`${matrix}|${period}|${seq}|`:'';
  if(prefix){
    const name=String(src.name||'').trim().toLowerCase();
    for(const [k,v] of Object.entries(rows)){
      if(!String(k).startsWith(prefix))continue;
      const kdi=String(k).split('|')[3].split('::')[0];
      if(di&&kdi===di){add(k);continue;}
      if(name){
        const d=db.data?.matrices?.[matrix]?.disciplines?.[Number(kdi)];
        if(String(d?.name||'').trim().toLowerCase()===name)add(k);
      }
    }
  }
  // Último recurso: quando a visualização remapeou os índices das disciplinas,
  // procure pela turma e pelo nome da disciplina na matriz original.
  const srcName=String(src.name||'').trim().toLowerCase();
  if(matrix&&period&&seq&&srcName){
    for(const [k,v] of Object.entries(rows)){
      const kp=String(k).split('|');
      if(String(kp[0])!==matrix||String(kp[1])!==period||String(kp[2])!==seq)continue;
      const kdi=Number(String(kp[3]||'').split('::')[0]);
      const d=db.data?.matrices?.[matrix]?.disciplines?.[kdi];
      if(String(d?.name||'').trim().toLowerCase()===srcName)add(k);
    }
  }
  for(const k of candidates){if(rows[k])return {key:k,current:rows[k]};}
  // Muitas ofertas são geradas a partir da matriz e só passam a existir em
  // db.offers quando alguém as confirma/edita. No modo de teste isso também
  // precisa ser uma oferta válida, não um 404.
  const direct=String(x?.originalKey||x?.key||x?.previewKey||'');
  const synthesized=synthesizeOfferFromKey(db,semester,direct);
  if(synthesized)return {key:direct,current:synthesized};
  const srcKey=matrix&&period&&seq&&di?`${matrix}|${period}|${seq}|${di}`:'';
  if(srcKey){const generated=synthesizeOfferFromKey(db,semester,srcKey);if(generated)return {key:srcKey,current:generated};}
  return null;
}
function approvalTargetLabel(db,a){if(String(a.type||'').startsWith('offer_')){const raw=String(a.targetKey||'').split('|'),p3=String(raw[3]||'').split('::')[0],m=db.data?.matrices?.[raw[0]]||{},d=m.disciplines?.[Number(p3)],course=(db.data?.courses||[]).find(c=>String(c.matrix)===String(raw[0]))?.name||a.snapshot?.course||a.course||'Oferta';return `${course} · ${d?.name||a.snapshot?.name||a.targetKey||'Oferta'} · ${a.semester}`;}return `${a.proposed?.name||a.snapshot?.name||'Demanda avulsa'} · ${a.semester}`;}
function createApproval(db,user,fields){const a={id:`ap${Date.now()}-${Math.random().toString(36).slice(2,7)}`,status:'pending',requesterId:user.id,requesterName:user.displayName,requesterRole:user.role,createdAt:new Date().toISOString(),...fields};db.approvals.push(a);return a;}
function pushNotification(db,userId,title,message,approvalId){db.notifications.push({id:`nt${Date.now()}-${Math.random().toString(36).slice(2,7)}`,userId,title,message,approvalId:String(approvalId||''),read:false,createdAt:new Date().toISOString()});}
function notifyDirectors(db,title,message,approvalId){ensureWorkflow(db);(db.authUsers||[]).filter(u=>u.role==='diretor_geral'||u.role==='diretoria_academica').forEach(u=>pushNotification(db,u.id,title,message,approvalId));}
function applyApproval(db,a){
  if(a.type==='offer_confirm'||a.type==='offer_change'){
    db.offers??={};db.offers[a.semester]??={};const cur=db.offers[a.semester][a.targetKey]||{};
    if(a.type==='offer_change'&&a.action==='delete'){delete db.offers[a.semester][a.targetKey];db.offerDeletions??={};db.offerDeletions[a.semester]??={};db.offerDeletions[a.semester][a.targetKey]={approvalId:a.id,deletedAt:new Date().toISOString(),deletedBy:a.decidedById,snapshot:a.snapshot||null};}
    else{
      // A aprovação da Direção deve materializar a oferta mesmo quando ela
      // ainda não existia em db.offers (ofertas geradas pela matriz).
      const existing=db.offers[a.semester]?.[a.targetKey];
      const seed=existing||a.snapshot||synthesizeOfferFromKey(db,a.semester,a.targetKey)||{};
      if(!existing && Object.keys(seed).length) db.offers[a.semester][a.targetKey]=JSON.parse(JSON.stringify(seed));
      const requestedTurn=String(a.changes?.turn||'').trim();
      const scope=String(a.changes?.turnScope||'offer');
      const applyOne=(key)=>{
        const base=db.offers[a.semester]?.[key]||a.snapshot||synthesizeOfferFromKey(db,a.semester,key)||{};
        const next={...base,...(a.changes||{})};
        delete next.turnScope;
        const p=String(key).split('|'),expected=classTurn(db,Number(p[0]),Number(p[1]),Number(p[2]));
        if(scope!=='class' && expected&&expected!=='A definir' && !requestedTurn) next.turn=expected;
        if(requestedTurn) next.turn=requestedTurn;
        const canonicalCourse=(db.data?.courses||[]).find(c=>String(c.matrix)===String(p[0]))?.name;
        if(canonicalCourse) next.course=canonicalCourse;
        const optChoices=Array.isArray(next.optionalChoices)?next.optionalChoices.filter(Boolean):(next.optionalChoice?[next.optionalChoice]:[]);
        if(optChoices.length){ next.name=optChoices.join(' + '); next.optionalChoices=optChoices; next.optionalChoice=optChoices.length===1?optChoices[0]:''; }
        next.validationStatus='approved';next.validationSource='director_approval';next.validationApprovalId=a.id;next.validationUpdatedAt=new Date().toISOString();next.validationBy=a.decidedById;
        db.offers[a.semester][key]=next;
      };
      const target=String(a.targetKey), parts=target.split('|');
      if(scope==='class' && requestedTurn){
        const prefix=`${parts[0]}|${parts[1]}|${parts[2]}|`;
        Object.keys(db.offers[a.semester]||{}).filter(k=>String(k).startsWith(prefix)).forEach(applyOne);
      }else applyOne(target);
    }
  }else if(a.type==='offer_duplicate'){
    db.offers??={};db.offers[a.semester]??={};
    const d=a.duplicate||{}, source=String(a.targetKey||'').split('|'), matrix=String(d.matrix||source[0]), period=String(d.period||source[1]), seq=String(d.seq||source[2]), di=String(d.disciplineIndex||source[3]);
    const qty=Math.max(2,Math.min(5,Number(d.quantity)||2));
    const sourceKey=String(a.targetKey||'');
    const sourceBase=db.offers[a.semester]?.[sourceKey]||a.snapshot||synthesizeOfferFromKey(db,a.semester,sourceKey)||{};
    const sourceParts=sourceKey.split('|');
    const canonicalCourse=(db.data?.courses||[]).find(c=>String(c.matrix)===String(sourceParts[0]))?.name;
    const confirmedSource={...sourceBase};
    if(canonicalCourse) confirmedSource.course=canonicalCourse;
    confirmedSource.validationStatus='approved';confirmedSource.validationSource='director_approval';confirmedSource.validationApprovalId=a.id;confirmedSource.validationUpdatedAt=new Date().toISOString();confirmedSource.validationBy=a.decidedById;
    db.offers[a.semester][sourceKey]=confirmedSource;
    // quantity representa o total final de ofertas, incluindo a original.
    for(let n=0;n<qty-1;n++){
      const id=`${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      const key=`${matrix}|${period}|${seq}|${di}::dup::${id}`;
      const base=db.offers[a.semester]?.[a.targetKey]||a.snapshot||{};
      const next={...base,...(a.changes||{}),duplicateOf:a.targetKey,duplicateRequestId:a.id,validationStatus:'approved',validationUpdatedAt:new Date().toISOString(),validationBy:a.decidedById};
      const expected=classTurn(db,Number(matrix),Number(period),Number(seq));if(expected&&expected!=='A definir')next.turn=expected;
      const dupCourse=(db.data?.courses||[]).find(c=>String(c.matrix)===matrix)?.name;if(dupCourse)next.course=dupCourse;
      delete next.notes; db.offers[a.semester][key]=next;
    }
  }else if(a.type==='extra_create'){
    db.extraOffers??={};db.extraOffers[a.semester]??=[];const x={...a.proposed,id:Math.max(0,...db.extraOffers[a.semester].map(v=>Number(v.id)||0))+1,createdAt:new Date().toISOString(),validationStatus:'approved',validationUpdatedAt:new Date().toISOString(),validationBy:a.decidedById};db.extraOffers[a.semester].push(x);
  }else if(a.type==='extra_change'){
    const arr=db.extraOffers?.[a.semester]||[],i=arr.findIndex(v=>String(v.id)===String(a.targetId));if(i>=0)arr[i]={...arr[i],...(a.changes||{}),validationStatus:'approved',validationUpdatedAt:new Date().toISOString(),validationBy:a.decidedById};
  }else if(a.type==='extra_delete'){if(db.extraOffers?.[a.semester])db.extraOffers[a.semester]=db.extraOffers[a.semester].filter(v=>String(v.id)!==String(a.targetId));}
}
function annotateValidation(db,user,out){
  const isDir=user&&['diretor_geral','diretoria_academica'].includes(user.role);
  const visible=isDir?db.approvals:db.approvals.filter(a=>String(a.requesterId)===String(user.id));
  out.offers??={};
  const latest=new Map();
  visible.filter(a=>a.targetKey&&a.semester&&String(a.type).startsWith('offer_')).forEach(a=>{
    const key=`${a.semester}\u001f${String(a.targetKey).split('::')[0]}`;
    const prev=latest.get(key);
    const ta=String(a.updatedAt||a.decidedAt||a.createdAt||'');
    const tp=String(prev?.updatedAt||prev?.decidedAt||prev?.createdAt||'');
    if(!prev||ta>=tp) latest.set(key,a);
  });
  latest.forEach((a,composite)=>{
    const [semester,base]=composite.split('\u001f');
    out.offers[semester]??={};
    const targets=Object.keys(out.offers[semester]).filter(k=>String(k).split('::')[0]===base);
    targets.forEach(k=>{
      const v=out.offers[semester][k];
      if(!v)return;
      v.validationStatus=a.status;
      v.validationApprovalId=a.id;
      v.validationNote=a.decisionNote||'';
      v.validationApprovalType=a.type;
      v.validationAction=a.action||'';
    });
  });
  out.offerDeletions=db.offerDeletions||{};out.approvals=visible;return out;
}
let mysqlSyncRunning=false;
let mysqlSyncPending=null;
let mysqlSyncLastStatus={state:'idle',updatedAt:null,error:null,attempt:null};
const mysqlSyncWaiters=[];
function notifyMySQLSyncWaiters(){
  if(mysqlSyncRunning||mysqlSyncPending) return;
  while(mysqlSyncWaiters.length) mysqlSyncWaiters.shift()();
}
function waitForMySQLSync(){
  if(!mysqlSyncRunning&&!mysqlSyncPending) return Promise.resolve();
  return new Promise(resolve=>mysqlSyncWaiters.push(resolve));
}

function cloneDb(db){ return JSON.parse(JSON.stringify(db)); }

function backupJSONSnapshot(db, label='auto'){
  const dataDir=path.dirname(DB_FILE);
  if(!fs.existsSync(dataDir))fs.mkdirSync(dataDir,{recursive:true});
  const backupDir=path.join(dataDir,'backups');
  if(!fs.existsSync(backupDir))fs.mkdirSync(backupDir,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const target=path.join(backupDir,`db-${label}-${stamp}.json`);
  fs.writeFileSync(target,JSON.stringify(db,null,2),'utf8');
  const tmp=DB_FILE+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(db,null,2),'utf8');
  fs.renameSync(tmp,DB_FILE);
  return target;
}

function queueMySQLSync(db){
  try{ mysqlSyncPending=cloneDb(db); }catch(e){
    mysqlSyncLastStatus={state:'error',updatedAt:new Date().toISOString(),error:e.message,attempt:null};
    return;
  }
  if(mysqlSyncRunning) return;
  mysqlSyncRunning=true;
  mysqlSyncLastStatus={state:'pending',updatedAt:new Date().toISOString(),error:null,attempt:null};
  (async()=>{
    while(mysqlSyncPending){
      const snapshot=mysqlSyncPending;
      mysqlSyncPending=null;
      let ok=false,lastErr=null;
      for(let attempt=1;attempt<=3&&!ok;attempt++){
        try{
          mysqlSyncLastStatus={state:'syncing',updatedAt:new Date().toISOString(),error:null,attempt};
          await syncMySQLDatabase(snapshot);
          ok=true;
          backupJSONSnapshot(snapshot,'auto');
          mysqlSyncLastStatus={state:'ok',updatedAt:new Date().toISOString(),error:null,attempt};
        }catch(e){
          lastErr=e;
          if(attempt<3) await new Promise(r=>setTimeout(r,500*attempt));
        }
      }
      if(!ok){
        mysqlSyncLastStatus={state:'error',updatedAt:new Date().toISOString(),error:lastErr?.message||String(lastErr),attempt:3};
        console.error('Persistência MySQL falhou; estado MySQL preservado e backup JSON não atualizado:',lastErr?.message||lastErr);
        try{ dbCache=await readMySQLDatabase(); (dbCache.teachers||[]).forEach(applyTeacherFactor); }
        catch(refreshErr){ console.error('Falha ao recarregar estado MySQL após erro:',refreshErr.message); }
      }
    }
  })().finally(()=>{mysqlSyncRunning=false;notifyMySQLSyncWaiters();});
}

function writeDB(db){
  dbCache=db;
  queueMySQLSync(db);
}

async function persistDBAndSync(db){
  dbCache=db;
  await waitForMySQLSync();
  mysqlSyncRunning=true;
  try{
    mysqlSyncLastStatus={state:'syncing',updatedAt:new Date().toISOString(),error:null,attempt:1};
    const snapshot=cloneDb(db);
    await syncMySQLDatabase(snapshot);
    const backup=backupJSONSnapshot(snapshot,'critical');
    dbCache=db;
    mysqlSyncLastStatus={state:'ok',updatedAt:new Date().toISOString(),error:null,attempt:1,backup};
    return true;
  }catch(e){
    mysqlSyncLastStatus={state:'error',updatedAt:new Date().toISOString(),error:e?.message||String(e),attempt:1};
    try{ dbCache=await readMySQLDatabase(); }catch(refreshErr){ console.error('Falha ao recarregar MySQL após erro crítico:',refreshErr.message); }
    throw e;
  }finally{
    mysqlSyncRunning=false;
    if(mysqlSyncPending){
      const pending=mysqlSyncPending;
      mysqlSyncPending=null;
      queueMySQLSync(pending);
    }else{
      notifyMySQLSyncWaiters();
    }
  }
}

async function initializeDatabase(){
  try{
    const loaded=await readMySQLDatabase();
    dbCache=loaded;
    (dbCache.teachers||[]).forEach(applyTeacherFactor);
    dbReady=true;
    // Gera uma cópia local de recuperação sem torná-la fonte operacional.
    backupJSONSnapshot(dbCache,'startup');
    mysqlSyncLastStatus={state:'ok',updatedAt:new Date().toISOString(),error:null,attempt:null};
    console.log(`MySQL conectado — banco: ${process.env.MYSQL_DATABASE||'acha'}`);
    return true;
  }catch(e){
    dbReady=false;
    console.error('ERRO FATAL: não foi possível inicializar o ACHA a partir do MySQL.');
    console.error(e.stack||e);
    return false;
  }
}

async function readDBForApi(){
  await waitForMySQLSync();
  if(!dbReady || !dbCache) throw new Error('Banco MySQL não inicializado.');
  return dbCache;
}

async function api(req,res){
  const parsed=url.parse(req.url,true),p=parsed.pathname;
  if(req.method==='GET'&&p==='/api/health')return send(res,200,{ok:true,service:'acha',timestamp:new Date().toISOString()});
  if(req.method==='GET'&&p==='/api/mysql/status')return send(res,200,{ok:true,mysqlSync:mysqlSyncLastStatus});

  // Backup administrativo: devolve o db.json completo e atual, exatamente como
  // está armazenado no servidor, para permitir continuar o desenvolvimento
  // localmente com os dados produzidos na aplicação online.
  if(req.method==='GET'&&p==='/api/backup'){
    const db=readDB();
    ensureAuthUsers(db);
    if(normalizeOfferTurns(db))writeDB(db);
    const user=requireAuth(req,res,db);
    if(!user)return;
    if(user.role!=='diretor_geral'&&user.role!=='diretoria_academica')return send(res,403,{error:'Acesso restrito à Direção.'});
    const payload=JSON.stringify(db,null,2);
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    res.writeHead(200,{
      'Content-Type':'application/json; charset=utf-8',
      'Content-Disposition':`attachment; filename="acha-db-backup-${stamp}.json"`,
      'Cache-Control':'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma':'no-cache',
      'Expires':'0',
      'X-ACHA-Version':'1.0.110'
    });
    return res.end(payload);
  }

  if(p==='/api/profile' && req.method==='GET'){
    const db=readDB();ensureAuthUsers(db);const user=requireAuth(req,res,db);if(!user)return;
    return send(res,200,{ok:true,user:authUserPayload(db,user),access:roleAccess(db,user)});
  }
  if(p==='/api/profile' && req.method==='PUT'){
    try{
      const db=readDB();ensureAuthUsers(db);const user=requireAuth(req,res,db);if(!user)return;
      const x=await body(req);const changes={};
      if(x.photoData!==undefined){const photo=String(x.photoData||'');if(photo.length>2_000_000)return send(res,400,{error:'A foto é muito grande. Escolha uma imagem menor.'});if(photo && !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(photo))return send(res,400,{error:'Formato de foto não suportado.'});changes.photoData=photo;}
      if(x.currentPassword!==undefined || x.newPassword!==undefined){
        const current=String(x.currentPassword||''),next=String(x.newPassword||'');
        if(user.passwordHash!==hashPassword(current))return send(res,400,{error:'Senha atual inválida.'});
        if(next.length<6)return send(res,400,{error:'A nova senha deve ter pelo menos 6 caracteres.'});
        changes.passwordHash=hashPassword(next);
      }
      Object.assign(user,changes);writeDB(db);return send(res,200,{ok:true,user:authUserPayload(db,user),access:roleAccess(db,user)});
    }catch(e){return send(res,400,{error:e.message||'Não foi possível salvar o perfil.'});}
  }
  if(p==='/api/suap/status' && req.method==='GET'){
    return send(res,200,{
      configured:suapConfigured(),
      clientId:SUAP_OAUTH.clientId,
      redirectUri:SUAP_OAUTH.redirectUri,
      baseUrl:SUAP_OAUTH.baseUrl,
      scope:SUAP_OAUTH.scope,
      flow:'implicit-public'
    });
  }

  // Compatibilidade com o botão antigo: o redirecionamento agora segue
  // o mesmo fluxo do cliente JavaScript oficial do IFRN.
  if(p==='/api/suap/login' && req.method==='GET'){
    if(!suapConfigured())return send(res,503,{error:'Integração SUAP não configurada. Verifique o Client ID e a Redirect URI.'});
    const q=new URLSearchParams({
      response_type:'token',
      grant_type:'implict',
      client_id:SUAP_OAUTH.clientId,
      redirect_uri:SUAP_OAUTH.redirectUri,
      scope:SUAP_OAUTH.scope
    });
    return redirect(res,302,`${SUAP_OAUTH.baseUrl}/o/authorize/?${q.toString()}`);
  }

  // Depois do login, login.html recebe #access_token=... no navegador
  // e envia somente o token ao servidor. O servidor valida o token no SUAP,
  // identifica o usuário e cria a sessão HTTP do ACHA.
  if(p==='/api/suap/client-login' && req.method==='POST'){
    try{
      if(!suapConfigured())return send(res,503,{error:'Integração SUAP não configurada.'});
      const x=await body(req);
      const accessToken=String(x.accessToken||'').trim();
      if(!accessToken)return send(res,400,{error:'Access token do SUAP não informado.'});
      if(accessToken.length>4096)return send(res,400,{error:'Access token inválido.'});

      const me=await suapUserRequest(accessToken);
      const db=readDB();ensureAuthUsers(db);

      const matricula=String(
        me.matricula ??
        me.username ??
        me.identificacao ??
        me.vinculo?.matricula ??
        me.vinculo?.identificacao ??
        ''
      ).trim();

      const nome=String(
        me.nome_usual ??
        me.nome ??
        me.full_name ??
        me.vinculo?.nome ??
        ''
      ).trim();

      const username=String(me.username||me.login||matricula||'').trim();

      // Primeiro tenta matrícula/username; se a API do SUAP não trouxer
      // matrícula explicitamente, usa o nome exato normalizado como fallback.
      // Vinculação principal: matrícula retornada pelo SUAP.
      // A matrícula pode estar cadastrada no docente (teacher.matricula)
      // antes do primeiro login; por isso não dependemos de u.suapMatricula.
      let user=(db.authUsers||[]).find(u=>{
        if(!matricula) return false;
        const teacher=(db.teachers||[]).find(t=>String(t.id)===String(u.teacherId));
        const candidates=[
          u.suapMatricula,
          teacher?.matricula,
          u.suapUsername,
          u.username
        ].map(v=>String(v||'').trim().toLowerCase());
        return candidates.includes(matricula.toLowerCase());
      });

      // Segundo critério: username/login do SUAP, quando já estiver vinculado.
      if(!user && username){
        user=(db.authUsers||[]).find(u=>{
          const candidates=[u.suapUsername,u.username].map(v=>String(v||'').trim().toLowerCase());
          return candidates.includes(username.toLowerCase());
        });
      }

      // Terceiro critério: nome exato.
      if(!user && nome){
        user=(db.authUsers||[]).find(u=>normalizePersonName(u.displayName)===normalizePersonName(nome));
      }

      if(!user){
        return send(res,403,{
          error:'O SUAP autenticou, mas este usuário não está cadastrado no ACHA como Diretor Geral, Diretoria Acadêmica ou Coordenador de Curso.',
          suap:{nome:nome||null,matricula:matricula||null,username:username||null}
        });
      }

      user.suapUsername=username||user.suapUsername||'';
      user.suapMatricula=matricula||user.suapMatricula||'';
      user.suapName=nome||user.suapName||'';
      const suapPhotoUrl=String(me.url_foto_150x200||me.url_foto_75x100||me.foto||me.photo||'').trim();
      if(suapPhotoUrl) user.suapPhotoUrl=suapPhotoUrl;
      const linkedTeacher=db.teachers.find(t=>String(t.id)===String(user.teacherId));
      if(linkedTeacher && matricula) linkedTeacher.matricula=matricula;
      writeDB(db);

      const sessionToken=crypto.randomBytes(32).toString('hex');
      sessions.set(sessionToken,{userId:user.id,expires:Date.now()+8*60*60*1000});
      res.setHeader('Set-Cookie',`pocv_session=${encodeURIComponent(sessionToken)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`);
      return send(res,200,{ok:true,user:authUserPayload(db,user),access:roleAccess(db,user)});
    }catch(e){
      return send(res,502,{error:`Falha ao validar o login SUAP: ${e.message}`});
    }
  }

  // O callback antigo de Authorization Code não é mais usado no fluxo
  // JavaScript. Mantemos uma resposta explícita para evitar confusão.
  if(p==='/api/suap/callback' && req.method==='GET'){
    return send(res,400,'Esta versão usa o fluxo JavaScript Implicit/Public do SUAP. Configure a aplicação ACHA no SUAP como Public + Implicit e use http://localhost:3000/login.html como Redirect URI.','text/plain; charset=utf-8');
  }

  if(p==='/api/login' && req.method==='POST'){
    try{
      const x=await body(req),db=readDB(); ensureAuthUsers(db);
      const username=String(x.username||'').trim().toLowerCase(), password=String(x.password||'');
      const user=(db.authUsers||[]).find(u=>String(u.username||'').toLowerCase()===username && u.passwordHash===hashPassword(password));
      if(!user)return send(res,401,{error:'Usuário ou senha inválidos.'});
      const token=crypto.randomBytes(32).toString('hex');
      sessions.set(token,{userId:user.id,expires:Date.now()+8*60*60*1000});
      res.setHeader('Set-Cookie',`pocv_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`);
      const teacher=(db.teachers||[]).find(t=>String(t.id)===String(user.teacherId));
      return send(res,200,{ok:true,user:authUserPayload(db,user),access:roleAccess(db,user)});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(p==='/api/logout' && req.method==='POST'){
    const raw=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('pocv_session='));
    const token=raw?decodeURIComponent(raw.slice('pocv_session='.length)):''; if(token)sessions.delete(token);
    res.setHeader('Set-Cookie','pocv_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
    return send(res,200,{ok:true});
  }
  if(p==='/api/session' && req.method==='GET'){
    const db=readDB(); ensureAuthUsers(db); const user=userFromRequest(req,db);
    if(!user)return send(res,200,{authenticated:false});
    const teacher=(db.teachers||[]).find(t=>String(t.id)===String(user.teacherId));
    return send(res,200,{authenticated:true,user:authUserPayload(db,user),access:roleAccess(db,user)});
  }


  const dbForAuth=readDB();
  const authUser=requireAuth(req,res,dbForAuth);
  if(!authUser)return;

  // No modo de visualização da Direção, o comportamento deve respeitar exatamente
  // o nível configurado para o perfil acadêmico simulado. Visualização não pode
  // executar nenhuma mutação, mesmo que a sessão real seja de Diretor.
  const previewRole=String(req.headers['x-acha-preview-role']||'');
  const previewDirector=String(req.headers['x-acha-preview']||'')==='director' && (authUser.role==='diretor_geral'||authUser.role==='diretoria_academica');
  const previewApiPageMap={
    '/api/offer':'index.html','/api/extra-offer':'demandas.html','/api/demand':'demandas.html','/api/validation':'index.html',
    '/api/matrix':'matrizes.html','/api/matrices':'matrizes.html','/api/teacher':'docentes.html','/api/teacher-link':'docentes.html',
    '/api/group':'grupos.html','/api/variable':'variaveis.html','/api/turma':'turmas.html','/api/pocv':'pocv.html','/api/pocv/config':'pocv.html',
    '/api/profile':'perfil.html','/api/access':'acessos.html','/api/backup':'backup.html'
  };
  if(previewDirector && previewRole && req.method!=='GET' && req.method!=='HEAD'){
    const key=Object.keys(previewApiPageMap).sort((a,b)=>b.length-a.length).find(k=>p===k||p.startsWith(k+'/'));
    const page=key?previewApiPageMap[key]:null;
    const simulated=accessConfig(dbForAuth).profiles[previewRole];
    if(page && simulated?.pages?.[page]!=='edit') return send(res,403,{error:'O perfil simulado possui apenas permissão de visualização nesta área.'});
  }

  if(p==='/api/validation'&&req.method==='GET'){const db=readDB();const approvals=(authUser.role==='diretor_geral'||authUser.role==='diretoria_academica')?db.approvals:db.approvals.filter(a=>String(a.requesterId)===String(authUser.id));return send(res,200,{ok:true,approvals:approvals.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))});}
  if(p==='/api/offer/undo-confirm'&&req.method==='POST'){
    try{const x=await body(req),db=readDB();const key=String(x.key||'');if(!x.semester||!key)return send(res,400,{error:'Semestre e oferta são obrigatórios.'});const isDir=['diretor_geral','diretoria_academica'].includes(authUser.role);if(!isDir&&!['coordenador_curso','coordenador_area'].includes(authUser.role))return send(res,403,{error:'Acesso restrito.'});if(!isDir&&!hasPageEdit(authUser,'index.html',db))return send(res,403,{error:'O Coordenador possui apenas permissão de visualização para Oferta.'});const resolved=resolvePreviewOffer(db,x.semester,{key,source:x.source||{}});const resolvedKey=resolved?.key||key;const current=db.offers?.[x.semester]?.[resolvedKey];if(!current||current.validationStatus!=='approved'||current.validationSource!=='coordinator_confirmation')return send(res,409,{error:'Esta oferta não possui uma confirmação direta que possa ser desfeita.'});if(!isDir&&!coordinatorOwnsOffer(db,authUser,x.semester,resolvedKey))return send(res,403,{error:'Oferta fora da área/curso autorizado.'});const previous=current.confirmationPrevious;if(previous===null||previous===undefined)delete db.offers[x.semester][resolvedKey];else db.offers[x.semester][resolvedKey]=previous;writeDB(db);return send(res,200,{ok:true,undone:true});}catch(e){return send(res,500,{error:e.message})}
  }
  if(p==='/api/offer/undo-delete'&&req.method==='POST'){
    try{const x=await body(req),db=readDB();const semester=String(x.semester||''),key=String(x.key||'');if(!semester||!key)return send(res,400,{error:'Semestre e oferta são obrigatórios.'});const isDir=['diretor_geral','diretoria_academica'].includes(authUser.role);if(!isDir&&!['coordenador_curso','coordenador_area'].includes(authUser.role))return send(res,403,{error:'Acesso restrito.'});if(!isDir&&!hasPageEdit(authUser,'index.html',db))return send(res,403,{error:'O Coordenador possui apenas permissão de visualização para Oferta.'});const resolvedPreview=String(req.headers['x-acha-preview']||'')==='director'?resolvePreviewOffer(db,semester,{key,source:x.source||{}}):null;const resolvedKey=resolvedPreview?.key||key;const del=db.offerDeletions?.[semester]?.[resolvedKey];if(!del)return send(res,404,{error:'Exclusão não encontrada.'});if(!isDir&&!coordinatorOwnsOffer(db,authUser,semester,resolvedKey))return send(res,403,{error:'Oferta fora da área/curso autorizado.'});if(del.snapshot){db.offers??={};db.offers[semester]??={};db.offers[semester][resolvedKey]={...del.snapshot,validationStatus:'approved',validationSource:'restored_after_delete',validationUpdatedAt:new Date().toISOString(),validationBy:authUser.id};}if(db.offerDeletions?.[semester])delete db.offerDeletions[semester][resolvedKey];writeDB(db);return send(res,200,{ok:true,restored:true});}catch(e){return send(res,500,{error:e.message})}
  }
  if(p==='/api/validation'&&req.method==='POST'){
    try{const x=await body(req),db=readDB();ensureWorkflow(db);
      const previewDirector=String(req.headers['x-acha-preview']||'')==='director'&&(authUser.role==='diretor_geral'||authUser.role==='diretoria_academica');
      if(previewDirector){
        if(!x.semester||!semesterInAccessRange(db,authUser,x.semester))return send(res,400,{error:'Semestre não autorizado.'});
        const previewRequester={id:String(x.previewRequester?.id||authUser.id),displayName:String(x.previewRequester?.name||authUser.displayName),role:String(x.previewRequester?.role||'coordenador_curso')};
        if(x.kind==='offer'){
          const resolved=resolvePreviewOffer(db,x.semester,x); if(!resolved)return send(res,404,{error:'Oferta não encontrada.'});
          const key=resolved.key,cur=resolved.current, pth=key.split('|'), d=db.data?.matrices?.[pth[0]]?.disciplines?.[Number(String(pth[3]).split('::')[0])];
          if(x.action==='confirm' && !(d?.optional===true && (x.changes?.optionalChoices||x.changes?.optionalChoice))){
            db.offers??={};db.offers[x.semester]??={};const previous=Object.prototype.hasOwnProperty.call(db.offers[x.semester],key)?JSON.parse(JSON.stringify(db.offers[x.semester][key])):null;const next={...cur,...(x.changes||{}),validationStatus:'approved',validationSource:'coordinator_confirmation',confirmationCreatedAt:new Date().toISOString(),confirmationBy:previewRequester.id,confirmationPrevious:previous};const canonicalCourse=(db.data?.courses||[]).find(c=>String(c.matrix)===String(pth[0]))?.name;if(canonicalCourse)next.course=canonicalCourse;const optChoices=Array.isArray(next.optionalChoices)?next.optionalChoices.filter(Boolean):(next.optionalChoice?[next.optionalChoice]:[]);if(optChoices.length){next.name=optChoices.join(' + ');next.optionalChoices=optChoices;next.optionalChoice=optChoices.length===1?optChoices[0]:'';}delete next.turnScope;db.offers[x.semester][key]=next;await persistDBAndSync(db);return send(res,200,{ok:true,preview:true,approved:true,direct:true});
          }
          if(x.action==='confirm'&&d?.optional===true&&!(x.changes?.optionalChoices||x.changes?.optionalChoice))return send(res,400,{error:'Para validar uma oferta optativa, selecione a disciplina optativa.'});
          if(db.approvals.some(v=>v.status==='pending'&&String(v.requesterId)===previewRequester.id&&v.semester===x.semester&&v.targetKey===key))return send(res,409,{error:'Já existe uma solicitação pendente para esta oferta.'});
          if(x.action==='duplicate'){
            const du=x.duplicate||{};const a=createApproval(db,previewRequester,{type:'offer_duplicate',action:'duplicate',semester:x.semester,targetKey:key,duplicate:{matrix:String(du.matrix||pth[0]),period:String(du.period||pth[1]),seq:String(du.seq||pth[2]),disciplineIndex:String(du.disciplineIndex||String(pth[3]).split('::')[0]),quantity:Math.max(2,Math.min(5,Number(du.quantity)||2))},changes:x.changes||{},snapshot:cur,targetLabel:approvalTargetLabel(db,{type:'offer_duplicate',targetKey:key,semester:x.semester})});notifyDirectors(db,'Nova duplicidade de oferta para avaliação',`${approvalTargetLabel(db,a)} — solicitação cadastrada no modo de teste.`,a.id);writeDB(db);return send(res,201,{ok:true,pending:true,preview:true,approval:a});
          }
          const a=createApproval(db,previewRequester,{type:x.action==='confirm'?'offer_confirm':'offer_change',action:x.action==='delete'?'delete':x.action,semester:x.semester,targetKey:key,changes:x.changes||{},snapshot:cur,targetLabel:approvalTargetLabel(db,{type:'offer_change',targetKey:key,semester:x.semester})});notifyDirectors(db,'Nova pendência para avaliação',`${approvalTargetLabel(db,a)} — solicitação cadastrada no modo de teste.`,a.id);writeDB(db);return send(res,201,{ok:true,pending:true,preview:true,approval:a});
        }
        if(x.kind==='extra')return send(res,400,{error:'Use o fluxo de demanda avulsa para este item.'});
        return send(res,400,{error:'Tipo de solicitação inválido.'});
      }
      if(!['coordenador_curso','coordenador_area'].includes(authUser.role))return send(res,403,{error:'Somente Coordenadores podem solicitar validações.'});if(!hasPageEdit(authUser,'index.html',db))return send(res,403,{error:'O Coordenador possui apenas permissão de visualização para Oferta.'});if(!x.semester||!semesterInAccessRange(db,authUser,x.semester))return send(res,400,{error:'Semestre não autorizado.'});let a;
      if(x.kind==='offer'){
        const resolved=resolvePreviewOffer(db,x.semester,x);const resolvedKey=resolved?.key||String(x.key||'');if(!resolvedKey)return send(res,404,{error:'Oferta não encontrada.'});if(!coordinatorOwnsOffer(db,authUser,x.semester,resolvedKey))return send(res,403,{error:'Oferta fora do curso coordenado.'});const cur=resolved?.current||db.offers?.[x.semester]?.[resolvedKey]||synthesizeOfferFromKey(db,x.semester,resolvedKey);if(!cur)return send(res,404,{error:'Oferta não encontrada.'});const pth=String(resolvedKey).split('|'),d=db.data?.matrices?.[pth[0]]?.disciplines?.[Number(String(pth[3]).split('::')[0])];x.key=resolvedKey;
        if(x.action==='duplicate'){
          const du=x.duplicate||{}, sameClass=du.sameClass===true, matrix=String(du.matrix||pth[0]),period=String(du.period||pth[1]),seq=String(du.seq||pth[2]),di=String(du.disciplineIndex||String(pth[3]).split('::')[0]);
          if(!coordinatorMatrixIds(db,authUser).includes(matrix))return send(res,403,{error:'A turma de destino não pertence ao curso coordenado.'});
          const targetExists=(db.data?.semesters?.[x.semester]||[]).some(c=>String(c.matrix)===matrix&&String(c.period)===period&&String(c.seq)===seq);if(!targetExists)return send(res,400,{error:'Turma de destino não encontrada no semestre selecionado.'});
          const baseKey=`${matrix}|${period}|${seq}|${di}`;if(!sameClass&&String(baseKey)===String(x.key))return send(res,400,{error:'Escolha uma turma diferente da oferta de origem para solicitar a duplicidade.'});
          const already=Object.keys(db.offers?.[x.semester]||{}).some(k=>sameClass?String(k).startsWith(baseKey+'::dup::'):(String(k)===baseKey||String(k).startsWith(baseKey+'::dup::')));if(already)return send(res,409,{error:sameClass?'Já existe uma solicitação/oferta duplicada desta disciplina para esta turma.':'Já existe uma oferta desta disciplina na turma de destino.'});
          if(db.approvals.some(v=>v.status==='pending'&&v.requesterId===authUser.id&&v.type==='offer_duplicate'&&v.semester===x.semester&&String(v.duplicate?.matrix)===matrix&&String(v.duplicate?.period)===period&&String(v.duplicate?.seq)===seq&&String(v.duplicate?.disciplineIndex)===di))return send(res,409,{error:'Já existe uma solicitação de duplicidade pendente para esta turma.'});
          const qty=Math.max(2,Math.min(5,Number(du.quantity)||2));a=createApproval(db,authUser,{type:'offer_duplicate',action:'duplicate',semester:x.semester,targetKey:x.key,duplicate:{matrix,period,seq,disciplineIndex:di,quantity:qty},changes:{notes:String(x.changes?.notes||'').trim()},snapshot:cur,targetLabel:approvalTargetLabel(db,{type:'offer_duplicate',targetKey:x.key,semester:x.semester})});
          notifyDirectors(db,'Nova duplicidade de oferta para avaliação',`${approvalTargetLabel(db,a)} — duplicidade solicitada por ${a.requesterName}.`,a.id);writeDB(db);return send(res,201,{ok:true,pending:true,approval:a});
        }const choices=Array.isArray(x.changes?.optionalChoices)?x.changes.optionalChoices.filter(Boolean):(x.changes?.optionalChoice?[x.changes.optionalChoice]:[]);
        const isOptionalConfirmation=x.action==='confirm'&&d?.optional===true&&choices.length>0;
        if(x.action==='confirm'&&!isOptionalConfirmation){
          db.offers??={};db.offers[x.semester]??={};
          const previous=Object.prototype.hasOwnProperty.call(db.offers[x.semester],x.key)?JSON.parse(JSON.stringify(db.offers[x.semester][x.key])):null;
          const next={...cur,...(x.changes||{}),validationStatus:'approved',validationSource:'coordinator_confirmation',confirmationCreatedAt:new Date().toISOString(),confirmationBy:authUser.id,confirmationPrevious:previous};
          delete next.turnScope; db.offers[x.semester][x.key]=next; await persistDBAndSync(db); return send(res,200,{ok:true,approved:true,direct:true,offer:next});
        }
        if(x.action==='confirm'&&d?.optional===true&&!choices.length)return send(res,400,{error:'Para validar uma oferta optativa, o coordenador deve vincular qual disciplina optativa será ofertada.'});
        if(db.approvals.some(v=>v.status==='pending'&&v.requesterId===authUser.id&&v.semester===x.semester&&v.targetKey===x.key))return send(res,409,{error:'Já existe uma solicitação pendente para esta oferta.'});
        a=createApproval(db,authUser,{type:x.action==='confirm'?'offer_confirm':'offer_change',action:x.action==='delete'?'delete':x.action,semester:x.semester,targetKey:x.key,changes:x.changes||{},snapshot:cur,targetLabel:approvalTargetLabel(db,{type:'offer_change',targetKey:x.key,semester:x.semester})});
      }else if(x.kind==='extra'){
        const teacher=(db.teachers||[]).find(t=>String(t.id)===String(authUser.teacherId)),cid=String(teacher?.coordinatorCourseId||'');
        if(x.action==='create'){if(String(x.proposed?.course||'')!==cid)return send(res,403,{error:'A demanda deve pertencer ao curso coordenado.'});a=createApproval(db,authUser,{type:'extra_create',semester:x.semester,proposed:{name:String(x.proposed.name||'').trim(),ch:Number(x.proposed.ch)||0,type:String(x.proposed.type||'Dependência'),group:String(x.proposed.group||''),turn:String(x.proposed.turn||''),course:cid,notes:String(x.proposed.notes||'')},targetLabel:String(x.proposed.name||'Demanda avulsa')});}
        else{const arr=db.extraOffers?.[x.semester]||[],item=arr.find(v=>String(v.id)===String(x.id));if(!item)return send(res,404,{error:'Demanda avulsa não encontrada.'});a=createApproval(db,authUser,{type:x.action==='delete'?'extra_delete':'extra_change',semester:x.semester,targetId:x.id,changes:x.changes||{},snapshot:item,targetLabel:item.name});}
      }else return send(res,400,{error:'Tipo de solicitação inválido.'});
      notifyDirectors(db,'Nova pendência para avaliação',`${approvalTargetLabel(db,a)} — solicitação cadastrada por ${a.requesterName}.`,a.id);writeDB(db);return send(res,201,{ok:true,pending:true,approval:a});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(p==='/api/validation'&&req.method==='PUT'){
    const previewValidation=String(req.headers['x-acha-preview']||'')==='director' && (authUser.role==='diretor_geral'||authUser.role==='diretoria_academica');
    if(previewValidation){
      try{
        const x=await body(req),db=readDB(),a=db.approvals.find(v=>String(v.id)===String(x.id));
        if(!a)return send(res,404,{error:'Pendência não encontrada.'});
        if(!['pending','correction_requested'].includes(a.status))return send(res,409,{error:'Esta pendência já foi julgada.'});
        const previewRequesterId=String(x.previewRequester?.id||a.requesterId||'');
        if(previewRequesterId && String(a.requesterId)!==previewRequesterId)return send(res,403,{error:'Esta pendência não pertence ao coordenador simulado.'});
        if(x.operation==='cancel_pending'){
          db.approvals=db.approvals.filter(v=>String(v.id)!==String(a.id));
          db.notifications=(db.notifications||[]).filter(n=>String(n.approvalId||'')!==String(a.id));
          writeDB(db);return send(res,200,{ok:true,cancelled:true,preview:true});
        }
        if(x.operation==='edit_pending'){
          if(a.type!=='offer_change'||a.action==='delete')return send(res,400,{error:'Somente alterações de oferta podem ser editadas enquanto pendentes.'});
          const ch=x.changes||{},snap=a.snapshot||{};
          const hasChange=['name','group','ch','turn','optionalChoice','optionalChoices','notes'].some(k=>JSON.stringify(ch[k]??'')!==JSON.stringify(snap[k]??''));
          if(!hasChange)return send(res,400,{error:'Nenhuma alteração foi informada.'});
          a.changes={...ch};a.status='pending';a.decisionNote='';delete a.decidedBy;delete a.decidedById;delete a.decidedAt;a.updatedAt=new Date().toISOString();
          notifyDirectors(db,'Alteração reenviada para avaliação',`${approvalTargetLabel(db,a)} — alteração atualizada no modo de teste.`,a.id);
          writeDB(db);return send(res,200,{ok:true,approval:a,preview:true});
        }
        return send(res,400,{error:'Operação de validação inválida.'});
      }catch(e){return send(res,500,{error:e.message})}
    }
    if(authUser.role==='coordenador_curso'||authUser.role==='coordenador_area'){
      try{const x=await body(req),db=readDB(),a=db.approvals.find(v=>String(v.id)===String(x.id));if(!a)return send(res,404,{error:'Pendência não encontrada.'});if(!['pending','correction_requested'].includes(a.status))return send(res,409,{error:'Esta pendência já foi julgada.'});if(String(a.requesterId)!==String(authUser.id))return send(res,403,{error:'Esta pendência não pertence ao coordenador atual.'});
        if(x.operation==='cancel_pending'){if(!['pending','correction_requested'].includes(a.status))return send(res,409,{error:'Esta solicitação não pode mais ser cancelada.'});db.approvals=db.approvals.filter(v=>String(v.id)!==String(a.id));db.notifications=(db.notifications||[]).filter(n=>String(n.approvalId||'')!==String(a.id));writeDB(db);return send(res,200,{ok:true,cancelled:true});}
        if(x.operation==='edit_pending'){if(a.type!=='offer_change'||a.action==='delete')return send(res,400,{error:'Somente alterações de oferta podem ser editadas enquanto pendentes.'});const ch=x.changes||{},snap=a.snapshot||{};const hasChange=['name','group','ch','turn','optionalChoice','optionalChoices','notes'].some(k=>JSON.stringify(ch[k]??'')!==JSON.stringify(snap[k]??''));if(!hasChange)return send(res,400,{error:'Nenhuma alteração foi informada.'});{const pk=String(a.targetKey||'').split('|'),md=db.data?.matrices?.[pk[0]]||{},dd=md.disciplines?.[Number(String(pk[3]||'').split('::')[0])];if(dd?.optional&&ch.name){const catalog=Array.isArray(md.optionalCatalog)?md.optionalCatalog:[];if(!catalog.some(o=>String(o.name)===String(ch.name)))return send(res,400,{error:'Disciplina optativa inválida.'});}}a.changes={...ch};a.status='pending';a.decisionNote='';delete a.decidedBy;delete a.decidedById;delete a.decidedAt;a.updatedAt=new Date().toISOString();notifyDirectors(db,'Alteração reenviada para avaliação',`${approvalTargetLabel(db,a)} — alteração atualizada por ${a.requesterName}.`,a.id);writeDB(db);return send(res,200,{ok:true,approval:a});}
      }catch(e){return send(res,500,{error:e.message})}
    }
    if(authUser.role!=='diretor_geral'&&authUser.role!=='diretoria_academica')return send(res,403,{error:'Acesso restrito à Direção.'});
    try{const x=await body(req),db=readDB(),a=db.approvals.find(v=>String(v.id)===String(x.id));if(!a)return send(res,404,{error:'Pendência não encontrada.'});if(a.status!=='pending')return send(res,409,{error:'Esta pendência já foi julgada.'});const decision=x.decision==='approve'?'approved':x.decision==='correction'?'correction_requested':null;if(!decision)return send(res,400,{error:'Decisão inválida.'});a.status=decision;a.decisionNote=String(x.note||'').trim();a.decidedBy=authUser.displayName;a.decidedById=authUser.id;a.decidedAt=new Date().toISOString();if(decision==='approved')applyApproval(db,a);pushNotification(db,a.requesterId,decision==='approved'?'Solicitação aprovada':'Correção solicitada',`${approvalTargetLabel(db,a)} — ${decision==='approved'?'aprovada':'devolvida para correção'}.${a.decisionNote?' '+a.decisionNote:''}`,a.id);writeDB(db);return send(res,200,{ok:true,approval:a});}catch(e){return send(res,500,{error:e.message})}
  }
  if(p==='/api/notifications'&&req.method==='GET'){const db=readDB(),all=db.notifications.filter(n=>String(n.userId)===String(authUser.id)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).map(n=>{const a=db.approvals.find(v=>String(v.id)===String(n.approvalId));return {...n,semester:a?.semester||'',targetKey:a?.targetKey||'',approvalType:a?.type||''};});return send(res,200,{ok:true,notifications:all,unread:all.filter(n=>!n.read).length});}
  if(p==='/api/notifications/read-all'&&req.method==='PUT'){const db=readDB();db.notifications.filter(n=>String(n.userId)===String(authUser.id)).forEach(n=>n.read=true);writeDB(db);return send(res,200,{ok:true});}

  if(p==='/api/access' && req.method==='GET'){
    if(authUser.role!=='diretor_geral'&&authUser.role!=='diretoria_academica')return send(res,403,{error:'Acesso restrito à Direção.'});
    const db=readDB(); return send(res,200,{ok:true,catalog:PAGE_CATALOG,levels:[['none','Sem acesso'],['view','Visualização'],['edit','Edição']],access:accessConfig(db)});
  }
  if(p==='/api/access' && req.method==='PUT'){
    if(authUser.role!=='diretor_geral'&&authUser.role!=='diretoria_academica')return send(res,403,{error:'Acesso restrito à Direção.'});
    try{
      const x=await body(req),db=readDB();
      if(!x.role||!ACCESS_DEFAULTS[x.role])return send(res,400,{error:'Perfil inválido.'});
      const base=ACCESS_DEFAULTS[x.role], pages={...base.pages,...(x.pages||{})};
      for(const [page] of PAGE_CATALOG) if(!PERMISSION_LEVELS.has(pages[page]))pages[page]='none';
      const from=String(x.semesterFrom||base.semesterFrom),to=String(x.semesterTo||base.semesterTo);
      if(semesterIndex(from)==null||semesterIndex(to)==null||semesterIndex(from)>semesterIndex(to))return send(res,400,{error:'Intervalo de semestres inválido.'});
      db.accessControl=db.accessControl||{version:1,profiles:{}}; db.accessControl.version=1;
      db.accessControl.profiles[x.role]={label:base.label,pages,semesterFrom:from,semesterTo:to,features:{...base.features,...(x.features||{})}};
      writeDB(db); return send(res,200,{ok:true,access:accessConfig(db)});
    }catch(e){return send(res,500,{error:e.message})}
  }

  // Autorização por página/recurso: leitura exige view/edit; mutações exigem edit.
  const apiPageMap={
    '/api/pocv':'pocv.html','/api/pocv/config':'pocv.html','/api/teacher':'docentes.html','/api/teacher-link':'docentes.html','/api/matrix':'matrizes.html','/api/matrices':'matrizes.html','/api/offer':'index.html','/api/extra-offer':'index.html','/api/demand':'demandas.html','/api/group':'grupos.html','/api/variable':'variaveis.html','/api/rule':'regras.html','/api/turma':'turmas.html','/api/backup':'backup.html','/api/profile':'perfil.html','/api/access':'acessos.html','/api/validation':'pendencias.html','/api/notifications':'notificacoes.html'
  };
  const apiPage=Object.keys(apiPageMap).sort((a,b)=>b.length-a.length).find(k=>p===k||p.startsWith(k+'/'));
  if(apiPage){
    const page=apiPageMap[apiPage], perm=pagePermission(dbForAuth,authUser,page);
    if(perm==='none')return send(res,403,{error:'Você não possui permissão para acessar esta área.'});
    if(req.method!=='GET' && req.method!=='HEAD' && perm!=='edit')return send(res,403,{error:'Seu perfil possui apenas permissão de visualização nesta área.'});
  }

  // Apenas Diretor Geral e Diretoria Acadêmica podem acessar as áreas administrativas. e Diretoria Acadêmica podem acessar as áreas administrativas.
  if(authUser.role==='coordenador_curso' && p.startsWith('/api/pocv'))return send(res,403,{error:'Acesso restrito à direção.'});
  if(authUser.role==='coordenador_curso' && p==='/api/pocv/config')return send(res,403,{error:'Acesso restrito à direção.'});

  // Cenários da POCV: planejamento oficial e simulações independentes.
  if(p==='/api/pocv/scenarios'){
    try{
      const db=readDB();
      if(req.method==='GET'){
        const scenarios=ensurePocvScenarios(db);
        return send(res,200,{ok:true,scenarios,realId:scenarios.find(s=>s.isReal)?.id||null});
      }
      if(req.method==='POST'){
        const x=await body(req);
        const scenarios=ensurePocvScenarios(db);
        const now=new Date().toISOString();
        if(x.action==='sync-real'){
          const idx=scenarios.findIndex(v=>String(v.id)===String(x.sourceId));
          if(idx<0)return send(res,404,{error:'Cenário não encontrado'});
          if(!scenarios[idx].isReal)return send(res,409,{error:'A sincronização só pode ser feita no cenário real.'});
          const rebuilt=buildInitialPocvScenario(db);
          rebuilt.id=scenarios[idx].id;
          rebuilt.name=scenarios[idx].name||'Cenário Real';
          rebuilt.isReal=true;
          rebuilt.createdAt=scenarios[idx].createdAt||now;
          rebuilt.updatedAt=now;
          scenarios[idx]=rebuilt;
          writeDB(db);
          return send(res,200,{ok:true,scenario:rebuilt});
        }
        if(x.action==='clone'){
          const source=scenarios.find(v=>String(v.id)===String(x.sourceId));
          if(!source)return send(res,404,{error:'Cenário de origem não encontrado'});
          const id=`sc${Date.now()}`;
          const copy=JSON.parse(JSON.stringify(source));
          copy.id=id;
          copy.name=String(x.name||`${source.name} — cópia`).trim();
          copy.isReal=false;
          copy.placements=(copy.placements||[]).map((v,i)=>({...v,id:`${id}-p${i+1}`}));
          normalizePocvScenario(db,copy,false);
          copy.createdAt=now; copy.updatedAt=now;
          scenarios.push(copy); writeDB(db);
          return send(res,201,{ok:true,scenario:copy});
        }
        const id=`sc${Date.now()}`;
        const scenario={
          id,name:String(x.name||'Novo cenário').trim()||'Novo cenário',
          isReal:false,
          startSemester:String(x.startSemester||'2027.1'),
          endSemester:String(x.endSemester||'2033.2'),
          placements:Array.isArray(x.placements)?x.placements:[],
          createdAt:now,updatedAt:now
        };
        scenarios.push(scenario); writeDB(db);
        return send(res,201,{ok:true,scenario});
      }
      if(req.method==='PUT'){
        const x=await body(req);
        const scenarios=ensurePocvScenarios(db);
        const i=scenarios.findIndex(v=>String(v.id)===String(x.id));
        if(i<0)return send(res,404,{error:'Cenário não encontrado'});
        const current=scenarios[i], changes=x.changes||{};
        // O cenário real é a fonte oficial da oferta. Ele é somente leitura: nenhuma alteração de nome, período, placements ou qualquer outro campo pode ser gravada diretamente.
        // A única transição permitida é promover uma simulação a real via isReal=true.
        if(current.isReal){
          const keys=Object.keys(changes);
          if(!(keys.length===1 && changes.isReal===true)){
            return send(res,409,{error:'O cenário real é somente leitura. Crie ou clone um novo cenário para alterar a oferta.'});
          }
        }
        const next=Object.assign({},current,changes);
        next.id=current.id;
        next.name=String(next.name||current.name).trim();
        next.startSemester=String(next.startSemester||current.startSemester);
        next.endSemester=String(next.endSemester||current.endSemester);
        next.placements=Array.isArray(next.placements)?next.placements:[];
        normalizePocvScenario(db,next,!!next.isReal);
        next.updatedAt=new Date().toISOString();
        if(changes.isReal===true){
          scenarios.forEach(v=>v.isReal=false);
          next.isReal=true;
        }else if(current.isReal){
          next.isReal=true;
        }else next.isReal=false;
        scenarios[i]=next; writeDB(db);
        return send(res,200,{ok:true,scenario:next});
      }
      if(req.method==='DELETE'){
        const id=parsed.query.id;
        const scenarios=ensurePocvScenarios(db);
        const i=scenarios.findIndex(v=>String(v.id)===String(id));
        if(i<0)return send(res,404,{error:'Cenário não encontrado'});
        if(scenarios[i].isReal)return send(res,409,{error:'O cenário real não pode ser excluído. Defina outro cenário como real antes de excluí-lo.'});
        const removed=scenarios.splice(i,1)[0]; writeDB(db);
        return send(res,200,{ok:true,scenario:removed});
      }
    }catch(e){return send(res,500,{error:e.message})}
  }


  if(p==='/api/pocv/config'){
    try{
      const db=readDB();
      if(req.method==='GET') return send(res,200,{ok:true,config:pocvConfig(db)});
      if(req.method==='PUT'){
        const x=await body(req);
        const current=pocvConfig(db);
        const next={
          defaultVacancies:Math.max(1,Number(x.defaultVacancies)||current.defaultVacancies),
          specializationVacancies:Math.max(1,Number(x.specializationVacancies)||current.specializationVacancies),
          teacherHours:Math.max(1,Number(x.teacherHours)||current.teacherHours)
        };
        db.pocvConfig=next;
        writeDB(db);
        return send(res,200,{ok:true,config:next});
      }
    }catch(e){return send(res,500,{error:e.message})}
  }

  if(req.method==='GET'&&p==='/api/db'){const authDb=readDB();const user=requireAuth(req,res,authDb);if(!user)return;const db=await readDBForApi();if(normalizeOfferTurns(db))writeDB(db);res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.setHeader('Pragma','no-cache');return send(res,200,filterDbForUserWithAccess(db,user));}
  // Editor de matrizes curriculares
  if((req.method==='GET'||req.method==='PUT'||req.method==='POST') && (p==='/api/matrix' || p==='/api/matrices')){
    try{
      const db=readDB();
      if(req.method==='GET'){
        const id=parsed.query.id;
        if(authUser.role==='coordenador_curso' && id!=null && id!=='' && !coordinatorMatrixIds(db,authUser).includes(String(id)))return send(res,403,{error:'Matriz fora do curso coordenado.'});
        if(id!=null && id!==''){
          const matrix=db.data?.matrices?.[String(id)];
          if(!matrix)return send(res,404,{error:'Matriz não encontrada'});
          const course=(db.data?.courses||[]).find(c=>String(c.matrix)===String(id))||null;
          return send(res,200,{ok:true,matrixId:String(id),matrix,course});
        }
        const matrices=db.data?.matrices||{};
        const courses=db.data?.courses||[];
        return send(res,200,{ok:true,matrices,courses});
      }
      const x=await body(req);
      db.data??={}; db.data.matrices??={}; db.data.courses??=[];
      if(req.method==='POST' && authUser.role==='coordenador_curso')return send(res,403,{error:'Coordenadores não podem cadastrar novas matrizes.'});
      if(req.method==='POST'){
        const id=Math.max(0,...Object.keys(db.data.matrices).map(Number).filter(Number.isFinite),...db.data.courses.map(c=>Number(c.matrix)||0))+1;
        const matrix=Object.assign({name:''},x.matrix||{});
        matrix.disciplines=Array.isArray(matrix.disciplines)?matrix.disciplines:[];
        db.data.matrices[String(id)]=matrix;
        const course={
          matrix:id,
          name:String(x.course?.name||matrix.name||'').trim(),
          type:String(x.course?.type||'').trim(),
          level:String(x.course?.level||'').trim(),
          form:String(x.course?.form||'').trim(),
          course_id:String(x.course?.course_id||'').trim(),
          course_name:String(x.course?.course_name||x.course?.name||'').trim()
        };
        db.data.courses.push(course);
        writeDB(db);
        return send(res,201,{ok:true,matrixId:String(id),matrix,course});
      }
      const id=String(x.id??'');
      if(authUser.role==='coordenador_curso' && !coordinatorMatrixIds(db,authUser).includes(id))return send(res,403,{error:'Matriz fora do curso coordenado.'});
      if(!id || !db.data.matrices[id])return send(res,404,{error:'Matriz não encontrada'});
      const current=db.data.matrices[id];
      const incoming=x.matrix||{};
      const next=Object.assign({},current,incoming);
      next.disciplines=Array.isArray(incoming.disciplines)?incoming.disciplines:(
        Array.isArray(current.disciplines)?current.disciplines:[]
      );
      next.name=String(next.name??'').trim();
      next.campus=String(next.campus??'').trim();
      next.offerLevel=String(next.offerLevel??next.level??'').trim();
      next.offerForm=String(next.offerForm??next.form??'').trim();
      next.offerFormat=String(next.offerFormat??'').trim();
      next.organization=String(next.organization??'').trim();
      next.participation=String(next.participation??'').trim();
      next.externalFunding=String(next.externalFunding??'').trim();
      next.annualizedWorkloadHours=Math.max(0,Math.round(Number(next.annualizedWorkloadHours)||0));
      next.verticalization=String(next.verticalization??'').trim();
      next.academicDirector=String(next.academicDirector??'').trim();
      next.fcc=String(next.fcc??'').trim();
      next.optionalCatalog=Array.isArray(incoming.optionalCatalog)?incoming.optionalCatalog.map(o=>({
        name:String(o?.name??'').trim(),group:String(o?.group??'').trim(),
        weekly:Number(o?.weekly)||0,clockHours:Number(o?.clockHours)||0,lessonHours:Number(o?.lessonHours)||0
      })).filter(o=>o.name):(Array.isArray(current.optionalCatalog)?current.optionalCatalog:[]);
      // Sanitize dynamic curricular rows without destroying legacy data.
      next.disciplines=next.disciplines.map(d=>{
        const periods={};
        Object.entries(d?.periods||{}).forEach(([period,ch])=>{
          const n=Number(ch);
          if(Number.isFinite(n) && n>0)periods[String(Number(period))]=n;
        });
        return {name:String(d?.name??'').trim(),group:String(d?.group??'').trim(),optional:d?.optional===true || /\\boptativ[oa]\\b/i.test(String(d?.name??'')),periods};
      }).filter(d=>d.name);
      db.data.matrices[id]=next;
      const ci=db.data.courses.findIndex(c=>String(c.matrix)===id);
      const coursePatch=x.course||{};
      if(ci>=0){
        const c=db.data.courses[ci];
        Object.assign(c,coursePatch);
        c.matrix=Number(id);
        if(coursePatch.course_name!==undefined)c.course_name=String(coursePatch.course_name||'').trim();
        if(coursePatch.course_id!==undefined)c.course_id=String(coursePatch.course_id||'').trim();
        if(coursePatch.name!==undefined)c.name=String(coursePatch.name||'').trim();
        if(coursePatch.type!==undefined)c.type=String(coursePatch.type||'').trim();
        if(coursePatch.level!==undefined)c.level=String(coursePatch.level||'').trim();
        if(coursePatch.form!==undefined)c.form=String(coursePatch.form||'').trim();
      }else{
        db.data.courses.push(Object.assign({matrix:Number(id),name:next.name,course_name:''},coursePatch));
      }
      writeDB(db);
      return send(res,200,{ok:true,matrixId:id,matrix:next,course:db.data.courses.find(c=>String(c.matrix)===id)||null});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='POST'&&p==='/api/extra-offer'){
    try{
      const x=await body(req); if(!x.semester||!String(x.name||'').trim()) return send(res,400,{error:'Semestre e disciplina são obrigatórios'});
      const db=readDB();
      if(authUser.role==='coordenador_curso'){const teacher=(db.teachers||[]).find(t=>String(t.id)===String(authUser.teacherId)),cid=String(teacher?.coordinatorCourseId||'');if(String(x.course||'')!==cid)return send(res,403,{error:'A demanda deve pertencer ao curso coordenado.'});const a=createApproval(db,authUser,{type:'extra_create',semester:x.semester,proposed:{name:String(x.name).trim(),ch:Number(x.ch)||0,type:String(x.type||'Dependência'),group:String(x.group||''),turn:String(x.turn||''),course:cid,notes:String(x.notes||'')},targetLabel:String(x.name).trim()});notifyDirectors(db,'Nova demanda avulsa para avaliação',`${approvalTargetLabel(db,a)} — solicitada por ${a.requesterName}.`,a.id);writeDB(db);return send(res,202,{ok:true,pending:true,approval:a});}
      db.extraOffers??={}; db.extraOffers[x.semester]??=[];
      const id=Math.max(0,...db.extraOffers[x.semester].map(v=>Number(v.id)||0))+1;
      const item={id,name:String(x.name).trim(),ch:Number(x.ch)||0,group:String(x.group||'').trim(),course:String(x.course||'').trim(),type:String(x.type||'Dependência').trim(),turn:String(x.turn||'').trim(),notes:String(x.notes||'').trim(),createdAt:new Date().toISOString()};
      db.extraOffers[x.semester].push(item); writeDB(db); return send(res,201,{ok:true,offer:item});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='PUT'&&p==='/api/extra-offer'){
    try{
      const x=await body(req); const db=readDB(); const arr=db.extraOffers?.[x.semester]||[]; const i=arr.findIndex(v=>String(v.id)===String(x.id));
      if(i<0)return send(res,404,{error:'Demanda avulsa não encontrada'}); if(authUser.role==='coordenador_curso'){const a=createApproval(db,authUser,{type:'extra_change',semester:x.semester,targetId:x.id,changes:x.changes||{},snapshot:arr[i],targetLabel:arr[i].name});notifyDirectors(db,'Nova alteração em demanda avulsa para avaliação',`${approvalTargetLabel(db,a)} — solicitada por ${a.requesterName}.`,a.id);writeDB(db);return send(res,202,{ok:true,pending:true,approval:a});} arr[i]=Object.assign({},arr[i],x.changes||{}); writeDB(db); return send(res,200,{ok:true,offer:arr[i]});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='DELETE'&&p==='/api/extra-offer'){
    try{const semester=parsed.query.semester,id=parsed.query.id; const db=readDB(); if(authUser.role==='coordenador_curso'){const item=(db.extraOffers?.[semester]||[]).find(v=>String(v.id)===String(id));if(!item)return send(res,404,{error:'Demanda avulsa não encontrada'});const a=createApproval(db,authUser,{type:'extra_delete',semester,targetId:id,changes:{},snapshot:item,targetLabel:item.name});notifyDirectors(db,'Nova correção em demanda avulsa para avaliação',`${approvalTargetLabel(db,a)} — exclusão solicitada por ${a.requesterName}.`,a.id);writeDB(db);return send(res,202,{ok:true,pending:true,approval:a});} if(db.extraOffers?.[semester]) db.extraOffers[semester]=db.extraOffers[semester].filter(v=>String(v.id)!==String(id)); writeDB(db); return send(res,200,{ok:true})}catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='PUT'&&p==='/api/offer'){
    try{
      const x=await body(req);if(!x.semester||!x.key||!x.changes)return send(res,400,{error:'Dados inválidos'});
      const db=readDB();
      const previewDirector=String(req.headers['x-acha-preview']||'')==='director'&&(authUser.role==='diretor_geral'||authUser.role==='diretoria_academica');
      if(previewDirector){
        if(!semesterInAccessRange(db,authUser,x.semester))return send(res,400,{error:'Semestre não autorizado.'});
        const resolved=resolvePreviewOffer(db,x.semester,x); if(!resolved)return send(res,404,{error:'Oferta não encontrada.'});
        const fake={type:'offer_change',action:'change',semester:x.semester,targetKey:resolved.key,changes:x.changes||{},snapshot:resolved.current,decidedById:authUser.id};
        applyApproval(db,fake);writeDB(db);return send(res,200,{ok:true,preview:true,approved:true});
      }
      if(authUser.role==='coordenador_curso'){if(!coordinatorOwnsOffer(db,authUser,x.semester,x.key))return send(res,403,{error:'Oferta fora do curso coordenado ou semestre não autorizado.'});const current=db.offers?.[x.semester]?.[x.key]||synthesizeOfferFromKey(db,x.semester,x.key);if(!current)return send(res,404,{error:'Oferta não encontrada.'});const pth=String(x.key).split('|'),d=db.data?.matrices?.[pth[0]]?.disciplines?.[Number(pth[3])],choices=Array.isArray(x.changes?.optionalChoices)?x.changes.optionalChoices.filter(Boolean):(x.changes?.optionalChoice?[x.changes.optionalChoice]:[]);if(d?.optional===true&&x.action!=='delete'&&!choices.length)return send(res,400,{error:'Para validar uma oferta optativa, o coordenador deve vincular qual disciplina optativa será ofertada.'});const a=createApproval(db,authUser,{type:'offer_change',semester:x.semester,targetKey:x.key,action:'change',changes:x.changes||{},snapshot:current,targetLabel:approvalTargetLabel(db,{type:'offer_change',targetKey:x.key,semester:x.semester})});notifyDirectors(db,'Nova correção em oferta para avaliação',`${approvalTargetLabel(db,a)} — solicitada por ${a.requesterName}.`,a.id);writeDB(db);return send(res,202,{ok:true,pending:true,approval:a});}
      if(authUser.role==='coordenador_curso' && !coordinatorMatrixIds(db,authUser).includes(String(x.key).split('|')[0]))return send(res,403,{error:'Oferta fora do curso coordenado.'});
      db.offers??={};db.offers[x.semester]??={};
      const current=db.offers[x.semester][x.key]||{};const next=Object.assign({},current,x.changes);delete next.turnScope;
      { const parts=String(x.key).split('|'); const requestedTurn=String(x.changes?.turn||'').trim(); const scope=String(x.changes?.turnScope||'offer'); const expected=classTurn(db,Number(parts[0]),Number(parts[1]),Number(parts[2])); if(requestedTurn) next.turn=requestedTurn; else if(scope!=='class' && expected && expected!=='A definir') next.turn=expected; if(scope==='class' && requestedTurn){const prefix=`${parts[0]}|${parts[1]}|${parts[2]}|`;Object.keys(db.offers[x.semester]||{}).filter(k=>String(k).startsWith(prefix)).forEach(k=>{db.offers[x.semester][k]={...db.offers[x.semester][k],turn:requestedTurn};});} }
      // teacherId may only point to a teacher belonging to the offer's resulting group.
      if(Object.prototype.hasOwnProperty.call(x.changes,'teacherId') && x.changes.teacherId!=null && x.changes.teacherId!==''){
        const parts=String(x.key).split('|');const matrix=String(parts[0]),di=Number(parts[3]);const d=db.data?.matrices?.[matrix]?.disciplines?.[di];
        const offerGroup=String(next.group??d?.group??'').trim();
        const teacher=db.teachers.find(t=>String(t.id)===String(x.changes.teacherId));
        if(!teacher)return send(res,400,{error:'Professor não encontrado'});
        if(!offerGroup || String(teacher.group||'').trim()!==offerGroup)return send(res,400,{error:'O professor selecionado precisa pertencer ao mesmo grupo da disciplina.'});
      }
      // Changing the group invalidates a previous teacher from another group.
      if(Object.prototype.hasOwnProperty.call(x.changes,'group') && Object.prototype.hasOwnProperty.call(next,'teacherId') && next.teacherId){
        const parts=String(x.key).split('|');const matrix=String(parts[0]),di=Number(parts[3]);const d=db.data?.matrices?.[matrix]?.disciplines?.[di];const offerGroup=String(next.group??d?.group??'').trim();const teacher=db.teachers.find(t=>String(t.id)===String(next.teacherId));
        if(!teacher || !offerGroup || String(teacher.group||'').trim()!==offerGroup)next.teacherId=null;
      }
      db.offers[x.semester][x.key]=next;writeDB(db);return send(res,200,{ok:true,offer:next});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='DELETE'&&p==='/api/offer'){
    try{
      const semester=parsed.query.semester, key=parsed.query.key;
      if(!semester||!key)return send(res,400,{error:'Semestre e oferta são obrigatórios'});
      const db=readDB();
      const previewDirector=String(req.headers['x-acha-preview']||'')==='director'&&(authUser.role==='diretor_geral'||authUser.role==='diretoria_academica');
      if(previewDirector){
        if(!semesterInAccessRange(db,authUser,semester))return send(res,400,{error:'Semestre não autorizado.'});
        const resolved=resolvePreviewOffer(db,semester,{key,source:{}}); if(!resolved)return send(res,404,{error:'Oferta não encontrada.'});
        delete db.offers[semester][resolved.key];writeDB(db);return send(res,200,{ok:true,preview:true,approved:true});
      }
      if(authUser.role==='coordenador_curso'){if(!coordinatorOwnsOffer(db,authUser,semester,key))return send(res,403,{error:'Oferta fora do curso coordenado ou semestre não autorizado.'});const current=db.offers?.[semester]?.[key];if(!current)return send(res,404,{error:'Oferta não encontrada.'});const a=createApproval(db,authUser,{type:'offer_change',semester,targetKey:key,action:'delete',changes:{},snapshot:current,targetLabel:approvalTargetLabel(db,{type:'offer_change',targetKey:key,semester})});notifyDirectors(db,'Nova correção em oferta para avaliação',`${approvalTargetLabel(db,a)} — exclusão solicitada por ${a.requesterName}.`,a.id);writeDB(db);return send(res,202,{ok:true,pending:true,approval:a});}
      if(db.offers?.[semester] && Object.prototype.hasOwnProperty.call(db.offers[semester],key)){
        delete db.offers[semester][key];
        writeDB(db);
      }
      return send(res,200,{ok:true});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='PUT'&&p==='/api/teacher'){
    if(authUser.role==='coordenador_curso')return send(res,403,{error:'Acesso restrito à direção.'});
    try{
      const x=await body(req),db=readDB();
      const i=db.teachers.findIndex(t=>String(t.id)===String(x.id));
      if(i<0)return send(res,404,{error:'Docente não encontrado'});
      const teacher=db.teachers[i],changes=x.changes||{};
      const oldVinculo=teacher.vinculo;
      const newVinculo=changes.vinculo===undefined?oldVinculo:changes.vinculo;
      const newManagement=changes.management===undefined?teacher.management:changes.management;

      const requestedCoordinatorCourseId=changes.coordinatorCourseId!==undefined
        ? String(changes.coordinatorCourseId||'').trim()
        : String(teacher.coordinatorCourseId||'').trim();
      if(newManagement==='Coordenação de Curso'){
        if(!requestedCoordinatorCourseId)return send(res,400,{error:'Para Coordenação de Curso, informe o curso coordenado.'});
        const coordinatorCourse=(db.data?.courses||[]).find(c=>String(c.course_id||c.course_name||c.name||'')===requestedCoordinatorCourseId);
        if(!coordinatorCourse)return send(res,400,{error:'Curso selecionado para a coordenação não foi encontrado.'});
        changes.coordinatorCourseId=requestedCoordinatorCourseId;
        changes.coordinatorCourseName=String(coordinatorCourse.course_name||coordinatorCourse.name||'').trim();
      }else{
        changes.coordinatorCourseId=null;
        changes.coordinatorCourseName=null;
      }

      if(newVinculo==='Substituto temporário'){
        const requestedTitularId=changes.substituteForId!==undefined
          ? (changes.substituteForId===''||changes.substituteForId==null?null:Number(changes.substituteForId))
          : (teacher.substituteForId==null?null:Number(teacher.substituteForId));
        if(requestedTitularId==null)return send(res,400,{error:'Para um substituto temporário, informe obrigatoriamente o docente titular associado.'});
        const titular=db.teachers.find(t=>Number(t.id)===requestedTitularId);
        if(!titular)return send(res,404,{error:'Docente titular não encontrado'});
        if(Number(titular.id)===Number(teacher.id))return send(res,400,{error:'Um docente não pode ser substituto de si mesmo'});
        if(titular.vinculo==='Substituto temporário' || titular.vinculo==='Visitante')return send(res,400,{error:'O docente associado precisa ser um docente titular, não substituto ou visitante.'});
        const titularForValidation={...titular,...changes};
        if(!canHaveSubstitute(titularForValidation))return send(res,400,{error:'Este docente só pode ter substituto durante afastamento para capacitação, cessão ou exercício de cargo de direção.'});
        if(titular.substituteId!=null && Number(titular.substituteId)!==Number(teacher.id))return send(res,409,{error:'Este docente já possui outro substituto associado. Cada docente pode ter no máximo um substituto.'});
        if(teacher.substituteForId!=null && Number(teacher.substituteForId)!==requestedTitularId){
          const oldTitular=db.teachers.find(t=>Number(t.id)===Number(teacher.substituteForId));
          if(oldTitular && Number(oldTitular.substituteId)===Number(teacher.id)) oldTitular.substituteId=null;
        }
        teacher.substituteForId=requestedTitularId;
        teacher.substituteId=null;
        titular.substituteId=Number(teacher.id);
      }else{
        // Keep association fields consistent when the type of vínculo changes.
        if(oldVinculo==='Substituto temporário' && teacher.substituteForId!=null){
          const titular=db.teachers.find(t=>Number(t.id)===Number(teacher.substituteForId));
          if(titular && Number(titular.substituteId)===Number(teacher.id)) titular.substituteId=null;
          teacher.substituteForId=null;
        }
        if(newVinculo==='Visitante'){
          delete changes.substituteId;
          delete changes.substituteForId;
          teacher.substituteId=null;
          teacher.substituteForId=null;
        }
      }

      const associationTitularId=newVinculo==='Substituto temporário'
        ? (changes.substituteForId!==undefined ? Number(changes.substituteForId) : Number(teacher.substituteForId))
        : null;
      db.teachers[i]=applyTeacherFactor(Object.assign(teacher,changes));
      if(newVinculo!=='Substituto temporário' && !canHaveSubstitute(db.teachers[i]) && db.teachers[i].substituteId!=null){
        const oldSub=db.teachers.find(s=>Number(s.id)===Number(db.teachers[i].substituteId));
        if(oldSub && Number(oldSub.substituteForId)===Number(db.teachers[i].id)) oldSub.substituteForId=null;
        db.teachers[i].substituteId=null;
      }
      delete db.teachers[i].substituteId;
      if(newVinculo==='Substituto temporário') db.teachers[i].substituteForId=associationTitularId;
      else delete db.teachers[i].substituteForId;
      writeDB(db);
      return send(res,200,{ok:true,teacher:db.teachers[i]});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='POST'&&p==='/api/teacher'){
    if(authUser.role==='coordenador_curso')return send(res,403,{error:'Acesso restrito à direção.'});
    try{
      const x=await body(req);
      if(!String(x.name||'').trim())return send(res,400,{error:'Informe o nome do docente'});
      const db=readDB();
      const vinculo=x.vinculo||'Efetivo';
      const management=x.management||'Não se aplica';
      const coordinatorCourseId=String(x.coordinatorCourseId||'').trim();
      if(management==='Coordenação de Curso'){
        if(!coordinatorCourseId)return send(res,400,{error:'Para Coordenação de Curso, informe o curso coordenado.'});
        const coordinatorCourse=(db.data?.courses||[]).find(c=>String(c.course_id||c.course_name||c.name||'')===coordinatorCourseId);
        if(!coordinatorCourse)return send(res,400,{error:'Curso selecionado para a coordenação não foi encontrado.'});
        x.coordinatorCourseId=coordinatorCourseId;
        x.coordinatorCourseName=String(coordinatorCourse.course_name||coordinatorCourse.name||'').trim();
      }else{
        delete x.coordinatorCourseId;
        delete x.coordinatorCourseName;
      }
      const titularId=x.substituteForId===''||x.substituteForId==null?null:Number(x.substituteForId);
      if(vinculo==='Substituto temporário' && titularId==null){
        return send(res,400,{error:'Para um substituto temporário, informe obrigatoriamente o docente titular associado.'});
      }
      let titular=null;
      if(titularId!=null){
        titular=db.teachers.find(t=>Number(t.id)===titularId);
        if(!titular)return send(res,404,{error:'Docente titular não encontrado'});
        if(titular.vinculo==='Substituto temporário' || titular.vinculo==='Visitante')return send(res,400,{error:'Um substituto temporário ou visitante não pode ser o titular de outro substituto.'});
        if(!canHaveSubstitute(titular))return send(res,400,{error:'O docente titular precisa estar afastado para capacitação, cedido ou em cargo de direção para ter substituto.'});
        if(titular.substituteId!=null)return send(res,409,{error:'Este docente já possui um substituto associado.'});
      }
      const id=Math.max(0,...db.teachers.map(t=>Number(t.id)||0))+1;
      const data={...x};
      delete data.substituteForId;
      delete data.substituteId;
      const teacher=applyTeacherFactor(Object.assign({id,name:'',discipline:'',group:'',degree:'',regime:'DE',regimePct:1,leave:'Não se aplica',management:'Não se aplica',vinculo:'Efetivo'},data));
      if(vinculo==='Visitante'){
        delete teacher.substituteId;
      }else if(vinculo!=='Substituto temporário'){
        delete teacher.substituteForId;
      }
      if(vinculo==='Substituto temporário'){
        teacher.substituteForId=Number(titular.id);
        titular.substituteId=Number(teacher.id);
      }
      db.teachers.push(teacher);
      writeDB(db);
      return send(res,201,{ok:true,teacher,linkedTitular:titular||null});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='PUT'&&p==='/api/teacher-link'){
    if(authUser.role==='coordenador_curso')return send(res,403,{error:'Acesso restrito à direção.'});
    try{
      const x=await body(req);
      const db=readDB();
      const titularId=x.teacherId===''||x.teacherId==null?null:Number(x.teacherId);
      const substituteId=x.substituteId===''||x.substituteId==null?null:Number(x.substituteId);
      const titular=titularId==null?null:db.teachers.find(t=>Number(t.id)===titularId);
      const substitute=substituteId==null?null:db.teachers.find(t=>Number(t.id)===substituteId);

      if(titularId!=null && !titular)return send(res,404,{error:'Docente titular não encontrado'});
      if(substituteId!=null && !substitute)return send(res,404,{error:'Professor substituto não encontrado'});
      if(substitute && substitute.vinculo!=='Substituto temporário'){
        return send(res,400,{error:'O docente selecionado não está cadastrado como substituto temporário'});
      }
      if(titular && (titular.vinculo==='Substituto temporário' || titular.vinculo==='Visitante')){
        return send(res,400,{error:'Um substituto temporário ou visitante não pode ser titular de outro substituto'});
      }
      if(titular && substitute && !canHaveSubstitute(titular)){
        return send(res,400,{error:'O docente titular só pode ter substituto durante afastamento para capacitação, cessão ou exercício de cargo de direção.'});
      }
      if(titular && substitute && Number(titular.id)===Number(substitute.id)){
        return send(res,400,{error:'Um docente não pode ser substituto de si mesmo'});
      }

      // A substitute must always have exactly one titular. A titular may have
      // zero or one substitute, but never more than one. Reject conflicting
      // associations instead of silently moving an existing relationship.
      if(substitute && substitute.substituteForId!=null && Number(substitute.substituteForId)!==Number(titular?.id)){
        return send(res,409,{error:'Este substituto já está associado a outro docente. Remova o vínculo atual antes de tentar uma nova associação.'});
      }
      if(titular && titular.substituteId!=null && Number(titular.substituteId)!==Number(substitute?.id)){
        return send(res,409,{error:'Este docente já possui outro substituto associado. Cada docente pode ter no máximo um substituto.'});
      }

      if(titular && substitute){
        titular.substituteId=Number(substitute.id);
        substitute.substituteForId=Number(titular.id);
      }else if(substitute && titularId==null){
        return send(res,400,{error:'O substituto temporário deve estar associado a um docente titular.'});
      }else if(titular && substituteId==null){
        if(titular.substituteId!=null){
          const old=db.teachers.find(s=>Number(s.id)===Number(titular.substituteId));
          if(old && Number(old.substituteForId)===Number(titular.id)) old.substituteForId=null;
          titular.substituteId=null;
        }
      }

      writeDB(db);
      return send(res,200,{ok:true,teacher:titular||substitute,substitute});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='DELETE'&&p==='/api/teacher'){
    if(authUser.role==='coordenador_curso')return send(res,403,{error:'Acesso restrito à direção.'});
    try{
      const db=readDB(),id=parsed.query.id,i=db.teachers.findIndex(t=>String(t.id)===String(id));
      if(i<0)return send(res,404,{error:'Docente não encontrado'});
      const teacher=db.teachers[i];
      db.teachers.forEach(t=>{
        if(Number(t.substituteId)===Number(teacher.id)) t.substituteId=null;
        if(Number(t.substituteForId)===Number(teacher.id)) t.substituteForId=null;
      });
      db.teachers.splice(i,1);
      writeDB(db);
      return send(res,200,{ok:true,teacher});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,PUT,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end()}
  return send(res,404,{error:'API não encontrada'});
}

const server=http.createServer(async(req,res)=>{
  if(req.url.startsWith('/api/'))return api(req,res);
  let pathname=decodeURIComponent(url.parse(req.url).pathname);
  if(pathname==='/'||pathname===''){
    const db=readDB();ensureAuthUsers(db);const user=userFromRequest(req,db);
    pathname=user?'/dashboard.html':'/login.html';
  }
  // Força atualização da página de Docentes após deploy. O navegador/proxy não deve
  // reaproveitar uma cópia antiga dessa tela, que depende do editor embutido.
  if(pathname==='/docentes.html' && !url.parse(req.url,true).query.v){
    res.writeHead(302,{'Location':'/docentes.html?v=1.0.110','Cache-Control':'no-store, no-cache, must-revalidate, proxy-revalidate','Pragma':'no-cache','Expires':'0'});
    return res.end();
  }
  // Arquivos estáticos (CSS/JS/imagens) não são páginas protegidas.
  // Antes, o middleware de autorização tratava style.css/app.js como páginas
  // e redirecionava esses requests para dashboard.html, quebrando a interface.
  const extname=path.extname(pathname).toLowerCase();
  const publicAssetExts=new Set(['.css','.js','.png','.jpg','.jpeg','.svg','.ico','.webp','.woff','.woff2','.ttf']);
  const isPublicAsset=publicAssetExts.has(extname);

  if(pathname!=='/login.html' && !isPublicAsset){
    const db=readDB();ensureAuthUsers(db);const user=userFromRequest(req,db);
    if(!user){res.writeHead(302,{Location:'/login.html?next='+encodeURIComponent(pathname)});return res.end();}
    const page=pathname.slice(1);
    if(!hasPageAccess(user,page,db)){res.writeHead(302,{Location:'/dashboard.html'});return res.end();}
  }
  const file=path.normalize(path.join(ROOT,pathname));
  if(!file.startsWith(ROOT))return send(res,403,{error:'Forbidden'});
  fs.stat(file,(err,st)=>{
    if(err||!st.isFile())return send(res,404,'Not found','text/plain; charset=utf-8');
    const ext=path.extname(file).toLowerCase();
    res.writeHead(200,{
      'Content-Type':MIME[ext]||'application/octet-stream',
      'Cache-Control':'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma':'no-cache',
      'Expires':'0',
      'X-ACHA-Version':'1.0.110'
    });
    fs.createReadStream(file).pipe(res)
  })
});

server.on('error',(err)=>{
  if(err.code==='EADDRINUSE'){
    console.error(`ERRO: a porta ${PORT} já está em uso. Feche o servidor ACHA anterior e tente novamente.`);
    process.exit(1);
  }
  console.error('ERRO ao iniciar o servidor:',err);
  process.exit(1);
});
(async()=>{
  const ready=await initializeDatabase();
  if(!ready){ process.exit(1); return; }
  server.listen(PORT,()=>console.log(`ACHA 1.0.110 — servidor: http://0.0.0.0:${PORT}`));
})();
