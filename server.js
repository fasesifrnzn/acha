const http=require('http');
const fs=require('fs');
const path=require('path');
const url=require('url');
const crypto=require('crypto');
const https=require('https');

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
  console.log('========== SUAP DEBUG ==========');
  console.log('Recebi access token no servidor:', !!accessToken);
  console.log('Prefixo do token:', accessToken ? String(accessToken).slice(0,15)+'...' : '(vazio)');

  // Rota oficial da API atual do SUAP para os dados do usuário autenticado.
  // Confirmada na documentação: GET /api/rh/meus-dados/
  const endpoint='/api/rh/meus-dados/';
  const headers={'Authorization':`Bearer ${accessToken}`,'Accept':'application/json'};
  console.log('Consultando SUAP:', endpoint);
  try{
    const result=await httpRequestJson('GET',`${SUAP_OAUTH.baseUrl}${endpoint}`,headers,'');
    console.log('SUAP respondeu com sucesso em:', endpoint);
    console.log('DADOS DO USUÁRIO SUAP:', JSON.stringify(result,null,2));
    console.log('Matrícula:', result?.matricula || result?.vinculo?.matricula || '(não informada)');
    console.log('Nome:', result?.nome_usual || result?.nome || result?.vinculo?.nome || '(não informado)');
    console.log('E-mail:', result?.email || '(não informado)');
    console.log('Campus:', result?.vinculo?.campus || '(não informado)');
    console.log('Cargo:', result?.vinculo?.cargo || '(não informado)');
    console.log('========== FIM SUAP DEBUG ==========');
    return result;
  }catch(e){
    console.log('SUAP falhou em:', endpoint);
    console.log('HTTP:', e.statusCode || '(sem status)');
    console.log('Erro:', e.message);
    console.log('========== FIM SUAP DEBUG ==========');
    throw e;
  }
}
function normalizePersonName(v){return String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ')}
function authUserPayload(db,user){
  const teacher=(db.teachers||[]).find(t=>String(t.id)===String(user.teacherId));
  return {id:user.id,teacherId:user.teacherId,displayName:user.displayName,role:user.role,matricula:teacher?.matricula||user.suapMatricula||'',coordinatorCourseId:teacher?.coordinatorCourseId||'',coordinatorCourseName:teacher?.coordinatorCourseName||'',photoData:user.photoData||'',suapPhotoUrl:user.suapPhotoUrl||'',suapLinked:!!user.suapUsername};
}

const ROOT=__dirname;
// In production, set DB_FILE to a path on persistent storage (e.g. /var/data/db.json).
// Locally, the database lives in ./data/db.json.
const DB_FILE=process.env.DB_FILE || path.join(ROOT,'data','db.json');
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
  'Direção-Geral':0
};

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
  'Afastamento capacitação (100%)':0
};
function normalizeRegime(value){const v=String(value??'').trim();if(!v)return '';if(/^40(?:h|\s*horas?)$/i.test(v))return '40';if(/^20(?:h|\s*horas?)$/i.test(v))return '20';return v}
function canHaveSubstitute(teacher){
  return /capacita[cç][aã]o/i.test(String(teacher?.leave||'')) ||
    /cess[aã]o/i.test(String(teacher?.leave||'')) ||
    /dire[cç][aã]o/i.test(String(teacher?.management||''));
}
function applyTeacherFactor(teacher){
  teacher.regime=normalizeRegime(teacher.regime);
  teacher.regimePct=Number.isFinite(Number(teacher.regimePct))?Number(teacher.regimePct):1;
  teacher.managementPct=MANAGEMENT_FACTORS[teacher.management]??1;
  teacher.leavePct=LEAVE_FACTORS[teacher.leave]??1;
  teacher.classFactor=Number((teacher.regimePct*teacher.managementPct*teacher.leavePct).toFixed(2));
  return teacher;
}
function readDB(){ensureDB();const db=JSON.parse(fs.readFileSync(DB_FILE,'utf8'));(db.teachers||[]).forEach(applyTeacherFactor);return db}

const ROLE_PERMISSIONS={
  diretor_geral:'all',
  diretoria_academica:'all',
  coordenador_curso:['dashboard.html','index.html','alocacao.html','matrizes.html','turmas.html']
};
const COORDINATOR_PAGES=new Set(ROLE_PERMISSIONS.coordenador_curso);
const sessions=new Map();
const suapStates=new Map();
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
function hasPageAccess(user,page){
  if(!user)return false;
  if(user.role==='diretor_geral'||user.role==='diretoria_academica')return true;
  return COORDINATOR_PAGES.has(page);
}
function coordinatorMatrixIds(db,user){
  const teacher=(db.teachers||[]).find(t=>String(t.id)===String(user.teacherId));
  const courseId=String(teacher?.coordinatorCourseId||'').trim();
  if(!courseId)return [];
  return (db.data?.courses||[]).filter(c=>String(c.course_id||'').trim()===courseId).map(c=>String(c.matrix));
}
function filterDbForUser(db,user){
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

function writeDB(db){
  ensureDB();
  const tmp=DB_FILE+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(db,null,2),'utf8');
  fs.renameSync(tmp,DB_FILE);
}
function send(res,status,data,type='application/json; charset=utf-8'){
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});
  res.end(typeof data==='string'?data:JSON.stringify(data));
}
function body(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>3e6)reject(new Error('payload too large'))});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(e)}});req.on('error',reject)})}

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
function classTurn(db,matrixId,period,seq){
  const t=db.turn?.[String(matrixId)]||{};
  const keys=Object.keys(t).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!keys.length) return 'A definir';
  const eligible=keys.filter(k=>k<=Number(period));
  const key=eligible.length?eligible[eligible.length-1]:keys[0];
  const arr=t[String(key)];
  if(Array.isArray(arr)&&arr.length) return arr[(Number(seq||1)-1)%arr.length];
  return 'A definir';
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
    realModelVersion:7,
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
    if(real && (Number(real.realModelVersion||0)<7 || (real.placements||[]).some(p=>Number(p.span||0)!==matrixDuration(db.data?.matrices?.[String(p.matrix)]||{})))){
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

async function api(req,res){
  const parsed=url.parse(req.url,true),p=parsed.pathname;
  if(req.method==='GET'&&p==='/api/health')return send(res,200,{ok:true,service:'acha',timestamp:new Date().toISOString()});

  if(p==='/api/profile' && req.method==='GET'){
    const db=readDB();ensureAuthUsers(db);const user=requireAuth(req,res,db);if(!user)return;
    return send(res,200,{ok:true,user:authUserPayload(db,user)});
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
      Object.assign(user,changes);writeDB(db);return send(res,200,{ok:true,user:authUserPayload(db,user)});
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
      console.log('========== SUAP CLIENT LOGIN ==========');
      console.log('POST /api/suap/client-login recebido');
      console.log('Token recebido:', !!accessToken, accessToken ? accessToken.slice(0,15)+'...' : '(vazio)');
      if(!accessToken)return send(res,400,{error:'Access token do SUAP não informado.'});
      if(accessToken.length>4096)return send(res,400,{error:'Access token inválido.'});

      const me=await suapUserRequest(accessToken);
      console.log('USUÁRIO RETORNADO AO CLIENT-LOGIN:', me);
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
      console.log('ACHA — usuário vinculado:', {
        achaUserId:user.id,
        teacherId:user.teacherId,
        nome: user.displayName,
        matricula: matricula,
        role: user.role,
        docenteEncontrado: !!linkedTeacher,
        docenteMatricula: linkedTeacher?.matricula || ''
      });
      writeDB(db);

      const sessionToken=crypto.randomBytes(32).toString('hex');
      sessions.set(sessionToken,{userId:user.id,expires:Date.now()+8*60*60*1000});
      res.setHeader('Set-Cookie',`pocv_session=${encodeURIComponent(sessionToken)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`);
      return send(res,200,{ok:true,user:authUserPayload(db,user)});
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
      return send(res,200,{ok:true,user:authUserPayload(db,user)});
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
    return send(res,200,{authenticated:true,user:authUserPayload(db,user)});
  }


  const dbForAuth=readDB();
  const authUser=requireAuth(req,res,dbForAuth);
  if(!authUser)return;

  // Apenas Diretor Geral e Diretoria Acadêmica podem acessar as áreas administrativas.
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

  if(req.method==='GET'&&p==='/api/db'){const db=readDB(),user=requireAuth(req,res,db);if(!user)return;res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.setHeader('Pragma','no-cache');return send(res,200,filterDbForUser(db,user));}
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
      if(authUser.role==='coordenador_curso'){const cid=String((db.teachers||[]).find(t=>String(t.id)===String(authUser.teacherId))?.coordinatorCourseId||'');if(String(x.course||'')!==cid)return send(res,403,{error:'A demanda deve pertencer ao curso coordenado.'});}
      db.extraOffers??={}; db.extraOffers[x.semester]??=[];
      const id=Math.max(0,...db.extraOffers[x.semester].map(v=>Number(v.id)||0))+1;
      const item={id,name:String(x.name).trim(),ch:Number(x.ch)||0,group:String(x.group||'').trim(),course:String(x.course||'').trim(),type:String(x.type||'Dependência').trim(),turn:String(x.turn||'').trim(),notes:String(x.notes||'').trim(),createdAt:new Date().toISOString()};
      db.extraOffers[x.semester].push(item); writeDB(db); return send(res,201,{ok:true,offer:item});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='PUT'&&p==='/api/extra-offer'){
    try{
      const x=await body(req); const db=readDB(); const arr=db.extraOffers?.[x.semester]||[]; const i=arr.findIndex(v=>String(v.id)===String(x.id));
      if(i<0)return send(res,404,{error:'Demanda avulsa não encontrada'}); arr[i]=Object.assign({},arr[i],x.changes||{}); writeDB(db); return send(res,200,{ok:true,offer:arr[i]});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='DELETE'&&p==='/api/extra-offer'){
    try{const semester=parsed.query.semester,id=parsed.query.id; const db=readDB(); if(db.extraOffers?.[semester]) db.extraOffers[semester]=db.extraOffers[semester].filter(v=>String(v.id)!==String(id)); writeDB(db); return send(res,200,{ok:true})}catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='PUT'&&p==='/api/offer'){
    try{
      const x=await body(req);if(!x.semester||!x.key||!x.changes)return send(res,400,{error:'Dados inválidos'});
      const db=readDB();
      if(authUser.role==='coordenador_curso' && !coordinatorMatrixIds(db,authUser).includes(String(x.key).split('|')[0]))return send(res,403,{error:'Oferta fora do curso coordenado.'});
      db.offers??={};db.offers[x.semester]??={};
      const current=db.offers[x.semester][x.key]||{};const next=Object.assign({},current,x.changes);
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
      if(authUser.role==='coordenador_curso' && !coordinatorMatrixIds(db,authUser).includes(String(key).split('|')[0]))return send(res,403,{error:'Oferta fora do curso coordenado.'});
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
    if(!hasPageAccess(user,page)){res.writeHead(302,{Location:'/dashboard.html'});return res.end();}
  }
  const file=path.normalize(path.join(ROOT,pathname));
  if(!file.startsWith(ROOT))return send(res,403,{error:'Forbidden'});
  fs.stat(file,(err,st)=>{if(err||!st.isFile())return send(res,404,'Not found','text/plain; charset=utf-8');const ext=path.extname(file).toLowerCase();res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'});fs.createReadStream(file).pipe(res)})
});

server.on('error',(err)=>{
  if(err.code==='EADDRINUSE'){
    console.error(`ERRO: a porta ${PORT} já está em uso. Feche o servidor ACHA anterior e tente novamente.`);
    process.exit(1);
  }
  console.error('ERRO ao iniciar o servidor:',err);
  process.exit(1);
});
server.listen(PORT,()=>console.log(`ACHA V75 — servidor: http://localhost:${PORT}`));
