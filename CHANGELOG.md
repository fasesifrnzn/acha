## 1.0.13 — Preparação para commit

### Docker
- Container principal conectado às redes externas `database_network` e `proxy_network`.
- Redes declaradas como `external: true` no `docker-compose.yml`.
- Documentação atualizada para esclarecer que a associação das redes ocorre no runtime/Compose.

### Integridade do pacote
- Mantida a estrutura completa da aplicação.
- Mantidos `Iniciar-ACHA.bat`, `data/db.json`, servidor, páginas, estilos e documentação.

# v1.0.11

- Metas docentes do Dashboard comparadas em hora-relógio (1 h/a = 0,75 h).
- Alertas do Dashboard abrem a Oferta com semestre, grupo e problema filtrados.
- POCV: coortes alternadas de Manutenção Integrado e Artesanato passam a ser renderizadas estritamente pela faixa da própria coorte.
- Matrizes atualizadas conforme a tabela de referência de indicadores.

## 1.0.6 — 2026-09-01

- Matrizes curriculares passaram a armazenar os campos necessários para o Plano de Oferta/Indicadores: campus, formato da oferta, organização, tipo de participação, fomento externo, carga horária anualizada em horas de relógio, verticalização, diretoria acadêmica responsável e FCC.
- Os campos são editáveis na tela de Matrizes e persistidos no banco, com valores iniciais preenchidos para as matrizes existentes.
- Indicadores passou a apresentar o detalhamento do plano de oferta por matriz, com os campos cadastrais e vagas por semestre/turno calculadas a partir do cenário selecionado.
- Carga horária anualizada é exibida em horas de relógio e em números inteiros.

## 1.0.2 — Cenários protegidos e gestão de ofertas
## 1.0.5 — 2026-09-01

- Corrigida a simulação de Manutenção Integrado + Artesanato 2028: novas coortes anuais alternam entre vespertino e matutino, iniciando no vespertino.
- Mantida a retirada das entradas diurnas de Manutenção e Suporte em Informática (subsequente) a partir de 2028.
- POCV: criação de ofertas em novos cenários passou a permitir alternância de turno nas novas coortes.
- Criada a nova página `indicadores.html`, estruturada a partir da aba Indicadores da planilha e integrada ao design do ACHA.
- Indicadores passam a ser calculados por cenário e intervalo de semestres, com metas de referência e indicação explícita de dados não disponíveis para fórmulas que dependem de bases externas.
- Menu lateral atualizado com Indicadores.


- Cenário real bloqueado para edição, movimentação, exclusão e limpeza.
- Criação de cenários em modal, em branco ou clonados de cenário existente.
- Definição do período inicial/final do novo cenário.
- Inclusão de ofertas no momento da criação por curso, semestre inicial, periodicidade e turno.
- Lista dos cursos/ofertas já presentes no cenário, com remoção a partir de semestre selecionado.
- API impede alterações acidentais no cenário real.

# Changelog

## 1.0.1 — 2026-09-01

- Dashboard: tabela de distribuição por grupo compactada, sem as colunas Em função, Afastados e Substitutos.
- Carga horária em h/a: apresentação padronizada como número inteiro, com arredondamento.
- Criadas as funções de apoio à gestão sem redução de sala de aula: Assessor Pedagógico de Área: Ciências da Natureza e Assessor Pedagógico de Área: Linguagens e Humanidades.
- Manoel Prudente de Almeida Neto definido como responsável por Biologia, Física e Química.
- Luiz Henrique Felicio do Nascimento definido como responsável por Artes, Educação Física, Espanhol, Filosofia, Geografia, História, Inglês, Português e Sociologia.
- Responsabilidades por grupo registradas na base de dados e apresentadas na tela de Grupos.


## 1.0.1 — 2026-09-01

- Dashboard com distribuição por grupo em tabela compacta, removendo as colunas Em função, Afastados e Substitutos.
- Carga horária (h/a) exibida sempre como número inteiro, com arredondamento na interface.
- Criadas as funções de apoio à gestão **Assessor Pedagógico de Área: Ciências da Natureza** e **Assessor Pedagógico de Área: Linguagens e Humanidades**, sem redução de carga de sala de aula.
- Manoel Prudente de Almeida Neto vinculado à assessoria de Ciências da Natureza, responsável pelos grupos Biologia, Física e Química.
- Luiz Henrique Felicio do Nascimento vinculado à assessoria de Linguagens e Humanidades, responsável pelos grupos de Artes, Educação Física, Espanhol, Filosofia, Geografia, História, Inglês, Português e Sociologia.
- Responsabilidades de distribuição registradas na base para permitir uso posterior no controle de acesso e nas telas de distribuição.

# Changelog

## 1.0.1 — 2026-09-01

- Dashboard: tabela de distribuição por grupo compactada, sem as colunas Em função, Afastados e Substitutos.
- Carga horária em h/a: apresentação padronizada como número inteiro, com arredondamento.
- Criadas as funções de apoio à gestão sem redução de sala de aula: Assessor Pedagógico de Área: Ciências da Natureza e Assessor Pedagógico de Área: Linguagens e Humanidades.
- Manoel Prudente de Almeida Neto definido como responsável por Biologia, Física e Química.
- Luiz Henrique Felicio do Nascimento definido como responsável por Artes, Educação Física, Espanhol, Filosofia, Geografia, História, Inglês, Português e Sociologia.
- Responsabilidades por grupo registradas na base de dados e apresentadas na tela de Grupos.


## ACHA 1.0.0 — consolidação após v17

Esta versão reúne o desenvolvimento realizado depois da última versão historicamente commitada como v17 e estabelece o ACHA como nome oficial do sistema.

### Funcionalidades consolidadas

- evolução da oferta acadêmica e das projeções de carga horária;
- correções de coortes, duração e alternância de matrizes;
- normalização de grupos e cursos;
- projeções por grupo, semestre, turno e cenário;
- cenários plurianuais da oferta;
- melhorias de visualização e navegação;
- gestão de docentes, vínculos, substitutos e visitantes;
- matrícula institucional no cadastro de docentes;
- perfis de acesso por função;
- filtragem da área acadêmica para coordenadores por curso;
- integração OAuth2 com SUAP/IFRN;
- consulta à rota oficial `GET /api/rh/meus-dados/`;
- associação automática do usuário SUAP ao cadastro local por matrícula;
- carregamento da foto institucional do SUAP no perfil;
- correção do carregamento de CSS e recursos públicos antes da autenticação;
- tela de login com CSS isolado e identidade visual ACHA;
- configuração para execução local e implantação Docker/Portainer.

### Limpeza para versionamento

Foram removidos da árvore principal arquivos de teste, logs/diagnósticos, backups, versões intermediárias e cópias pré-migração que serviam apenas ao desenvolvimento incremental.

As informações históricas relevantes foram consolidadas neste arquivo e na documentação principal.

## 1.0.12
- Indicadores: removido o quadro "PLANO DE OFERTA — MATRIZES DO CENÁRIO".
- Indicadores: classificação de PROEJA/EJA ampliada para reconhecer formas EJA e PROEJA nos dados das matrizes.
- Indicadores: percentuais legais/institucionais agora são clicáveis e exibem, em modal, as ofertas consideradas no cálculo por semestre.
- Mantido o cálculo sobre as ofertas/coortes ativas do cenário selecionado.
