CREATE DATABASE IF NOT EXISTS acha CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE acha;

CREATE TABLE IF NOT EXISTS semestres (
  codigo VARCHAR(10) PRIMARY KEY,
  ordem INT NOT NULL,
  criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cursos (
  id_matriz INT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(80), nivel VARCHAR(80), forma VARCHAR(80),
  codigo_curso VARCHAR(100), nome_curso VARCHAR(255), campus VARCHAR(80),
  formato_oferta VARCHAR(120), organizacao VARCHAR(80), participacao VARCHAR(80),
  financiamento_externo VARCHAR(80), carga_horaria_anual DECIMAL(10,2),
  verticalizacao VARCHAR(255), diretor_academico VARCHAR(80), fcc VARCHAR(30),
  dados_legado JSON NULL,
  criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS matrizes (
  id INT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  ano INT NULL,
  duracao INT NULL,
  campus VARCHAR(80), formato_oferta VARCHAR(120), organizacao VARCHAR(80),
  participacao VARCHAR(80), financiamento_externo VARCHAR(80),
  carga_horaria_anual DECIMAL(10,2), verticalizacao VARCHAR(255),
  diretor_academico VARCHAR(80), fcc VARCHAR(30), nivel_oferta VARCHAR(80), forma_oferta VARCHAR(80),
  dados_legado JSON NULL,
  FOREIGN KEY (id) REFERENCES cursos(id_matriz) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS disciplinas (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  matriz_id INT NOT NULL,
  indice_disciplina INT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  grupo VARCHAR(120),
  optativa BOOLEAN NOT NULL DEFAULT FALSE,
  dados_legado JSON NULL,
  UNIQUE KEY uq_matriz_disciplina (matriz_id, indice_disciplina),
  INDEX idx_disciplina_matriz_nome (matriz_id, nome),
  FOREIGN KEY (matriz_id) REFERENCES matrizes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS periodos_disciplinas (
  disciplina_id BIGINT NOT NULL,
  periodo INT NOT NULL,
  carga_horaria DECIMAL(10,2) NULL,
  PRIMARY KEY (disciplina_id, periodo),
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sequencias_matriz_semestre (
  semestre_codigo VARCHAR(10) NOT NULL,
  matriz_id INT NOT NULL,
  periodo INT NOT NULL,
  sequencia INT NOT NULL,
  PRIMARY KEY (semestre_codigo, matriz_id, periodo, sequencia),
  FOREIGN KEY (semestre_codigo) REFERENCES semestres(codigo) ON DELETE CASCADE,
  FOREIGN KEY (matriz_id) REFERENCES matrizes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS turnos (
  matriz_id INT NOT NULL,
  periodo INT NOT NULL,
  nome VARCHAR(40) NOT NULL,
  PRIMARY KEY (matriz_id, periodo, nome),
  FOREIGN KEY (matriz_id) REFERENCES matrizes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS docentes (
  id INT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  disciplina VARCHAR(255),
  grupo VARCHAR(120), titulacao VARCHAR(80), regime VARCHAR(80),
  percentual_regime DECIMAL(8,2), situacao_afastamento VARCHAR(80), percentual_afastamento DECIMAL(8,2),
  gestao VARCHAR(120), percentual_gestao DECIMAL(8,2), fator_aula DECIMAL(10,4),
  vinculo VARCHAR(80), matricula VARCHAR(80), coordenador_curso_id VARCHAR(100),
  coordenador_curso_nome VARCHAR(255), substituto_id INT NULL, substituto_de_id INT NULL,
  area_gestao VARCHAR(120), grupos_distribuicao JSON NULL,
  dados_legado JSON NULL,
  INDEX idx_docente_coordenador (coordenador_curso_id),
  FOREIGN KEY (substituto_de_id) REFERENCES docentes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ofertas (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  semestre_codigo VARCHAR(10) NOT NULL,
  matriz_id INT NOT NULL,
  periodo INT NOT NULL,
  sequencia INT NOT NULL,
  indice_disciplina INT NOT NULL,
  sufixo_oferta VARCHAR(255) NOT NULL DEFAULT '',
  nome VARCHAR(255),
  carga_horaria DECIMAL(10,2),
  grupo VARCHAR(120),
  turno VARCHAR(40),
  escolha_optativa VARCHAR(255),
  escolhas_optativas JSON NULL,
  status_validacao VARCHAR(40) NULL,
  origem_validacao VARCHAR(80) NULL,
  validacao_atualizada_em DATETIME NULL,
  validado_por VARCHAR(100) NULL,
  confirmacao_criada_em DATETIME NULL,
  confirmado_por VARCHAR(100) NULL,
  confirmacao_anterior JSON NULL,
  chave_legado VARCHAR(512) NOT NULL,
  dados_legado JSON NULL,
  UNIQUE KEY uq_oferta_chave (semestre_codigo, chave_legado),
  INDEX idx_oferta_busca (semestre_codigo, matriz_id, periodo, sequencia, indice_disciplina),
  INDEX idx_oferta_status (semestre_codigo, status_validacao),
  FOREIGN KEY (semestre_codigo) REFERENCES semestres(codigo) ON DELETE CASCADE,
  FOREIGN KEY (matriz_id) REFERENCES matrizes(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cenarios_pocv (
  id VARCHAR(100) PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  eh_real BOOLEAN NOT NULL DEFAULT FALSE,
  semestre_inicio VARCHAR(10), semestre_fim VARCHAR(10),
  versao_modelo_real INT NULL,
  criado_em DATETIME NULL, atualizado_em DATETIME NULL,
  dados_legado JSON NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS alocacoes_pocv (
  id VARCHAR(100) NOT NULL,
  cenario_id VARCHAR(100) NOT NULL,
  matriz_id INT NULL, sequencia INT NULL, curso_id VARCHAR(100),
  semestre_inicio VARCHAR(10), turno VARCHAR(40), horario_turno JSON NULL,
  quantidade INT NULL, vagas INT NULL, periodo_inicio INT NULL, abrangencia INT NULL,
  origem VARCHAR(80), bloqueada BOOLEAN NULL, periodicidade VARCHAR(40),
  alterna_turnos BOOLEAN NULL, turnos_alternados JSON NULL,
  dados_legado JSON NULL,
  PRIMARY KEY (cenario_id, id),
  INDEX idx_alocacao_cenario (cenario_id),
  FOREIGN KEY (cenario_id) REFERENCES cenarios_pocv(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios_autenticacao (
  id VARCHAR(100) PRIMARY KEY,
  docente_id INT NULL,
  usuario VARCHAR(120) NOT NULL UNIQUE,
  nome_exibicao VARCHAR(255), papel VARCHAR(60) NOT NULL,
  hash_senha VARCHAR(255), foto_dados LONGTEXT NULL,
  usuario_suap VARCHAR(120), matricula_suap VARCHAR(120), nome_suap VARCHAR(255), url_foto_suap VARCHAR(1000),
  dados_legado JSON NULL,
  FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS areas_pedagogicas (
  nome VARCHAR(150) PRIMARY KEY,
  descricao TEXT,
  dados_legado JSON NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS grupos_areas_pedagogicas (
  area_nome VARCHAR(150) NOT NULL,
  grupo_nome VARCHAR(120) NOT NULL,
  PRIMARY KEY (area_nome, grupo_nome),
  FOREIGN KEY (area_nome) REFERENCES areas_pedagogicas(nome) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS responsabilidades_distribuicao_grupos (
  grupo_nome VARCHAR(120) PRIMARY KEY,
  docente_id INT NULL,
  area_nome VARCHAR(150),
  FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE SET NULL,
  FOREIGN KEY (area_nome) REFERENCES areas_pedagogicas(nome) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS perfis_acesso (
  papel VARCHAR(60) PRIMARY KEY,
  rotulo VARCHAR(120), semestre_inicio VARCHAR(10), semestre_fim VARCHAR(10),
  versao INT NOT NULL DEFAULT 1,
  dados_legado JSON NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS paginas_acesso (
  papel VARCHAR(60) NOT NULL,
  pagina VARCHAR(120) NOT NULL,
  permissao VARCHAR(20) NOT NULL,
  PRIMARY KEY (papel, pagina),
  FOREIGN KEY (papel) REFERENCES perfis_acesso(papel) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS funcionalidades_acesso (
  papel VARCHAR(60) NOT NULL,
  funcionalidade VARCHAR(120) NOT NULL,
  habilitada BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (papel, funcionalidade),
  FOREIGN KEY (papel) REFERENCES perfis_acesso(papel) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS aprovacoes (
  id VARCHAR(100) PRIMARY KEY,
  status VARCHAR(40) NOT NULL,
  solicitante_id VARCHAR(100), solicitante_nome VARCHAR(255), solicitante_papel VARCHAR(60),
  tipo VARCHAR(60), semestre_codigo VARCHAR(10), chave_alvo VARCHAR(512), acao VARCHAR(60),
  alteracoes JSON NULL, retrato JSON NULL, rotulo_alvo VARCHAR(500),
  observacao_decisao TEXT NULL, decidido_por VARCHAR(255), decidido_por_id VARCHAR(100),
  criado_em DATETIME NULL, decidido_em DATETIME NULL,
  dados_legado JSON NULL,
  INDEX idx_aprovacao_status (status),
  INDEX idx_aprovacao_solicitante (solicitante_id),
  INDEX idx_aprovacao_alvo (semestre_codigo, chave_alvo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notificacoes (
  id VARCHAR(100) PRIMARY KEY,
  usuario_id VARCHAR(100) NOT NULL,
  aprovacao_id VARCHAR(100) NULL,
  titulo VARCHAR(255), mensagem TEXT, lida_em DATETIME NULL,
  criada_em DATETIME NULL,
  dados_legado JSON NULL,
  INDEX idx_notificacao_usuario_lida (usuario_id, lida_em),
  FOREIGN KEY (aprovacao_id) REFERENCES aprovacoes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exclusoes_ofertas (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  semestre_codigo VARCHAR(10) NOT NULL,
  chave_legado VARCHAR(512) NOT NULL,
  aprovacao_id VARCHAR(100), excluida_em DATETIME NULL, excluida_por VARCHAR(100), retrato JSON NULL,
  UNIQUE KEY uq_exclusao_oferta (semestre_codigo, chave_legado),
  FOREIGN KEY (semestre_codigo) REFERENCES semestres(codigo) ON DELETE CASCADE,
  FOREIGN KEY (aprovacao_id) REFERENCES aprovacoes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sistema_metadados (
  chave VARCHAR(120) PRIMARY KEY,
  valor JSON NOT NULL
) ENGINE=InnoDB;
