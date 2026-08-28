(() => {
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const normalise = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tagColorIndex = value => {
    const text = normalise(value);
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return hash % 10;
  };
  const unique = (items, key) => [...new Set(items.map(key).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR',{sensitivity:'base'}));
  const normalizeRegime = value => { const v=String(value||'').trim(); if(!v) return ''; if(/^40(?:h|\s*horas?)$/i.test(v)) return '40'; if(/^20(?:h|\s*horas?)$/i.test(v)) return '20'; return v; };
  const allowsSubstitute = t => /capacita[cç][aã]o/i.test(String(t?.leave||'')) || /cess[aã]o/i.test(String(t?.leave||'')) || /dire[cç][aã]o/i.test(String(t?.management||''));
  const isRestricted = t => allowsSubstitute(t);
  const standardDegrees = ['Graduação', 'Especialização', 'Mestrado', 'Doutorado'];
  const situationText = t => [t.leave !== 'Não se aplica' ? t.leave : '', t.management !== 'Não se aplica' ? t.management : ''].filter(Boolean).join(' · ') || 'Disponível';
  const apiBase = location.protocol === 'file:' ? 'http://localhost:3000' : '';
  const managementFactors = {'Não se aplica':1,'Coordenação de Curso':.5,'Função Gratificada (FG)':.5,'Direção Acadêmica':.15,'Função Sistêmica':.15,'Direção-Geral':0};
  const leaveFactors = {'Não se aplica':1,'Redução por Saúde 25%':.75,'Redução por Saúde 50%':.5,'Cessão a outro órgão':0,'Afastamento capacitação (100%)':0};
  let teachers = [];
  let editedTeacher = null;
  let modalMode = 'edit';
  let pendingSubstituteForId = null;
  let sortKey = 'name', sortDir = 1;

  const defaultColumnOrder = ['name','discipline','group','degree','vinculo','regime','situation','actions'];
  let teacherColumnOrder = JSON.parse(localStorage.getItem('docentes_column_order') || 'null');
  if (!Array.isArray(teacherColumnOrder)) teacherColumnOrder = [...defaultColumnOrder];
  defaultColumnOrder.forEach(key => { if (!teacherColumnOrder.includes(key)) teacherColumnOrder.push(key); });
  teacherColumnOrder = teacherColumnOrder.filter(key => defaultColumnOrder.includes(key));

  function optionsFor(field) {
    const values = teachers.map(t => field==='regime' ? normalizeRegime(t[field]) : t[field]);
    const standard = {
      regime: ['DE','40','20'],
      degree: standardDegrees,
      leave: Object.keys(leaveFactors),
      management: Object.keys(managementFactors),
      vinculo: ['Efetivo','Substituto temporário','Visitante']
    };
    const result=unique([...values, ...(standard[field] || [])], value => value);
    return field==='degree' ? ['', ...result] : result;
  }

  function substituteOptions(teacher) {
    const currentId = Number(teacher?.substituteId);
    const subs = teachers.filter(t => {
      if (t.vinculo !== 'Substituto temporário' || Number(t.id) === Number(teacher?.id)) return false;
      const linkedTo = Number(t.substituteForId);
      return !Number.isFinite(linkedTo) || linkedTo === Number(teacher?.id) || Number(t.id) === currentId;
    });
    return `<option value="">Nenhum substituto vinculado</option>` +
      subs.map(t => `<option value="${t.id}" ${currentId === Number(t.id) ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');
  }

  function titularOptions(substitute) {
    const currentId = Number(substitute?.substituteForId);
    const titulars = teachers.filter(t => {
      // Só aparecem como opção os docentes que efetivamente podem ter
      // substituto: não substitutos/visitantes e com situação que gera substituição.
      if (t.vinculo === 'Substituto temporário' || t.vinculo === 'Visitante' || Number(t.id) === Number(substitute?.id)) return false;
      if (!allowsSubstitute(t)) return false;
      const linkedSub = Number(t.substituteId);
      return !Number.isFinite(linkedSub) || linkedSub === Number(substitute?.id) || Number(t.id) === currentId;
    });
    return `<option value="">Selecione o docente titular</option>` +
      titulars.map(t => `<option value="${t.id}" ${currentId === Number(t.id) ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');
  }

  function associationText(t) {
    if (t.vinculo === 'Substituto temporário' && t.substituteForId) {
      const titular = teachers.find(x => Number(x.id) === Number(t.substituteForId));
      return titular ? `Substituto de: ${titular.name}` : '';
    }
    if (t.substituteId) {
      const sub = teachers.find(x => Number(x.id) === Number(t.substituteId));
      return sub ? `Substituto: ${sub.name}` : '';
    }
    return '';
  }

  function associationField(t) {
    if (t.vinculo === 'Substituto temporário') {
      return `<div class="field association-field">
        <label for="edit-titular">Docente titular substituído <span class="required">*</span></label>
        <select id="edit-titular" required>${titularOptions(t)}</select>
        <div class="automatic">Obrigatório. Cada substituto temporário pode estar associado a apenas um docente titular, e cada titular pode ter no máximo um substituto.</div>
      </div>`;
    }
    if (t.vinculo === 'Visitante') return '';
    if (!allowsSubstitute(t)) return '';
    return `<div class="field association-field">
      <label for="edit-substitute">Professor substituto vinculado</label>
      <select id="edit-substitute">${substituteOptions(t)}</select>
      <div class="automatic">A situação atual permite substituição. Selecione um substituto já cadastrado ou cadastre um novo.</div>
      <button type="button" class="add-substitute" id="addSubstitute">+ Cadastrar novo substituto para este docente</button>
    </div>`;
  }

  function disciplineOptions(selected='') {
    const values = unique(teachers.map(t=>t.discipline), v=>v);
    return `<option value="">— Não informado —</option>` + values.map(v=>`<option value="${escapeHtml(v)}" ${String(v)===String(selected)?'selected':''}>${escapeHtml(v)}</option>`).join('');
  }

  function refreshAssociationVisibility() {
    const container=$('associationDynamic');
    if(!container) return;
    const current={...editedTeacher, vinculo:$('edit-vinculo')?.value||editedTeacher?.vinculo, leave:$('edit-leave')?.value||editedTeacher?.leave, management:$('edit-management')?.value||editedTeacher?.management};
    container.innerHTML = associationField(current);
    bindAssociationActions();
  }

  function render() {
    const query = normalise($('search').value);
    const group = $('group').value;
    const vinculo = $('vinculo').value;
    const situation = $('situation').value;

    const rows = teachers.filter(t => {
      const text = [t.name,t.discipline,t.group,t.degree,t.vinculo,t.regime,situationText(t),associationText(t)].join(' ');
      const textMatch = !query || normalise(text).includes(query);
      const situationMatch = !situation || (situation === 'restricao' === isRestricted(t));
      return textMatch && (!group || t.group === group) && (!vinculo || t.vinculo === vinculo) && situationMatch;
    }).sort((a,b) => {
      const value = t => sortKey === 'situation' ? situationText(t) :
        sortKey === 'association' ? associationText(t) :
        (t[sortKey] ?? '');
      const av=value(a), bv=value(b);
      const an=Number(av), bn=Number(bv);
      const numeric=String(av).trim()!=='' && String(bv).trim()!=='' && Number.isFinite(an) && Number.isFinite(bn);
      const result=numeric ? an-bn : String(av).localeCompare(String(bv),'pt-BR',{numeric:true,sensitivity:'base'});
      return result*sortDir;
    });

    $('total').textContent = `${rows.length} docente${rows.length===1?'':'s'}`;
    $('teachers').innerHTML = rows.length ? rows.map(t => {
      const restrictedClass=isRestricted(t)?'warning':'';
      return `<tr data-id="${t.id}">
        <td data-col="name" class="editable" data-field="name"><span class="teacher">${escapeHtml(t.name)}</span></td>
        <td data-col="discipline" class="editable" data-field="discipline">${escapeHtml(t.discipline||'—')}</td>
        <td data-col="group" class="editable" data-field="group"><span class="badge group-tag tag-${tagColorIndex(t.group||'Sem grupo')}">${escapeHtml(t.group||'Sem grupo')}</span></td>
        <td data-col="degree" class="editable" data-field="degree">${escapeHtml(t.degree||'—')}</td>
        <td data-col="vinculo" class="editable" data-field="vinculo">${escapeHtml(t.vinculo||'—')}</td>
        <td data-col="regime" class="editable" data-field="regime">${escapeHtml(t.regime||'—')}<span class="secondary">${Math.round((Number(t.regimePct)||0)*100)}% do regime</span></td>
        <td data-col="situation" class="editable" data-field="situation"><span class="badge ${restrictedClass}">${escapeHtml(situationText(t))}</span><span class="secondary">Fator de aula: ${Math.round((Number(t.classFactor)||0)*100)}%</span>${associationText(t)?`<span class="secondary">${escapeHtml(associationText(t))}</span>`:''}</td>
        <td data-col="actions" class="actions-cell"><div class="row-actions">
          <button type="button" class="icon-btn edit-teacher" title="Alterar dados" aria-label="Alterar dados">✎</button>
          <button type="button" class="icon-btn delete delete-teacher" title="Excluir" aria-label="Excluir">🗑</button>
        </div></td>
      </tr>`;
    }).join('') : '<tr><td class="empty" colspan="8">Nenhum docente encontrado com estes filtros.</td></tr>';

    applyTeacherColumnOrder();
  }

  function fillFilters() {
    const fill=(id,values,label)=>{
      const select=$(id), selected=select.value;
      select.innerHTML=`<option value="">${label}</option>`+values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
      select.value=selected;
    };
    fill('group',optionsFor('group'),'Todos os grupos');
    fill('vinculo',optionsFor('vinculo'),'Todos os vínculos');
  }

  function addModalStyles() {
    if ($('docentesEditorStyles')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="docentesEditorStyles">
      .editable{cursor:pointer}.editable:hover{background:#f0fdfa}
      .add-substitute,.add-teacher{margin-top:8px;padding:8px 11px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#334155;font:inherit;font-weight:700;cursor:pointer}
      .add-teacher{background:#0f766e;color:#fff;border-color:#0f766e;margin:0 10px 0 0}
      .edit-modal{position:fixed;inset:0;background:#0008;display:none;align-items:center;justify-content:center;z-index:50;padding:18px}
      .edit-modal.open{display:flex}.edit-box{background:#fff;border-radius:14px;width:min(680px,100%);max-height:92vh;overflow:auto;box-shadow:0 20px 55px #0006}
      .edit-head{padding:17px 18px;border-bottom:1px solid #e2e8f0}.edit-head h2{margin:0;font-size:18px}.edit-head p{margin:4px 0 0;color:#64748b}
      .edit-body{padding:18px}.edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field label{display:block;margin:0 0 6px;font-size:12px;font-weight:700;color:#475569}
      .edit-body input,.edit-body select{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:9px;font:inherit}
      .automatic{margin-top:8px;padding:10px;border-radius:9px;background:#f0fdfa;color:#115e59}.required{color:#b91c1c}.association-field{grid-column:1/-1}
      .edit-foot{padding:14px 18px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:flex-end;gap:9px}
      .edit-foot button{padding:9px 13px;border:0;border-radius:9px;font:inherit;font-weight:700;cursor:pointer}.save{background:#0f766e;color:#fff}
      .cancel{background:#e2e8f0;color:#334155}.delete{background:#fee2e2;color:#991b1b}.edit-message{margin-right:auto;color:#64748b;font-size:12px}
      @media(max-width:700px){.edit-grid{grid-template-columns:1fr}}
    </style>`);
  }

  function selectField(label,field,value) {
    return `<div class="field"><label for="edit-${field}">${label}</label><select id="edit-${field}">${optionsFor(field).map(v=>`<option value="${escapeHtml(v)}" ${v===value?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></div>`;
  }

  function fieldsFor(t,isNew=false) {
    const teacher=t||{name:'',discipline:'',group:'',degree:'',vinculo:'Efetivo',regime:'DE',leave:'Não se aplica',management:'Não se aplica'};
    return `<div class="edit-grid">
      <div class="field"><label for="edit-name">Nome</label><input id="edit-name" value="${escapeHtml(teacher.name)}"></div>
      <div class="field"><label for="edit-discipline">Disciplina / área</label><select id="edit-discipline">${disciplineOptions(teacher.discipline)}</select></div>
      ${selectField('Grupo','group',teacher.group||'')}
      ${selectField('Titulação','degree',teacher.degree||'')}
      ${selectField('Vínculo','vinculo',teacher.vinculo||'Efetivo')}
      ${selectField('Regime','regime',normalizeRegime(teacher.regime||'DE'))}
      ${selectField('Afastamento / restrição','leave',teacher.leave||'Não se aplica')}
      ${selectField('Função de gestão','management',teacher.management||'Não se aplica')}
      ${isNew ? '<div class="field association-field" id="newAssociation">'+associationField(teacher)+'</div>' : '<div id="associationDynamic" class="association-field">'+associationField(teacher)+'</div>'}
    </div>`;
  }

  function addModal() {
    addModalStyles();
    if (!$('addTeacher')) $('total').insertAdjacentHTML('beforebegin', `<button type="button" class="add-teacher" id="addTeacher">+ Adicionar docente</button>`);
    if (!$('editModal')) document.body.insertAdjacentHTML('beforeend', `<div class="edit-modal" id="editModal" aria-hidden="true"><div class="edit-box" role="dialog" aria-modal="true" aria-labelledby="editTitle">
      <div class="edit-head"><h2 id="editTitle">Editar docente</h2><p id="editSubtitle"></p></div>
      <div class="edit-body" id="editFields"></div>
      <div class="edit-foot"><span class="edit-message" id="editMessage"></span><button type="button" class="delete" id="deleteTeacher">Excluir docente</button><button type="button" class="cancel" id="cancelEdit">Cancelar</button><button type="button" class="save" id="saveEdit">Salvar</button></div>
    </div></div>`);

    $('cancelEdit').onclick=closeModal;
    $('editModal').onclick=e=>{if(e.target===$('editModal'))closeModal()};
    $('saveEdit').onclick=save;
    $('deleteTeacher').onclick=remove;
    $('addTeacher').onclick=()=>openNewModal();
  }

  function openModal(teacher) {
    editedTeacher=teacher;
    modalMode='edit';
    pendingSubstituteForId=null;
    $('editTitle').textContent='Alterar dados do docente';
    $('editSubtitle').textContent=teacher.name;
    $('editFields').innerHTML=fieldsFor(teacher);
    $('deleteTeacher').style.display='inline-block';
    $('editMessage').textContent='';
    $('editModal').classList.add('open');
    $('editModal').setAttribute('aria-hidden','false');
    bindAssociationActions();
    ['edit-vinculo','edit-leave','edit-management'].forEach(id=>$(id)?.addEventListener('change',refreshAssociationVisibility));
    $('edit-regime')?.addEventListener('change',()=>{});
    $('edit-name').focus();
  }

  function openNewModal(defaultVinculo='Efetivo',defaultGroup='',linkToId=null) {
    editedTeacher=null;
    modalMode='new';
    pendingSubstituteForId=linkToId;
    $('editTitle').textContent='Adicionar docente';
    $('editSubtitle').textContent='Preencha os dados do novo cadastro.';
    $('editFields').innerHTML=fieldsFor({name:'',discipline:'',group:defaultGroup,degree:'',vinculo:defaultVinculo,regime:'DE',leave:'Não se aplica',management:'Não se aplica',substituteForId:linkToId||null},true);
    $('deleteTeacher').style.display='none';
    $('editMessage').textContent=linkToId ? 'O novo substituto será vinculado automaticamente ao docente selecionado.' : '';
    $('editModal').classList.add('open');
    $('editModal').setAttribute('aria-hidden','false');
    ['edit-vinculo','edit-leave','edit-management'].forEach(id=>$(id)?.addEventListener('change',()=>{
      const container=$('newAssociation'); if(!container) return;
      const temp={vinculo:$('edit-vinculo').value,leave:$('edit-leave').value,management:$('edit-management').value,group:$('edit-group')?.value||'',substituteForId:$('edit-titular')?.value||pendingSubstituteForId||null};
      container.innerHTML=associationField(temp); bindAssociationActions();
    }));
    $('edit-name').focus();
  }

  function bindAssociationActions() {
    const add=$('addSubstitute');
    if(add) add.onclick=()=>{
      if(!editedTeacher) return;
      openNewModal('Substituto temporário',editedTeacher.group||'',editedTeacher.id);
    };
  }

  async function linkAssociation(teacher) {
    if(!teacher) return;
    const vinculo=$('edit-vinculo')?.value || teacher.vinculo;
    if(vinculo !== 'Substituto temporário' && !allowsSubstitute({...teacher, leave:$('edit-leave')?.value||teacher.leave, management:$('edit-management')?.value||teacher.management})) return;
    let payload;
    if(vinculo==='Substituto temporário') {
      const titularId=$('edit-titular')?.value || null;
      if(!titularId) throw new Error('Para um substituto temporário, selecione obrigatoriamente o docente titular associado.');
      payload={teacherId:titularId,substituteId:teacher.id};
    } else {
      const substituteId=$('edit-substitute')?.value || null;
      payload={teacherId:teacher.id,substituteId:substituteId||null};
    }
    const response=await fetch(`${apiBase}/api/teacher-link`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!response.ok) throw new Error((await response.json().catch(()=>({}))).error||'Não foi possível salvar o vínculo do substituto.');
  }

  async function save() {
    const button=$('saveEdit');
    button.disabled=true;
    $('editMessage').textContent='Salvando…';
    try {
      if(modalMode==='new') {
        const changes={name:$('edit-name').value.trim(),discipline:$('edit-discipline').value.trim(),group:$('edit-group').value,degree:$('edit-degree').value,vinculo:$('edit-vinculo').value,regime:normalizeRegime($('edit-regime').value),leave:$('edit-leave').value,management:$('edit-management').value};
        if(!changes.name) throw new Error('Informe o nome do docente.');
        let substituteForId=null;
        if(changes.vinculo==='Substituto temporário') {
          substituteForId=$('edit-titular')?.value || null;
          if(!substituteForId) throw new Error('Para um substituto temporário, selecione obrigatoriamente o docente titular associado.');
        }
        const payload={...changes};
        if(substituteForId) payload.substituteForId=Number(substituteForId);
        const response=await fetch(`${apiBase}/api/teacher`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        if(!response.ok) throw new Error((await response.json().catch(()=>({}))).error||'Não foi possível cadastrar o docente.');
        const result=await response.json();
        teachers.push(result.teacher);
        const fresh=await fetch(`${apiBase}/api/db`);
        if(fresh.ok) teachers=(await fresh.json()).teachers||teachers;
      } else {
        if(!editedTeacher) throw new Error('Nenhum docente selecionado.');
        const changes={name:$('edit-name').value.trim(),discipline:$('edit-discipline').value.trim(),group:$('edit-group').value,degree:$('edit-degree').value,vinculo:$('edit-vinculo').value,regime:normalizeRegime($('edit-regime').value),leave:$('edit-leave').value,management:$('edit-management').value};
        if(!changes.name) throw new Error('Informe o nome do docente.');
        if(changes.vinculo==='Substituto temporário'){
          changes.substituteForId=$('edit-titular')?.value || null;
          if(!changes.substituteForId) throw new Error('Para um substituto temporário, selecione obrigatoriamente o docente titular associado.');
        }
        const response=await fetch(`${apiBase}/api/teacher`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:editedTeacher.id,changes})});
        if(!response.ok) throw new Error((await response.json().catch(()=>({}))).error||'Não foi possível salvar a alteração.');
        const result=await response.json();
        Object.assign(editedTeacher,result.teacher||changes);
        if(changes.vinculo!=='Substituto temporário') await linkAssociation(editedTeacher);
        const fresh=await fetch(`${apiBase}/api/db`);
        if(fresh.ok) teachers=(await fresh.json()).teachers||teachers;
      }
      fillFilters(); render();
      $('editMessage').textContent='Alteração salva.';
      setTimeout(closeModal,350);
    } catch(error) {
      $('editMessage').textContent=location.protocol==='file:'?'Para salvar, abra o sistema pelo servidor local.':error.message;
    } finally { button.disabled=false; }
  }

  async function remove() {
    if(!editedTeacher) return;
    const confirmed=window.confirm(`Excluir o cadastro de ${editedTeacher.name}? Esta ação não poderá ser desfeita.`);
    if(!confirmed) return;
    $('editMessage').textContent='Excluindo…';
    try {
      const response=await fetch(`${apiBase}/api/teacher?id=${encodeURIComponent(editedTeacher.id)}`,{method:'DELETE'});
      if(!response.ok) throw new Error((await response.json().catch(()=>({}))).error||'Não foi possível excluir o docente.');
      teachers=teachers.filter(t=>Number(t.id)!==Number(editedTeacher.id));
      teachers.forEach(t=>{
        if(Number(t.substituteId)===Number(editedTeacher.id)) t.substituteId=null;
        if(Number(t.substituteForId)===Number(editedTeacher.id)) t.substituteForId=null;
      });
      fillFilters(); render(); closeModal();
    } catch(error) {
      $('editMessage').textContent=location.protocol==='file:'?'Para excluir, abra o sistema pelo servidor local.':error.message;
    }
  }

  function closeModal() {
    $('editModal').classList.remove('open');
    $('editModal').setAttribute('aria-hidden','true');
    editedTeacher=null;
    pendingSubstituteForId=null;
  }

  function applyTeacherColumnOrder() {
    const table=document.querySelector('#teachers')?.closest('table');
    if(!table) return;
    [...table.rows].forEach(row=>{
      const byKey=Object.fromEntries([...row.children].filter(c=>c.dataset.col).map(c=>[c.dataset.col,c]));
      teacherColumnOrder.forEach(key=>{if(byKey[key])row.appendChild(byKey[key]);});
    });
  }

  function updateSortLabels() {
    document.querySelectorAll('.sort').forEach(button=>{
      const base=button.dataset.label || button.textContent.replace(/[↑↓↕]$/,'').trim();
      button.dataset.label=base;
      button.textContent=base+(button.dataset.sort===sortKey?(sortDir===1?' ↑':' ↓'):' ↕');
    });
  }

  addModal();

  $('teachers').addEventListener('click',event=>{
    const row=event.target.closest('tr');
    if(!row) return;
    const teacher=teachers.find(t=>String(t.id)===String(row.dataset.id));
    if(!teacher) return;
    if(event.target.closest('.edit-teacher')) openModal(teacher);
    else if(event.target.closest('.delete-teacher')) { editedTeacher=teacher; modalMode='edit'; remove(); }
  });

  document.querySelectorAll('.sort').forEach(button=>button.addEventListener('click',()=>{
    const key=button.dataset.sort;
    sortDir=sortKey===key?-sortDir:1;
    sortKey=key;
    updateSortLabels();
    render();
  }));

  $('teachers').addEventListener('dblclick',event=>{
    const cell=event.target.closest('.editable');
    if(!cell) return;
    const teacher=teachers.find(t=>String(t.id)===String(cell.closest('tr')?.dataset.id));
    if(teacher) openModal(teacher);
  });

  document.querySelectorAll('th[data-col]').forEach(th=>{
    if(th.dataset.col==='actions') return;
    th.addEventListener('dragstart',e=>{th.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',th.dataset.col);});
    th.addEventListener('dragend',()=>th.classList.remove('dragging'));
    th.addEventListener('dragover',e=>{e.preventDefault();th.classList.add('drag-over');});
    th.addEventListener('dragleave',()=>th.classList.remove('drag-over'));
    th.addEventListener('drop',e=>{
      e.preventDefault(); th.classList.remove('drag-over');
      const from=e.dataTransfer.getData('text/plain'),to=th.dataset.col;
      if(!from||!to||from===to||to==='actions') return;
      const fromIndex=teacherColumnOrder.indexOf(from);
      const toIndex=teacherColumnOrder.indexOf(to);
      if(fromIndex<0||toIndex<0)return;
      teacherColumnOrder.splice(fromIndex,1);
      teacherColumnOrder.splice(teacherColumnOrder.indexOf(to),0,from);
      localStorage.setItem('docentes_column_order',JSON.stringify(teacherColumnOrder));
      applyTeacherColumnOrder();
    });
  });

  ['search','group','vinculo','situation'].forEach(id=>$(id).addEventListener('input',render));
  updateSortLabels();
  load();

  async function load() {
    try {
      const response=await fetch(`${apiBase}/api/db`);
      if(!response.ok) throw new Error('Erro ao carregar docentes.');
      const db=await response.json();
      teachers=Array.isArray(db.teachers)?db.teachers.map(t=>({...t,regime:normalizeRegime(t.regime)})):[];
      fillFilters();
      render();
    } catch(error) {
      $('total').textContent='Erro ao carregar';
      $('teachers').innerHTML=`<tr><td class="empty" colspan="8">${escapeHtml(error.message)}</td></tr>`;
    }
  }
})();