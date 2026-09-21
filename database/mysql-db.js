const mysql = require('mysql2/promise');

function jsonParse(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function loadDotEnv() {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v.replace(/\\n/g, '\n');
  }
}

loadDotEnv();

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'acha'
  };
}

async function createConnection() {
  return mysql.createConnection(mysqlConfig());
}

let schemaReadyPromise = null;

async function ensureSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema MySQL não encontrado: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    // O schema do ACHA é composto por CREATE/ALTER simples, sem procedures.
    // Executamos cada instrução separadamente para manter compatibilidade com
    // conexões MySQL que não habilitam multipleStatements.
    const statements = schema
      .split(/;[ \t]*(?:\r?\n|$)/)
      .map(s => s.trim())
      .filter(Boolean);

    const conn = await createConnection();
    try {
      for (const statement of statements) {
        await conn.query(statement);
      }
      console.log(`[MySQL] Schema verificado: ${statements.length} instruções processadas.`);
    } finally {
      await conn.end();
    }
  })().catch(err => {
    schemaReadyPromise = null;
    throw err;
  });

  return schemaReadyPromise;
}

async function readDatabase() {
  await ensureSchema();
  const conn = await createConnection();
  try {
    const db = {
      data: { semesters: {}, courses: [], matrices: {} },
      turn: {}, meta: {}, extraOffers: {}, pocvConfig: {}, teachers: [], offers: {}, pocvScenarios: [], authUsers: [],
      pedagogicalAreaResponsibilities: {}, groupDistributionResponsibility: {},
      accessControl: { version: 1, profiles: {} }, approvals: [], notifications: []
    };

    const [semesters] = await conn.query('SELECT codigo, ordem FROM semestres ORDER BY ordem');
    for (const row of semesters) db.data.semesters[row.codigo] = [];
    const [sequences] = await conn.query('SELECT semestre_codigo, matriz_id, periodo, sequencia FROM sequencias_matriz_semestre ORDER BY semestre_codigo, matriz_id, periodo, sequencia');
    for (const row of sequences) {
      (db.data.semesters[row.semestre_codigo] ||= []).push({ matrix: Number(row.matriz_id), period: Number(row.periodo), seq: Number(row.sequencia) });
    }

    const [courses] = await conn.query('SELECT * FROM cursos ORDER BY id_matriz');
    db.data.courses = courses.map(r => ({
      matrix: Number(r.id_matriz), name: r.nome, type: r.tipo, level: r.nivel, form: r.forma,
      course_id: r.codigo_curso, course_name: r.nome_curso, campus: r.campus,
      offerFormat: r.formato_oferta, organization: r.organizacao, participation: r.participacao,
      externalFunding: r.financiamento_externo, annualizedWorkloadHours: r.carga_horaria_anual,
      verticalization: r.verticalizacao, academicDirector: r.diretor_academico, fcc: r.fcc
    }));

    const [matrices] = await conn.query('SELECT * FROM matrizes ORDER BY id');
    const [disciplines] = await conn.query('SELECT * FROM disciplinas ORDER BY matriz_id, indice_disciplina');
    const [periods] = await conn.query('SELECT disciplina_id, periodo, carga_horaria FROM periodos_disciplinas ORDER BY disciplina_id, periodo');
    const periodsByDiscipline = new Map();
    for (const r of periods) (periodsByDiscipline.get(Number(r.disciplina_id)) || periodsByDiscipline.set(Number(r.disciplina_id), new Map()).get(Number(r.disciplina_id))).set(Number(r.periodo), r.carga_horaria);
    const disciplinesByMatrix = new Map();
    for (const r of disciplines) {
      const d = { name: r.nome, group: r.grupo, optional: !!r.optativa, periods: Object.fromEntries(periodsByDiscipline.get(Number(r.id)) || []) };
      (disciplinesByMatrix.get(Number(r.matriz_id)) || disciplinesByMatrix.set(Number(r.matriz_id), []).get(Number(r.matriz_id))).push(d);
    }
    for (const r of matrices) {
      const legacy = jsonParse(r.dados_legado, {});
      db.data.matrices[String(r.id)] = {
        ...legacy,
        name: r.nome, year: r.ano, duration: r.duracao, campus: r.campus,
        offerFormat: r.formato_oferta, organization: r.organizacao, participation: r.participacao,
        externalFunding: r.financiamento_externo, annualizedWorkloadHours: r.carga_horaria_anual,
        verticalization: r.verticalizacao, academicDirector: r.diretor_academico, fcc: r.fcc,
        offerLevel: r.nivel_oferta, offerForm: r.forma_oferta,
        disciplines: disciplinesByMatrix.get(Number(r.id)) || legacy.disciplines || []
      };
    }

    const [turns] = await conn.query('SELECT matriz_id, periodo, nome FROM turnos ORDER BY matriz_id, periodo, nome');
    for (const r of turns) ((db.turn[String(r.matriz_id)] ||= {})[String(r.periodo)] ||= []).push(r.nome);

    const [teachers] = await conn.query('SELECT * FROM docentes ORDER BY id');
    db.teachers = teachers.map(r => ({
      id: Number(r.id), name: r.nome, discipline: r.disciplina, group: r.grupo, degree: r.titulacao,
      regime: r.regime, regimePct: r.percentual_regime, leave: r.situacao_afastamento,
      leavePct: r.percentual_afastamento, management: r.gestao, managementPct: r.percentual_gestao,
      classFactor: r.fator_aula, vinculo: r.vinculo, matricula: r.matricula,
      coordinatorCourseId: r.coordenador_curso_id, coordinatorCourseName: r.coordenador_curso_nome,
      substituteId: r.substituto_id, substituteForId: r.substituto_de_id,
      managementArea: r.area_gestao, distributionGroups: jsonParse(r.grupos_distribuicao, [])
    }));

    const [offers] = await conn.query('SELECT * FROM ofertas ORDER BY semestre_codigo, id');
    for (const r of offers) {
      const o = jsonParse(r.dados_legado, {});
      const key = r.chave_legado;
      db.offers[r.semestre_codigo] ||= {};
      db.offers[r.semestre_codigo][key] = {
        ...o,
        name: r.nome ?? o.name,
        ch: r.carga_horaria ?? o.ch,
        group: r.grupo ?? o.group,
        turn: r.turno ?? o.turn,
        optionalChoice: r.escolha_optativa ?? o.optionalChoice,
        optionalChoices: jsonParse(r.escolhas_optativas, o.optionalChoices || []),
        validationStatus: r.status_validacao ?? o.validationStatus,
        validationSource: r.origem_validacao ?? o.validationSource,
        validationUpdatedAt: r.validacao_atualizada_em ?? o.validationUpdatedAt,
        validationBy: r.validado_por ?? o.validationBy,
        confirmationCreatedAt: r.confirmacao_criada_em ?? o.confirmationCreatedAt,
        confirmationBy: r.confirmado_por ?? o.confirmationBy,
        confirmationPrevious: jsonParse(r.confirmacao_anterior, o.confirmationPrevious)
      };
    }

    const [scenarios] = await conn.query('SELECT * FROM cenarios_pocv ORDER BY id');
    const [placements] = await conn.query('SELECT * FROM alocacoes_pocv ORDER BY cenario_id, id');
    const placementsByScenario = new Map();
    for (const r of placements) {
      const p = {
        id: r.id, matrix: r.matriz_id, seq: r.sequencia, courseId: r.curso_id, startSemester: r.semestre_inicio,
        turn: r.turno, turnSchedule: jsonParse(r.horario_turno, null), quantity: r.quantidade, vacancies: r.vagas,
        startPeriod: r.periodo_inicio, span: r.abrangencia, source: r.origem, locked: r.bloqueada,
        periodicity: r.periodicidade, alternatesTurns: r.alterna_turnos, alternatingTurns: jsonParse(r.turnos_alternados, null)
      };
      (placementsByScenario.get(r.cenario_id) || placementsByScenario.set(r.cenario_id, []).get(r.cenario_id)).push({ ...p, ...jsonParse(r.dados_legado, {}) });
    }
    db.pocvScenarios = scenarios.map(r => ({
      id: r.id, name: r.nome, isReal: !!r.eh_real, startSemester: r.semestre_inicio, endSemester: r.semestre_fim,
      realModelVersion: r.versao_modelo_real, createdAt: r.criado_em, updatedAt: r.atualizado_em,
      placements: placementsByScenario.get(r.id) || [], ...jsonParse(r.dados_legado, {})
    }));

    const [users] = await conn.query('SELECT * FROM usuarios_autenticacao ORDER BY id');
    db.authUsers = users.map(r => ({
      id: r.id, teacherId: r.docente_id, username: r.usuario, displayName: r.nome_exibicao, role: r.papel,
      passwordHash: r.hash_senha, photoData: r.foto_dados, suapUsername: r.usuario_suap,
      suapMatricula: r.matricula_suap, suapName: r.nome_suap, suapPhotoUrl: r.url_foto_suap
    }));

    const [areas] = await conn.query('SELECT * FROM areas_pedagogicas ORDER BY nome');
    const [areaGroups] = await conn.query('SELECT * FROM grupos_areas_pedagogicas ORDER BY area_nome, grupo_nome');
    const groupsByArea = new Map();
    for (const r of areaGroups) (groupsByArea.get(r.area_nome) || groupsByArea.set(r.area_nome, []).get(r.area_nome)).push(r.grupo_nome);
    for (const r of areas) db.pedagogicalAreaResponsibilities[r.nome] = { ...jsonParse(r.dados_legado, {}), description: r.descricao, groups: groupsByArea.get(r.nome) || [] };

    const [responsibilities] = await conn.query('SELECT * FROM responsabilidades_distribuicao_grupos ORDER BY grupo_nome');
    for (const r of responsibilities) db.groupDistributionResponsibility[r.grupo_nome] = { teacherId: r.docente_id, area: r.area_nome };

    const [profiles] = await conn.query('SELECT * FROM perfis_acesso ORDER BY papel');
    db.accessControl.version = profiles[0]?.versao || 1;
    for (const r of profiles) db.accessControl.profiles[r.papel] = { ...jsonParse(r.dados_legado, {}), label: r.rotulo, semesterFrom: r.semestre_inicio, semesterTo: r.semestre_fim, pages: {}, features: {} };
    const [pages] = await conn.query('SELECT * FROM paginas_acesso ORDER BY papel, pagina');
    for (const r of pages) (db.accessControl.profiles[r.papel] ||= { pages: {}, features: {} }).pages[r.pagina] = r.permissao;
    const [features] = await conn.query('SELECT * FROM funcionalidades_acesso ORDER BY papel, funcionalidade');
    for (const r of features) (db.accessControl.profiles[r.papel] ||= { pages: {}, features: {} }).features[r.funcionalidade] = !!r.habilitada;

    const [approvals] = await conn.query('SELECT * FROM aprovacoes ORDER BY criado_em, id');
    db.approvals = approvals.map(r => ({
      id: r.id, status: r.status, requesterId: r.solicitante_id, requesterName: r.solicitante_nome,
      requesterRole: r.solicitante_papel, type: r.tipo, semester: r.semestre_codigo, targetKey: r.chave_alvo,
      action: r.acao, changes: jsonParse(r.alteracoes, {}), snapshot: jsonParse(r.retrato, null), targetLabel: r.rotulo_alvo,
      decisionNote: r.observacao_decisao, decidedBy: r.decidido_por, decidedById: r.decidido_por_id,
      createdAt: r.criado_em, decidedAt: r.decidido_em, ...jsonParse(r.dados_legado, {})
    }));
    const [notifications] = await conn.query('SELECT * FROM notificacoes ORDER BY criada_em, id');
    db.notifications = notifications.map(r => ({
      id: r.id, userId: r.usuario_id, approvalId: r.aprovacao_id, title: r.titulo, message: r.mensagem,
      readAt: r.lida_em, createdAt: r.criada_em, ...jsonParse(r.dados_legado, {})
    }));
    const [deletions] = await conn.query('SELECT * FROM exclusoes_ofertas ORDER BY semestre_codigo, id');
    db.offerDeletions = {};
    for (const r of deletions) (db.offerDeletions[r.semestre_codigo] ||= {})[r.chave_legado] = {
      id: r.id, approvalId: r.aprovacao_id, deletedAt: r.excluida_em, deletedBy: r.excluida_por, snapshot: jsonParse(r.retrato, null)
    };
    const [meta] = await conn.query('SELECT chave, valor FROM sistema_metadados ORDER BY chave');
    for (const r of meta) {
      if(r.chave==='extraOffers') db.extraOffers=jsonParse(r.valor, {});
      else if(r.chave==='pocvConfig') db.pocvConfig=jsonParse(r.valor, {});
      else db.meta[r.chave] = jsonParse(r.valor, r.valor);
    }

    return db;
  } finally {
    await conn.end();
  }
}

async function testConnection() {
  const conn = await createConnection();
  try { const [rows] = await conn.query('SELECT DATABASE() AS banco, VERSION() AS versao'); return rows[0]; }
  finally { await conn.end(); }
}

module.exports = { mysqlConfig, createConnection, readDatabase, testConnection };
