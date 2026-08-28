const http=require('http');
const fs=require('fs');
const path=require('path');
const url=require('url');

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
async function api(req,res){
  const parsed=url.parse(req.url,true),p=parsed.pathname;
  if(req.method==='GET'&&p==='/api/health')return send(res,200,{ok:true,service:'pocv',timestamp:new Date().toISOString()});
  if(req.method==='GET'&&p==='/api/db')return send(res,200,readDB());
  if(req.method==='POST'&&p==='/api/extra-offer'){
    try{
      const x=await body(req); if(!x.semester||!String(x.name||'').trim()) return send(res,400,{error:'Semestre e disciplina são obrigatórios'});
      const db=readDB(); db.extraOffers??={}; db.extraOffers[x.semester]??=[];
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
      const db=readDB();db.offers??={};db.offers[x.semester]??={};
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
      if(db.offers?.[semester] && Object.prototype.hasOwnProperty.call(db.offers[semester],key)){
        delete db.offers[semester][key];
        writeDB(db);
      }
      return send(res,200,{ok:true});
    }catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='PUT'&&p==='/api/teacher'){
    try{
      const x=await body(req),db=readDB();
      const i=db.teachers.findIndex(t=>String(t.id)===String(x.id));
      if(i<0)return send(res,404,{error:'Docente não encontrado'});
      const teacher=db.teachers[i],changes=x.changes||{};
      const oldVinculo=teacher.vinculo;
      const newVinculo=changes.vinculo===undefined?oldVinculo:changes.vinculo;

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
    try{
      const x=await body(req);
      if(!String(x.name||'').trim())return send(res,400,{error:'Informe o nome do docente'});
      const db=readDB();
      const vinculo=x.vinculo||'Efetivo';
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
  let pathname=decodeURIComponent(url.parse(req.url).pathname);if(pathname==='/'||pathname==='')pathname='/dashboard.html';
  const file=path.normalize(path.join(ROOT,pathname));
  if(!file.startsWith(ROOT))return send(res,403,{error:'Forbidden'});
  fs.stat(file,(err,st)=>{if(err||!st.isFile())return send(res,404,'Not found','text/plain; charset=utf-8');const ext=path.extname(file).toLowerCase();res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'});fs.createReadStream(file).pipe(res)})
});

server.listen(PORT,()=>console.log(`Oferta IFRN: http://localhost:${PORT}`));
