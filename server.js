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
    const legacy=path.join(ROOT,'db.json');
    if(fs.existsSync(legacy))fs.copyFileSync(legacy,DB_FILE);
    else throw new Error(`Banco de dados não encontrado: ${DB_FILE}`);
  }
}
function readDB(){ensureDB();return JSON.parse(fs.readFileSync(DB_FILE,'utf8'))}
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
  const p=url.parse(req.url).pathname;
  if(req.method==='GET'&&p==='/api/db')return send(res,200,readDB());
  if(req.method==='PUT'&&p==='/api/offer'){
    try{const x=await body(req);if(!x.semester||!x.key||!x.changes)return send(res,400,{error:'Dados inválidos'});const db=readDB();db.offers??={};db.offers[x.semester]??={};db.offers[x.semester][x.key]=Object.assign(db.offers[x.semester][x.key]||{},x.changes);writeDB(db);return send(res,200,{ok:true})}catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='PUT'&&p==='/api/teacher'){
    try{const x=await body(req);const db=readDB();const i=db.teachers.findIndex(t=>String(t.id)===String(x.id));if(i<0)return send(res,404,{error:'Docente não encontrado'});db.teachers[i]=Object.assign(db.teachers[i],x.changes||{});writeDB(db);return send(res,200,{ok:true,teacher:db.teachers[i]})}catch(e){return send(res,500,{error:e.message})}
  }
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,PUT,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end()}
  return send(res,404,{error:'API não encontrada'});
}

const server=http.createServer(async(req,res)=>{
  if(req.url.startsWith('/api/'))return api(req,res);
  let pathname=decodeURIComponent(url.parse(req.url).pathname);if(pathname==='/'||pathname==='')pathname='/index.html';
  const file=path.normalize(path.join(ROOT,pathname));
  if(!file.startsWith(ROOT))return send(res,403,{error:'Forbidden'});
  fs.stat(file,(err,st)=>{if(err||!st.isFile())return send(res,404,'Not found','text/plain; charset=utf-8');const ext=path.extname(file).toLowerCase();res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'});fs.createReadStream(file).pipe(res)})
});

server.listen(PORT,()=>console.log(`Oferta IFRN: http://localhost:${PORT}`));
