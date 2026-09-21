(function(){
  // Modo de teste: Direção pode simular perfis acadêmicos sem alterar a sessão real.
  const PREVIEW_KEY='acha_preview_academic';
  const PREVIEW_TYPE_KEY='acha_preview_type';
  const PREVIEW_ID_KEY='acha_preview_id';
  const nativeFetch=window.fetch.bind(window);
  const previewEnabled=()=>localStorage.getItem(PREVIEW_KEY)==='1';
  const isDirectionRole=r=>['diretor_geral','diretoria_academica'].includes(r);
  const coordinatorAccess={version:1,pages:{'dashboard.html':'edit','index.html':'edit','alocacao.html':'edit','matrizes.html':'edit','turmas.html':'edit','demandas.html':'edit','perfil.html':'edit','notificacoes.html':'edit'},semesterFrom:'2026.1',semesterTo:'2030.2',features:{'oferta.previsao':false}};
  const areaAccess={version:1,pages:{'dashboard.html':'view','index.html':'view','alocacao.html':'view','matrizes.html':'view','turmas.html':'view','perfil.html':'view','notificacoes.html':'view'},semesterFrom:'2024.1',semesterTo:'2034.2',features:{'oferta.previsao':false}};
  const previewTarget=()=>({type:localStorage.getItem(PREVIEW_TYPE_KEY)||'course',id:localStorage.getItem(PREVIEW_ID_KEY)||''});
  function filterPreviewDb(db,target){
    const out=JSON.parse(JSON.stringify(db||{}));
    // No modo de teste, preserve SEMPRE as chaves originais das ofertas.
    // A tela pode filtrar disciplinas/grupos, mas nunca deve remapear o índice
    // da disciplina, pois esse índice é parte da identidade persistida da oferta.
    out.__previewOfferKeyMap={};
    const teachers=db?.teachers||[];
    const cloneSemesters=(allowedMatrices)=>{
      out.data=out.data||{};
      out.data.semesters={};
      Object.entries(db.data?.semesters||{}).forEach(([sem,rows])=>{
        const filtered=(rows||[]).filter(r=>allowedMatrices.has(String(r.matrix)));
        if(filtered.length) out.data.semesters[sem]=filtered;
      });
    };
    const cloneOffers=(predicate)=>{
      out.offers={};
      Object.entries(db.offers||{}).forEach(([sem,rows])=>{
        const rr={};
        Object.entries(rows||{}).forEach(([key,val])=>{
          if(predicate(key,val)) { rr[key]=val; out.__previewOfferKeyMap[key]=key; }
        });
        if(Object.keys(rr).length) out.offers[sem]=rr;
      });
    };
    if(target.type==='area'){
      const area=String(target.id||'').trim();
      const groups=new Set((db?.pedagogicalAreaResponsibilities?.[area]?.groups||[]).map(x=>String(x).trim()).filter(Boolean));
      const areaTeacher=teachers.find(t=>String(t.managementArea||'').trim()===area);
      out.data=out.data||{}; out.data.courses=[]; out.data.matrices={};
      const allowedMatrices=new Set();
      for(const [id,m] of Object.entries(db.data?.matrices||{})){
        const disciplines=(m?.disciplines||[]).filter(d=>groups.has(String(d?.group||'').trim()));
        if(!disciplines.length) continue;
        // Preserva os índices originais: cria um array esparso com o mesmo length.
        const sparse=new Array((m?.disciplines||[]).length);
        (m?.disciplines||[]).forEach((d,i)=>{if(groups.has(String(d?.group||'').trim())) sparse[i]=d;});
        out.data.matrices[id]={...m,disciplines:sparse};
        allowedMatrices.add(String(id));
      }
      out.data.courses=(db.data?.courses||[]).filter(c=>allowedMatrices.has(String(c.matrix)));
      cloneSemesters(allowedMatrices);
      out.turn={}; allowedMatrices.forEach(id=>{if(db.turn?.[id])out.turn[id]=db.turn[id]});
      out.teachers=teachers.filter(t=>groups.has(String(t.group||'').trim())||String(t.id)===String(areaTeacher?.id||''));
      cloneOffers((key)=>{const p=String(key).split('|'); if(!allowedMatrices.has(p[0]))return false; const di=Number(String(p[3]||'').split('::')[0]); const d=db.data?.matrices?.[p[0]]?.disciplines?.[di]; return !!d&&groups.has(String(d.group||'').trim());});
      out.extraOffers={};Object.entries(db.extraOffers||{}).forEach(([sem,rows])=>{const rr=(rows||[]).filter(v=>groups.has(String(v?.group||'').trim()));if(rr.length)out.extraOffers[sem]=rr;});
      out.pocvScenarios=[];out.authUsers=[];out.authUser={id:areaTeacher?.id?`preview-area-${areaTeacher.id}`:'preview-area',teacherId:areaTeacher?.id||'',displayName:areaTeacher?.name||area,role:'coordenador_area',managementArea:area,distributionGroups:[...groups]};
      return out;
    }
    const courseId=String(target.id||'').trim();
    const ids=new Set((db.data?.courses||[]).filter(c=>String(c.course_id||'').trim()===courseId).map(c=>String(c.matrix)));
    out.data=out.data||{};out.data.courses=(db.data?.courses||[]).filter(c=>ids.has(String(c.matrix)));out.data.matrices={};ids.forEach(id=>{if(db.data?.matrices?.[id])out.data.matrices[id]=db.data.matrices[id]});
    cloneSemesters(ids);out.turn={};ids.forEach(id=>{if(db.turn?.[id])out.turn[id]=db.turn[id]});
    const groups=new Set();Object.values(out.data.matrices).forEach(m=>(m.disciplines||[]).forEach(d=>{if(d?.group)groups.add(String(d.group).trim())}));out.teachers=teachers.filter(t=>groups.has(String(t.group||'').trim()));
    cloneOffers((key)=>ids.has(String(key).split('|')[0]));
    out.extraOffers={};Object.entries(db.extraOffers||{}).forEach(([sem,rows])=>{out.extraOffers[sem]=(rows||[]).filter(v=>{const course=String(v.course||'').trim();return !course||ids.has(String((db.data?.courses||[]).find(c=>String(c.course_id||'')===course)?.matrix))})});out.pocvScenarios=[];return out;
  }

  window.fetch=function(input,init){
    const url=typeof input==='string'?input:(input?.url||'');
    if(previewEnabled()){
      const target=previewTarget();
      const headers=new Headers(init?.headers||{});
      headers.set('X-ACHA-Preview','director');
      headers.set('X-ACHA-Preview-Role',target.type==='area'?'coordenador_area':'coordenador_curso');
      init={...(init||{}),headers};
    }
    if(previewEnabled() && /\/api\/session(?:\?|$)/.test(url)) return nativeFetch(input,init).then(async response=>{
      if(!response.ok)return response; const payload=await response.clone().json().catch(()=>null); if(!payload?.authenticated||!isDirectionRole(payload.user?.role))return response;
      const target=previewTarget(); let db=null; try{db=await nativeFetch('/api/db',{cache:'no-store'}).then(r=>r.json())}catch(e){}
      const area=target.type==='area', areaName=area?String(target.id||''):''; const areaTeacher=(db?.teachers||[]).find(t=>String(t.managementArea||'').trim()===areaName);
      const user=area?{...payload.user,role:'coordenador_area',coordinatorCourseId:'',coordinatorCourseName:'',managementArea:areaName,distributionGroups:[...(db?.pedagogicalAreaResponsibilities?.[areaName]?.groups||areaTeacher?.distributionGroups||[])]}:{...payload.user,role:'coordenador_curso',coordinatorCourseId:String(target.id||'')};
      const configuredAccess=db?.accessControl?.profiles?.[area?'coordenador_area':'coordenador_curso'];
      const previewAccess=configuredAccess?JSON.parse(JSON.stringify(configuredAccess)):(area?areaAccess:coordinatorAccess);
      return new Response(JSON.stringify({...payload,user,access:previewAccess,__preview:true,__realRole:payload.user.role,__previewType:target.type}),{status:200,headers:{'Content-Type':'application/json'}});
    });
    if(previewEnabled() && /\/api\/db(?:\?|$)/.test(url)) return nativeFetch(input,init).then(async response=>{if(!response.ok)return response;const db=await response.clone().json().catch(()=>null);if(!db)return response;return new Response(JSON.stringify(filterPreviewDb(db,previewTarget())),{status:response.status,headers:{'Content-Type':'application/json'}})});
    return nativeFetch(input,init);
  };
  const navGroups=[
    {label:'Operação',items:[['dashboard.html','home','Início'],['index.html','clipboard','Oferta'],['alocacao.html','teacher','Alocação'],['turmas.html','users','Turmas']]},
    {label:'Planejamento',items:[['pocv.html','timeline','Cenários'],['projecao-cenario.html','timeline','Projeção'],['indicadores.html','chart','Indicadores'],['matrizes.html','book','Matrizes']]},
    {label:'Cadastros',items:[['docentes.html','person','Docentes'],['grupos.html','tag','Grupos'],['regras.html','gear','Regras'],['variaveis.html','gear','Variáveis']]},
    {label:'Acompanhamento',items:[['demandas.html','note','Demandas avulsas'],['pendencias.html','note','Pendências']]},
    {label:'Sistema',items:[['backup.html','download','Backup'],['acessos.html','gear','Acessos'],['perfil.html','person','Meu perfil']]}
  ];
  const navItems=navGroups.flatMap(g=>g.items);
  const iconSvg={
    home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.8 12 3l9 7.8v9.2a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    clipboard:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l1 2h3a1 1 0 0 1 1 1v13H4V7a1 1 0 0 1 1-1h3zm0 0a3 3 0 0 1 6 0M8 11h8M8 15h8M8 19h5"/></svg>',
    teacher:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 10 0v2M15 5h5M17.5 3v5M16 14h5v6h-5z"/></svg>',
    chart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 5-7"/></svg>',
    book:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13M8 7h7M8 11h7"/></svg>',
    users:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M15 18a4 4 0 0 1 6 0v2"/></svg>',
    person:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>',
    tag:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11V5a2 2 0 0 1 2-2h6l10 10-6 6L5 9z"/><circle cx="8" cy="7" r="1"/></svg>',
    gear:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.7 3 .7 2a7.8 7.8 0 0 1 3.2 0l.7-2 2.2.9-.7 2a8 8 0 0 1 2.3 2.3l2-.7.9 2.2-2 .7a7.8 7.8 0 0 1 0 3.2l2 .7-.9 2.2-2-.7a8 8 0 0 1-2.3 2.3l.7 2-2.2.9-.7-2a7.8 7.8 0 0 1-3.2 0l-.7 2-2.2-.9.7-2a8 8 0 0 1-2.3-2.3l-2 .7-.9-2.2 2-.7a7.8 7.8 0 0 1 0-3.2l-2-.7.9-2.2 2 .7A8 8 0 0 1 8.2 6l-.7-2z"/><circle cx="12" cy="12" r="2.8"/></svg>',
    timeline:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16"/><path d="M7 3v4M12 10v4M17 17v4"/></svg>',
    note:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/></svg>',
    bell:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h16c0-2-3-2-3-9M10 21h4"/></svg>',
    download:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/></svg>'
  };
  const palette=[
    ['#e0f2fe','#075985','#bae6fd'],['#dcfce7','#166534','#bbf7d0'],['#fef3c7','#92400e','#fde68a'],['#fce7f3','#9d174d','#fbcfe8'],
    ['#ede9fe','#5b21b6','#ddd6fe'],['#cffafe','#155e75','#a5f3fc'],['#ffedd5','#9a3412','#fed7aa'],['#f3e8ff','#7e22ce','#e9d5ff'],
    ['#ecfccb','#3f6212','#d9f99d'],['#e2e8f0','#334155','#cbd5e1'],['#dbeafe','#1d4ed8','#bfdbfe'],['#ccfbf1','#115e59','#99f6e4'],
    ['#fae8ff','#86198f','#f5d0fe'],['#fee2e2','#991b1b','#fecaca'],['#f0fdf4','#166534','#bbf7d0'],['#fefce8','#854d0e','#fef08a'],
    ['#eff6ff','#1e40af','#bfdbfe'],['#ecfdf5','#065f46','#a7f3d0'],['#fff7ed','#9a3412','#fed7aa'],['#f5f3ff','#6d28d9','#ddd6fe'],
    ['#f0fdfa','#0f766e','#99f6e4'],['#fdf2f8','#9d174d','#fbcfe8'],['#f8fafc','#334155','#cbd5e1'],['#fef2f2','#b91c1c','#fecaca'],
    ['#eef2ff','#4338ca','#c7d2fe'],['#ecfeff','#0e7490','#a5f3fc'],['#f7fee7','#4d7c0f','#d9f99d'],['#fff1f2','#be123c','#fecdd3']
  ];
  const norm=v=>String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const uniquePalette=[...new Map(palette.map(p=>[p[0],p])).values()]; let groups=[],courses=[];
  function setUnique(list){return [...new Set(list.map(x=>String(x??'').trim()).filter(Boolean))].sort((a,b)=>norm(a).localeCompare(norm(b),'pt-BR',{numeric:true}));}
  function setGroups(list){groups=setUnique(list); return groups;}
  function setCourses(list){courses=setUnique(list); return courses;}
  function color(name,type='group'){
    const list=type==='course'?courses:groups;
    const key=norm(name);
    let idx=0; for(const c of key) idx=(idx*31+c.charCodeAt(0))>>>0;
    idx%=uniquePalette.length;
    const used=new Set();
    for(const item of list){
      const k=norm(item); if(k===key) break;
      let base=0; for(const c of k) base=(base*31+c.charCodeAt(0))>>>0;
      used.add(base%uniquePalette.length);
    }
    let guard=0;
    while(used.has(idx) && guard<uniquePalette.length){idx=(idx+1)%uniquePalette.length;guard++}
    const p=uniquePalette[idx];
    return {bg:p[0],fg:p[1],border:p[2],index:idx};
  }
  function tag(name,type='group'){
    const text=String(name??'').trim() || '—'; const c=color(text,type);
    return `<span class="pocv-tag ${type==='course'?'course-tag':'group-tag'}" style="--tag-bg:${c.bg};--tag-fg:${c.fg};--tag-border:${c.border}" title="${esc(text)}">${esc(text)}</span>`;
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function courseRecord(coursesSource,matrixId){
    if(Array.isArray(coursesSource)){
      return coursesSource.find(x=>String(x?.matrix)===String(matrixId))||null;
    }
    return coursesSource?.[String(matrixId)]||null;
  }
  function courseName(coursesSource,matrixId){
    const found=courseRecord(coursesSource,matrixId);
    return String(found?.course_name||found?.name||'').trim();
  }
  function courseId(coursesSource,matrixId){
    const found=courseRecord(coursesSource,matrixId);
    return String(found?.course_id||'').trim();
  }
  // Determina o turno efetivo de uma turma. As regras de turno são definidas
  // por período, mas nem todo período precisa repetir a regra: quando não há
  // uma chave exata, vale a última regra anterior. Para matrizes antigas sem
  // configuração própria (ex.: 1, 8, 12 e 19), usa-se a configuração da matriz
  // mais recente do mesmo curso, evitando "A definir" quando a regra do curso
  // está cadastrada em uma matriz vigente.
  function turnForClass(db,matrixId,period,seq=1){
    const source=db||{};
    const turns=source.turn||{};
    const findTurn=(id)=>{
      const t=turns?.[String(id)]||{};
      const keys=Object.keys(t).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
      if(!keys.length)return null;
      const p=Number(period);
      const eligible=keys.filter(k=>k<=p);
      const key=eligible.length?eligible[eligible.length-1]:keys[0];
      const arr=t[String(key)];
      return Array.isArray(arr)&&arr.length?arr[(Math.max(1,Number(seq)||1)-1)%arr.length]:null;
    };
    const direct=findTurn(matrixId);
    if(direct)return direct;
    const cid=courseId(source?.data?.courses||[],matrixId);
    if(!cid)return 'A definir';
    const ids=Object.keys(source?.data?.matrices||{}).filter(id=>courseId(source.data.courses,id)===cid&&turns?.[String(id)]);
    ids.sort((a,b)=>Number(b)-Number(a));
    for(const id of ids){const v=findTurn(id);if(v)return v;}
    return 'A definir';
  }
  function groupKey(v){
    // Identidade lógica do grupo: ignora maiúsculas/minúsculas,
    // acentos e espaços excedentes, sem alterar o nome exibido.
    return norm(v).replace(/\\s+/g,' ');
  }
  window.POCV={norm,groupKey,esc,setGroups,setCourses,color,tag,palette:uniquePalette,courseRecord,courseName,courseId,turnForClass};
  let accessSession=null;
  function applyAccessUi(session){
    accessSession=session;
    const page=location.pathname.split('/').pop()||'dashboard.html';
    const level=(session?.access?.pages?.[page]||'none');
    document.body.dataset.accessLevel=level;
    document.body.classList.toggle('access-view-only',level==='view');
    if(level!=='view')return;
    const selectors={
      'index.html':['#newDemandBtn','.edit-row','.delete-row','.row-actions','#saveEdit','#saveOptionalChoices','#saveDemand','#addOptionalChoice','.coordinator-batch','#batchConfirmOffers','#clearOfferSelection','#selectAllOffers','#headerSelectOffers','.coordinator-only-col'],
      'matrizes.html':['#newBtn','#saveBtn','#addOptionalCatalogBtn','#addDisciplineBtn','.optional-catalog-remove','.period-remove','.period-add','.row-remove'],
      'docentes.html':['#addTeacher','.edit-teacher','.delete-teacher','#deleteTeacher','#saveEdit','.add-substitute'],
      'grupos.html':['.teacher-edit'],
      'variaveis.html':['#save'],
      'pocv.html':['#newBtn','#cloneBtn','#realBtn','#deleteBtn','#variablesBtn','#saveBtn','#syncRealBtn','#clearBtn','#addScenarioOfferBtn','.mini.edit','.mini.remove','.remove-offer-row','.remove-course-from'],
      'demandas.html':['#add','.edit','.delete']
    };
    (selectors[page]||[]).forEach(sel=>document.querySelectorAll(sel).forEach(el=>{el.hidden=true;el.setAttribute('aria-hidden','true')}));
    if(page==='index.html')document.querySelectorAll('.group-cell').forEach(el=>el.style.pointerEvents='none');
  }
  function installAccessGuard(){
    document.addEventListener('click',e=>{if(document.body.dataset.accessLevel!=='view')return;const b=e.target.closest('.edit,.delete,.edit-row,.delete-row,.edit-teacher,.delete-teacher,.teacher-edit,.row-remove,.period-add,.period-remove,[data-remove-row],[data-remove-optional],#newDemandBtn,#add,#save,#saveBtn,#saveEdit,#saveDemand,#saveOptionalChoices,#addDisciplineBtn,#addOptionalCatalogBtn,#addTeacher,#deleteTeacher,#newBtn,#cloneBtn,#realBtn,#variablesBtn,#clearBtn,#syncRealBtn,#addScenarioOfferBtn');if(b){e.preventDefault();e.stopImmediatePropagation();return;}if(location.pathname.endsWith('/index.html')&&e.target.closest('.group-cell,.discipline-cell')){e.preventDefault();e.stopImmediatePropagation();}if(location.pathname.endsWith('/matrizes.html')&&e.target.closest('tr[data-id]')){e.preventDefault();e.stopImmediatePropagation();}if(location.pathname.endsWith('/docentes.html')&&e.target.closest('tr[data-id]')){e.preventDefault();e.stopImmediatePropagation();}},true);
    document.addEventListener('dblclick',e=>{if(document.body.dataset.accessLevel==='view'){e.preventDefault();e.stopImmediatePropagation();}},true);
  }
  async function setupSidebar(){
    const old=document.querySelector('.mainnav'); if(!old)return;
    let session=null;
    try{const r=await fetch('/api/session',{cache:'no-store'});if(r.ok)session=await r.json()}catch(e){}
    applyAccessUi(session);
    const currentPage=location.pathname.split('/').pop()||'dashboard.html';
    if(session?.__preview && isDirectionRole(session?.__realRole) && session?.access?.pages?.[currentPage]==='none'){
      location.replace('dashboard.html');
      return;
    }
    const coordinatorOnly=new Set(['dashboard.html','index.html','alocacao.html','matrizes.html','turmas.html']);
    const isDirector=isDirectionRole(session?.user?.role)||isDirectionRole(session?.__realRole);
    const previewTargetNow=previewTarget();
    const previewSwitch=isDirector?`<div class="preview-selector" id="coordinatorPreviewSelector"><label for="coordinatorPreviewSelect">Visualizar como</label><select id="coordinatorPreviewSelect" aria-label="Escolher perfil para visualização de teste"><option value="">Direção</option></select></div>`:'';
    const previewPages=new Set(['dashboard.html','index.html','alocacao.html','matrizes.html','turmas.html','demandas.html','perfil.html','notificacoes.html']);
    const visible=navItems.filter(([href])=>{if(!session?.user)return false;if(session?.__preview){return previewPages.has(href);}if(href==='acessos.html'||href==='pendencias.html')return isDirectionRole(session.user.role);const access=session.access?.pages?.[href];if(access!==undefined)return access!=='none';return session.user.role!=='coordenador_curso'&&!['coordenador_area'].includes(session.user.role)||coordinatorOnly.has(href)});
    const visibleSet=new Set(visible.map(x=>x[0]));
    const groupsHtml=navGroups.map(g=>{const items=g.items.filter(([href])=>visibleSet.has(href));if(!items.length)return '';return `<div class="nav-section"><div class="nav-section-title">${g.label}</div>${items.map(([href,icon,label])=>`<a href="${href}" title="${label}" aria-label="${label}"><span class="nav-icon">${iconSvg[icon]}</span><span class="nav-label">${label}</span></a>`).join('')}</div>`}).join('');
    old.innerHTML=`<div class="sidebar-brand"><span class="sidebar-logo"><img src="acha-logo.svg" alt="ACHA"></span><span class="sidebar-title">ACHA</span><button type="button" class="sidebar-toggle" aria-label="Recolher menu" title="Recolher menu"><span class="toggle-glyph">‹</span></button></div>${previewSwitch}<div class="sidebar-scroll">${groupsHtml}</div>`+(session?.user?`<div class="sidebar-user" title="${esc(session.user.displayName)}"><a href="perfil.html" class="sidebar-profile-link"><span class="sidebar-user-name">${esc(session.user.displayName.split(' ')[0])}</span><small>Meu perfil</small></a><button type="button" class="sidebar-logout" id="pocvLogout">Sair</button></div>`:'')+`<a class="top-notification-link" href="notificacoes.html" title="Notificações" aria-label="Notificações"><span class="top-bell">${iconSvg.bell}</span><span class="top-notification-badge" hidden>0</span></a>`;
    old.classList.add('pocv-sidebar');
    const current=location.pathname.split('/').pop()||'dashboard.html';old.querySelectorAll('a').forEach(a=>{if(a.getAttribute('href')===current)a.classList.add('active')});
    document.querySelectorAll('.acha-mobile-topbar,.acha-mobile-backdrop').forEach(el=>el.remove());
    const pageLabel=(navItems.find(x=>x[0]===current)||[])[2]||document.title.replace(/^ACHA\s*[—-]\s*/,'')||'ACHA';
    const top=document.createElement('div');top.className='acha-mobile-topbar';top.innerHTML=`<button type="button" class="mobile-menu-btn" aria-label="Abrir menu">☰</button><div class="mobile-brand"><img src="acha-logo.svg" alt="ACHA"><strong>ACHA</strong><span>${esc(pageLabel)}</span></div><a class="mobile-bell" href="notificacoes.html" aria-label="Notificações">${iconSvg.bell}<span class="mobile-badge" hidden>0</span></a>`;
    const backdrop=document.createElement('div');backdrop.className='acha-mobile-backdrop';document.body.append(top,backdrop);
    const menuBtn=top.querySelector('.mobile-menu-btn');const setMobileOpen=open=>{document.body.classList.toggle('mobile-nav-open',open);menuBtn.setAttribute('aria-expanded',open?'true':'false')};menuBtn.onclick=()=>setMobileOpen(!document.body.classList.contains('mobile-nav-open'));backdrop.onclick=()=>setMobileOpen(false);old.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMobileOpen(false)));
    const previewSelect=document.getElementById('coordinatorPreviewSelect');
    if(previewSelect&&isDirector){
      try{
        const db=await nativeFetch('/api/db',{cache:'no-store'}).then(r=>r.json());
        const courses=new Map();(db.teachers||[]).filter(t=>String(t.management||'')==='Coordenação de Curso'&&t.coordinatorCourseId).forEach(t=>{const id=String(t.coordinatorCourseId).trim();if(id&&!courses.has(id))courses.set(id,String(t.coordinatorCourseName||id).trim())});
        const areas=Object.keys(db.pedagogicalAreaResponsibilities||{}).sort((a,b)=>norm(a).localeCompare(norm(b),'pt-BR'));
        previewSelect.innerHTML='<option value="">Direção</option>';
        const ogc=document.createElement('optgroup');ogc.label='Coordenadores de Curso';[...courses.entries()].sort((a,b)=>norm(a[1]).localeCompare(norm(b[1]),'pt-BR',{numeric:true})).forEach(([id,name])=>{const o=document.createElement('option');o.value=`course:${id}`;o.textContent=name;ogc.appendChild(o)});previewSelect.appendChild(ogc);
        const oga=document.createElement('optgroup');oga.label='Coordenação de Área';areas.forEach(area=>{const o=document.createElement('option');o.value=`area:${area}`;const teacher=(db.teachers||[]).find(t=>String(t.managementArea||'').trim()===area);o.textContent=teacher?.name?`${area} — ${teacher.name}`:area;oga.appendChild(o)});previewSelect.appendChild(oga);
        previewSelect.value=previewEnabled()?`${previewTargetNow.type}:${previewTargetNow.id}`:'';
        previewSelect.onchange=()=>{const value=String(previewSelect.value||'');if(!value){localStorage.removeItem(PREVIEW_KEY);localStorage.removeItem(PREVIEW_TYPE_KEY);localStorage.removeItem(PREVIEW_ID_KEY);location.href='dashboard.html';return;}const i=value.indexOf(':');localStorage.setItem(PREVIEW_TYPE_KEY,value.slice(0,i));localStorage.setItem(PREVIEW_ID_KEY,value.slice(i+1));localStorage.setItem(PREVIEW_KEY,'1');location.reload()};
      }catch(e){previewSelect.innerHTML='<option value="">Direção</option><option value="" disabled>Perfis indisponíveis</option>'}
    }
    const mobileBell=top.querySelector('.mobile-bell');const syncMobileBadge=()=>{const b=old.querySelector('.top-notification-badge'),m=top.querySelector('.mobile-badge');if(b&&m){m.hidden=b.hidden;m.textContent=b.textContent}};
    if(session?.user){fetch('/api/notifications?unread=1',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{const n=Number(j?.unread||0),b=old.querySelector('.top-notification-badge');if(b){b.hidden=!n;b.textContent=n>99?'99+':n;syncMobileBadge()}}).catch(()=>{})}else syncMobileBadge();
    const toggle=old.querySelector('.sidebar-toggle');const applySidebarState=collapsed=>{document.body.classList.toggle('sidebar-collapsed',collapsed);localStorage.setItem('pocv_sidebar_collapsed',collapsed?'1':'0');toggle.querySelector('.toggle-glyph').textContent=collapsed?'›':'‹';toggle.setAttribute('aria-label',collapsed?'Expandir menu':'Recolher menu');toggle.title=collapsed?'Expandir menu':'Recolher menu'};applySidebarState(localStorage.getItem('pocv_sidebar_collapsed')==='1');toggle.onclick=()=>applySidebarState(!document.body.classList.contains('sidebar-collapsed'));
    const logout=document.getElementById('pocvLogout');if(logout)logout.onclick=async()=>{try{await fetch('/api/logout',{method:'POST'})}finally{location.href='/login.html'}};
  }
  function setupTags(){
    document.querySelectorAll('[data-pocv-group]').forEach(el=>{el.outerHTML=tag(el.dataset.pocvGroup,'group')});
    document.querySelectorAll('[data-pocv-course]').forEach(el=>{el.outerHTML=tag(el.dataset.pocvCourse,'course')});
  }
  function setupFooter(){
    if(document.querySelector('.acha-footer')) return;
    const f=document.createElement('footer');
    f.className='acha-footer';
    f.innerHTML='<strong>ACHA</strong><span>Assistente de Carga Horária Acadêmica</span><span class="footer-sep">·</span><span>Sistema desenvolvido e provido pela <strong>Fábrica de Software Escola (FaSEs)</strong> do Campus Natal-Zona Norte do IFRN.</span>';
    document.body.appendChild(f);
  }
  document.addEventListener('DOMContentLoaded',()=>{installAccessGuard();setupSidebar(); setTimeout(setupTags,0); setupFooter();});
})();
