const fs = require('fs');
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
const mysql = require('mysql2/promise');

const ROOT = path.resolve(__dirname, '..');
const DB_FILE = process.env.DB_FILE || path.join(ROOT, 'data', 'db.json');

function json(v) { return JSON.stringify(v ?? null); }
function dt(v) { return v ? new Date(v) : null; }
function num(v) { return v === '' || v === undefined || v === null ? null : Number(v); }
function semesterSort(code) { const [y,s] = String(code).split('.').map(Number); return y * 10 + s; }
function parseOfferKey(key) {
  const p = String(key).split('|');
  const suffixParts = String(p[3] || '').split('::');
  return { matrixId:Number(p[0]), period:Number(p[1]), seq:Number(p[2]), disciplineIndex:Number(suffixParts[0]), suffix:suffixParts.slice(1).join('::') };
}

async function execSchema(conn) {
  const schema = fs.readFileSync(path.join(ROOT, 'database', 'schema.sql'), 'utf8');
  for (const statement of schema.split(';').map(s => s.trim()).filter(Boolean)) await conn.query(statement);
}

async function limparTabelas(conn) {
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  const tabelas = [
    'sistema_metadados','exclusoes_ofertas','notificacoes','aprovacoes','funcionalidades_acesso','paginas_acesso','perfis_acesso',
    'responsabilidades_distribuicao_grupos','grupos_areas_pedagogicas','areas_pedagogicas','usuarios_autenticacao',
    'alocacoes_pocv','cenarios_pocv','ofertas','docentes','turnos','sequencias_matriz_semestre','periodos_disciplinas','disciplinas','matrizes','cursos','semestres'
  ];
  for (const tabela of tabelas) await conn.query(`DELETE FROM ${tabela}`);
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
}

async function main() {
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'acha', multipleStatements: false
  });
  try {
    await execSchema(conn);
    await conn.beginTransaction();
    try {
      await limparTabelas(conn);
      const semestres = db.data?.semesters || {};
      for (const code of Object.keys(semestres).sort((a,b)=>semesterSort(a)-semesterSort(b))) {
        await conn.query('INSERT INTO semestres(codigo,ordem) VALUES(?,?)',[code,semesterSort(code)]);
      }
      for (const c of db.data?.courses || []) await conn.query(`INSERT INTO cursos(id_matriz,nome,tipo,nivel,forma,codigo_curso,nome_curso,campus,formato_oferta,organizacao,participacao,financiamento_externo,carga_horaria_anual,verticalizacao,diretor_academico,fcc,dados_legado) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[c.matrix,c.name,c.type,c.level,c.form,c.course_id,c.course_name,c.campus,c.offerFormat,c.organization,c.participation,c.externalFunding,num(c.annualizedWorkloadHours),c.verticalization,c.academicDirector,c.fcc,json(c)]);
      for (const [id,m] of Object.entries(db.data?.matrices || {})) {
        await conn.query(`INSERT INTO matrizes(id,nome,ano,duracao,campus,formato_oferta,organizacao,participacao,financiamento_externo,carga_horaria_anual,verticalizacao,diretor_academico,fcc,nivel_oferta,forma_oferta,dados_legado) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[Number(id),m.name,num(m.year),num(m.duration),m.campus,m.offerFormat,m.organization,m.participation,m.externalFunding,num(m.annualizedWorkloadHours),m.verticalization,m.academicDirector,m.fcc,m.offerLevel,m.offerForm,json(m)]);
        for (let i=0;i<(m.disciplines||[]).length;i++) {
          const d=m.disciplines[i];
          const [r]=await conn.query(`INSERT INTO disciplinas(matriz_id,indice_disciplina,nome,grupo,optativa,dados_legado) VALUES(?,?,?,?,?,?)`,[Number(id),i,d.name,d.group,!!d.optional,json(d)]);
          const did=r.insertId;
          for (const [period,workload] of Object.entries(d.periods||{})) await conn.query('INSERT INTO periodos_disciplinas(disciplina_id,periodo,carga_horaria) VALUES(?,?,?)',[did,Number(period),num(workload)]);
        }
      }
      for (const code of Object.keys(semestres)) for (const x of semestres[code] || []) await conn.query('INSERT INTO sequencias_matriz_semestre(semestre_codigo,matriz_id,periodo,sequencia) VALUES(?,?,?,?)',[code,x.matrix,x.period,x.seq]);
      for (const [matrix,periods] of Object.entries(db.turn || {})) for (const [period,turns] of Object.entries(periods || {})) for (const turn of (turns || [])) await conn.query('INSERT INTO turnos(matriz_id,periodo,nome) VALUES(?,?,?)',[Number(matrix),Number(period),turn]);
      for (const t of db.teachers || []) await conn.query(`INSERT INTO docentes(id,nome,disciplina,grupo,titulacao,regime,percentual_regime,situacao_afastamento,percentual_afastamento,gestao,percentual_gestao,fator_aula,vinculo,matricula,coordenador_curso_id,coordenador_curso_nome,substituto_id,substituto_de_id,area_gestao,grupos_distribuicao,dados_legado) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[t.id,t.name,t.discipline,t.group,t.degree,t.regime,num(t.regimePct),t.leave,num(t.leavePct),t.management,num(t.managementPct),num(t.classFactor),t.vinculo,t.matricula,t.coordinatorCourseId,t.coordinatorCourseName,num(t.substituteId),num(t.substituteForId),t.managementArea,json(t.distributionGroups||[]),json(t)]);
      for (const [sem,rows] of Object.entries(db.offers || {})) for (const [key,o] of Object.entries(rows || {})) { const p=parseOfferKey(key); await conn.query(`INSERT INTO ofertas(semestre_codigo,matriz_id,periodo,sequencia,indice_disciplina,sufixo_oferta,nome,carga_horaria,grupo,turno,escolha_optativa,escolhas_optativas,status_validacao,origem_validacao,validacao_atualizada_em,validado_por,confirmacao_criada_em,confirmado_por,confirmacao_anterior,chave_legado,dados_legado) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[sem,p.matrixId,p.period,p.seq,p.disciplineIndex,p.suffix,o.name,num(o.ch),o.group,o.turn,o.optionalChoice,json(o.optionalChoices||[]),o.validationStatus||null,o.validationSource||null,dt(o.validationUpdatedAt),o.validationBy||null,dt(o.confirmationCreatedAt),o.confirmationBy||null,json(o.confirmationPrevious),key,json(o)]); }
      for (const s of db.pocvScenarios || []) { await conn.query(`INSERT INTO cenarios_pocv(id,nome,eh_real,semestre_inicio,semestre_fim,versao_modelo_real,criado_em,atualizado_em,dados_legado) VALUES(?,?,?,?,?,?,?,?,?)`,[s.id,s.name,!!s.isReal,s.startSemester,s.endSemester,num(s.realModelVersion),dt(s.createdAt),dt(s.updatedAt),json(s)]); for (const p of s.placements || []) await conn.query(`INSERT INTO alocacoes_pocv(id,cenario_id,matriz_id,sequencia,curso_id,semestre_inicio,turno,horario_turno,quantidade,vagas,periodo_inicio,abrangencia,origem,bloqueada,periodicidade,alterna_turnos,turnos_alternados,dados_legado) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[p.id,s.id,num(p.matrix),num(p.seq),p.courseId,p.startSemester,p.turn,json(p.turnSchedule),num(p.quantity),num(p.vacancies),num(p.startPeriod),num(p.span),p.source,!!p.locked,p.periodicity,!!p.alternatesTurns,json(p.alternatingTurns),json(p)]); }
      for (const u of db.authUsers || []) await conn.query(`INSERT INTO usuarios_autenticacao(id,docente_id,usuario,nome_exibicao,papel,hash_senha,foto_dados,usuario_suap,matricula_suap,nome_suap,url_foto_suap,dados_legado) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,[u.id,num(u.teacherId),u.username,u.displayName,u.role,u.passwordHash,u.photoData,u.suapUsername,u.suapMatricula,u.suapName,u.suapPhotoUrl,json(u)]);
      for (const [name,a] of Object.entries(db.pedagogicalAreaResponsibilities || {})) { await conn.query('INSERT INTO areas_pedagogicas(nome,descricao,dados_legado) VALUES(?,?,?)',[name,a.description,json(a)]); for (const g of a.groups||[]) await conn.query('INSERT INTO grupos_areas_pedagogicas(area_nome,grupo_nome) VALUES(?,?)',[name,g]); }
      for (const [group,a] of Object.entries(db.groupDistributionResponsibility || {})) await conn.query('INSERT INTO responsabilidades_distribuicao_grupos(grupo_nome,docente_id,area_nome) VALUES(?,?,?)',[group,num(a.teacherId),a.area]);
      const ac=db.accessControl || {}; for (const [role,p] of Object.entries(ac.profiles || {})) { await conn.query('INSERT INTO perfis_acesso(papel,rotulo,semestre_inicio,semestre_fim,versao,dados_legado) VALUES(?,?,?,?,?,?)',[role,p.label,p.semesterFrom,p.semesterTo,num(ac.version)||1,json(p)]); for (const [page,perm] of Object.entries(p.pages||{})) await conn.query('INSERT INTO paginas_acesso(papel,pagina,permissao) VALUES(?,?,?)',[role,page,perm]); for (const [feature,enabled] of Object.entries(p.features||{})) await conn.query('INSERT INTO funcionalidades_acesso(papel,funcionalidade,habilitada) VALUES(?,?,?)',[role,feature,!!enabled]); }
      for (const a of db.approvals || []) await conn.query(`INSERT INTO aprovacoes(id,status,solicitante_id,solicitante_nome,solicitante_papel,tipo,semestre_codigo,chave_alvo,acao,alteracoes,retrato,rotulo_alvo,observacao_decisao,decidido_por,decidido_por_id,criado_em,decidido_em,dados_legado) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[a.id,a.status,a.requesterId,a.requesterName,a.requesterRole,a.type,a.semester,a.targetKey,a.action,json(a.changes),json(a.snapshot),a.targetLabel,a.decisionNote,a.decidedBy,a.decidedById,dt(a.createdAt),dt(a.decidedAt),json(a)]);
      for (const n of db.notifications || []) await conn.query(`INSERT INTO notificacoes(id,usuario_id,aprovacao_id,titulo,mensagem,lida_em,criada_em,dados_legado) VALUES(?,?,?,?,?,?,?,?)`,[n.id,n.userId,n.approvalId,n.title,n.message,n.readAt?dt(n.readAt):null,dt(n.createdAt),json(n)]);
      for (const [sem,rows] of Object.entries(db.offerDeletions || {})) for (const [key,d] of Object.entries(rows || {})) await conn.query('INSERT INTO exclusoes_ofertas(semestre_codigo,chave_legado,aprovacao_id,excluida_em,excluida_por,retrato) VALUES(?,?,?,?,?,?)',[sem,key,d.approvalId,dt(d.deletedAt),d.deletedBy,json(d.snapshot)]);
      for (const k of ['meta','data']) await conn.query('INSERT INTO sistema_metadados(chave,valor) VALUES(?,?)',[k,json(db[k]||{})]);
      await conn.commit();
      console.log('Migração concluída com sucesso.');
    } catch(e) { await conn.rollback(); throw e; }
  } finally { await conn.end(); }
}
main().catch(e=>{console.error(e.stack||e);process.exit(1);});
