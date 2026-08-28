(function(){
  const navItems=[
    ['dashboard.html','home','Início'],
    ['index.html','clipboard','Oferta'],
    ['alocacao.html','teacher','Alocação docente'],
    ['projecao.html','chart','Projeção por turno'],
    ['matrizes.html','book','Matrizes'],
    ['turmas.html','users','Turmas'],
    ['docentes.html','person','Docentes'],
    ['grupos.html','tag','Grupos'],
    ['regras.html','gear','Regras'],
    ['demandas.html','note','Demandas avulsas']
  ];
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
    note:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/></svg>'
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
  function courseName(coursesSource,matrixId){
    if(Array.isArray(coursesSource)){
      const found=coursesSource.find(x=>String(x?.matrix)===String(matrixId));
      return String(found?.name||'').trim();
    }
    const found=coursesSource?.[String(matrixId)];
    return String(found?.name||'').trim();
  }
  window.POCV={norm,esc,setGroups,setCourses,color,tag,palette:uniquePalette,courseName};
  function setupSidebar(){
    const old=document.querySelector('.mainnav'); if(!old)return;
    old.innerHTML='<div class="sidebar-brand"><span class="sidebar-logo">PO</span><span class="sidebar-title">POCV</span><button type="button" class="sidebar-toggle" aria-label="Recolher menu" title="Recolher menu"><span class="toggle-glyph">‹</span></button></div>' + navItems.map(([href,icon,label])=>`<a href="${href}" title="${label}" aria-label="${label}"><span class="nav-icon">${iconSvg[icon]}</span><span class="nav-label">${label}</span></a>`).join('');
    old.classList.add('pocv-sidebar');
    const current=location.pathname.split('/').pop()||'dashboard.html'; old.querySelectorAll('a').forEach(a=>{if(a.getAttribute('href')===current)a.classList.add('active')});
    const toggle=old.querySelector('.sidebar-toggle');
    const applySidebarState=collapsed=>{
      document.body.classList.toggle('sidebar-collapsed',collapsed);
      localStorage.setItem('pocv_sidebar_collapsed',collapsed?'1':'0');
      toggle.querySelector('.toggle-glyph').textContent=collapsed?'›':'‹';
      toggle.setAttribute('aria-label',collapsed?'Expandir menu':'Recolher menu');
      toggle.title=collapsed?'Expandir menu':'Recolher menu';
    };
    applySidebarState(localStorage.getItem('pocv_sidebar_collapsed')==='1');
    toggle.onclick=()=>applySidebarState(!document.body.classList.contains('sidebar-collapsed'));
  }
  function setupTags(){
    document.querySelectorAll('[data-pocv-group]').forEach(el=>{el.outerHTML=tag(el.dataset.pocvGroup,'group')});
    document.querySelectorAll('[data-pocv-course]').forEach(el=>{el.outerHTML=tag(el.dataset.pocvCourse,'course')});
  }
  document.addEventListener('DOMContentLoaded',()=>{setupSidebar(); setTimeout(setupTags,0);});
})();
