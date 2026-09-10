# v1.0.48 — Gerenciamento de acesso

- Adicionado módulo **Gerenciamento de acesso** (`acessos.html`) para Diretor Geral e Diretoria Acadêmica.
- Permissões configuráveis por perfil e página: **Sem acesso**, **Visualização** ou **Edição**.
- Intervalo de semestres configurável por perfil; Coordenador de Curso recebe apenas os semestres definidos no perfil.
- Quadro **Previsão de carga-horária** em Oferta controlado por permissão específica e desativado por padrão para Coordenador de Curso.
- Autorização aplicada no servidor para páginas e operações de edição, evitando que a restrição dependa apenas da interface.
- Banco de dados atualizado com o backup fornecido em 10/09/2026 às 17:27.

# v1.0.47 — Remoção da visão por semestre na Projeção

- Removido o quadro “Visão por semestre” da página Projeção por ser redundante e pouco intuitivo.
- Mantida a visualização principal “Carga horária por grupo e semestre”, que concentra a informação detalhada por grupo e semestre.

# v1.0.46 — Preferência de exibição do quadro de ofertas

- Adiciona controle **Ocultar/Mostrar** ao quadro “Ofertas por curso e semestre” da página Projeção.
- Persiste a última preferência no `localStorage` do navegador.
- A preferência é restaurada automaticamente ao reabrir a página.

# v1.0.41

- Corrige cache do app.js em todas as páginas, evitando que o navegador execute a lógica antiga de turnos.
- A Oferta continua derivando o turno exclusivamente da turma, nunca do campo salvo da disciplina.
- Mantém a resolução de turnos por matriz/período/sequência com fallback para matriz vigente do mesmo curso.

## 1.0.40 — Oferta vinculada ao turno da turma

- A POCV recalcula o turno de cada placement por semestre a partir da turma (matriz, período e sequência), em vez de confiar em `A definir` ou em turno persistido.
- Segmentos da POCV passam a acompanhar corretamente mudanças de turno entre períodos.
- O segundo editor de oferta também deixa o turno somente leitura.

## 1.0.39 — Turno da oferta sempre herdado da turma

- A tabela **Oferta** passa a usar exclusivamente o turno calculado da turma para cada disciplina.
- Registros antigos de `db.offers` com `A definir` ou turno divergente são normalizados no carregamento dos dados.
- A API de edição de oferta ignora alterações manuais de turno e grava o turno correspondente à turma.
- A Projeção passa a usar a mesma resolução de turno da tela de Turmas, inclusive para matrizes antigas.
- O campo de turno no editor da Oferta fica somente leitura.

# v1.0.38

- Corrigida a determinação de turno das turmas por período: quando não existe chave exata, utiliza a regra anterior aplicável.
- Matrizes antigas sem configuração própria de turno passam a utilizar a configuração da matriz vigente do mesmo curso.
- A mesma regra foi aplicada às telas Turmas, Oferta, Alocação, Dashboard, Projeção por turno e POCV.
- Cenário real da POCV atualizado para regenerar os turnos com a nova regra.

# v1.0.37

- Adicionado menu **Backup** para Direção-Geral e Direção Acadêmica.
- Adicionado `GET /api/backup`, que baixa o `db.json` completo e atual do servidor.
- O arquivo é gerado com nome contendo data/hora e sem cache.
- Backup restrito aos perfis de direção; coordenadores de curso não têm acesso.

## 1.0.36

- Corrigida a projeção de cenários para preservar todos os turnos cadastrados na oferta real para a mesma coorte, incluindo Manutenção e Suporte em Informática Integrado Matutino e Vespertino.

## 1.0.36
- Corrige o carregamento da página Docentes com tratamento de sessão, timeout e cache-busting do editor.
- Torna a leitura da ordem das colunas resistente a dados inválidos no localStorage.

## 1.0.31
- Vinculada a servidora Fabrícia Abrantes Figueiredo da Rocha à matrícula SUAP 1213852, mantendo o perfil Diretora Acadêmica para autenticação via SUAP.

# Changelog

## 1.0.31

- Indicadores: Licenciatura passou a ser considerada em Formação de professores mesmo quando a matriz histórica não possui o tipo preenchido.
- Indicadores: Auxiliar em Operador de Computador e Auxiliar em Eletricista classificados como Técnico com recorte PROEJA FIC Fundamental, deixando de entrar em Outras Ofertas.


## 1.0.25

- Oferta: incorporada a previsão de carga-horária com opção de ocultar/exibir.
- Menu: ocultadas Projeção por turno e Projeção por semestre; Projeção por cenário renomeada para Projeção.
- Menu: Alocação renomeada para Alocação.
- Oferta: filtros não são mais reconstruídos ao alterar Período; a atualização dos filtros ocorre apenas ao trocar o semestre.
- Docentes: incluída Capacitação parcial – 50%, com fator de 50% e sem direito a substituto.
- Previsão de carga-horária: índice de docentes inferior a 1 não divide a carga horária.

# v1.0.24 — Correções finais de matrizes, docentes e variação de cenário

- Revisão das matrizes de Manutenção: remoção de disciplinas classificadas como Seminário e de Orientação ao Desenvolvimento do Projeto Integrador, quando existentes.
- Página Docentes: tabela com rolagem horizontal em qualquer largura de tela e coluna Ações fixada à direita para manter edição/exclusão acessíveis.
- Projeção por cenário: variações frente ao cenário Real exibidas com seta ↑ para aumento e ↓ para redução; sem indicação quando não há alteração.

# v1.0.23 — Correções de projeção e indicadores

- Corrigido erro `delta is not defined` na Projeção por cenário, que interrompia a renderização ao alternar cenários.
- A troca de cenário agora atualiza a identificação e a grade de projeção com os dados do cenário selecionado.
- Corrigida a classificação de `% Outras ofertas`: valores estritamente menores que 20% atendem à meta e ficam verdes.
- Garantida a remoção de disciplinas de Seminário/Projeto Integrador das matrizes de Manutenção.

# ACHA v1.0.21 — Ajustes de turnos, matrizes, indicadores e projeção

- Corrigidos turnos pendentes nas turmas FIC e incluídas referências de turno para as matrizes de simulação 21 e 22.
- Removidas disciplinas de Seminário das matrizes de Comércio e de Manutenção que continham componentes com essa denominação.
- Corrigido o cálculo de **% Outras ofertas**, incluindo o valor no retorno do cálculo anual dos indicadores.
- Na Projeção por cenário, o cumprimento da faixa de carga passa a destacar a célula inteira por estado, e não apenas por um indicador lateral discreto.
- Em cenários de simulação, cada célula mostra a variação da média do grupo no semestre em relação ao cenário real (Δ para cima/baixo).
- Ajustadas as larguras das colunas da tela Oferta para que as colunas finais, inclusive Ações, permaneçam visíveis.

# CHANGELOG

## 1.0.20
- `data/db.json` passa a ser a fonte de dados versionada no Git durante a fase anterior à migração para MySQL.
- Docker passa a usar `/app/data/db.json` diretamente, sem o volume `acha_data`.
- Evita que um volume Docker antigo mantenha dados diferentes daqueles presentes no commit.
- Mantém as redes externas `database_network` e `proxy_network`.
- Mantém os dados completos da versão 1.0.19, incluindo cenários POCV, matrizes, ofertas, docentes e usuários.

# ACHA v1.0.19 — Identificação da FaSEs na tela de login

- Adicionada à tela inicial de login a identificação institucional de que o sistema é desenvolvido pela **FaSEs — Fábrica de Software Escola**, do Campus Natal-Zona Norte do IFRN.
- Mantido o layout e a identidade visual existentes.

# 1.0.18 — Indicadores: metas e legibilidade

- Metas dos indicadores atualizadas: Técnico ≥ 60%, PROEJA ≥ 10%, Formação de Professores ≥ 20% e Outras Ofertas < 20%.
- Indicadores passam a exibir status visual por ano (verde, amarelo e vermelho).
- Incluído percentual de Outras Ofertas com detalhamento clicável das ofertas consideradas.
- Primeira coluna das tabelas ampliada para melhorar a leitura dos nomes das formas de oferta.
- Mantida a regra de MEq = vagas de entrada × (carga horária anualizada / 800).

## 1.0.16 — Indicadores calculados em todos os anos do cenário

- Criada uma função única de cálculo anual dos indicadores.
- A mesma fórmula é executada independentemente para cada ano do período do cenário selecionado.
- A continuidade de uma oferta em outro semestre não é contada como nova entrada.
- A troca de cenário recalcula todo o período do cenário escolhido.
- Mantidas as regras de MEq = vagas de entrada × CH anualizada / 800.

## Indicadores — refatoração dos cálculos

- Página de Indicadores refeita a partir das regras definidas na conversa.
- MEq = vagas de entrada × (CH anualizada / 800).
- Cálculo anual por coorte de entrada, sem duplicar continuidade semestral.
- Técnico, PROEJA e Formação de professores calculados em MEq.
- Vagas noturnas calculadas em vagas físicas.
- Percentuais clicáveis mostram as ofertas consideradas no numerador.
- Metas exibidas também como faixa/quantidade de MEq necessária.
- Mantido o cenário de Manutenção Subsequente + Artesanato.
- PROEJA tratado como recorte da oferta; não é somado novamente ao total geral.

## 1.0.15 — Atualização dos indicadores

- Formalizada a regra de matrícula equivalente: vagas × CH anualizada / 800.
- Separadas vagas de entrada e matrícula equivalente.
- Mantido o cenário de Artesanato subsequente sem nova entrada de Manutenção Integrado.

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


# v1.0.24 — Correções finais de matrizes, docentes e variação de cenário

- Revisão das matrizes de Manutenção: remoção de disciplinas classificadas como Seminário e de Orientação ao Desenvolvimento do Projeto Integrador, quando existentes.
- Página Docentes: tabela com rolagem horizontal em qualquer largura de tela e coluna Ações fixada à direita para manter edição/exclusão acessíveis.
- Projeção por cenário: variações frente ao cenário Real exibidas com seta ↑ para aumento e ↓ para redução; sem indicação quando não há alteração.

# v1.0.23 — Correções de projeção e indicadores

- Corrigido erro `delta is not defined` na Projeção por cenário, que interrompia a renderização ao alternar cenários.
- A troca de cenário agora atualiza a identificação e a grade de projeção com os dados do cenário selecionado.
- Corrigida a classificação de `% Outras ofertas`: valores estritamente menores que 20% atendem à meta e ficam verdes.
- Garantida a remoção de disciplinas de Seminário/Projeto Integrador das matrizes de Manutenção.

# ACHA v1.0.21 — Ajustes de turnos, matrizes, indicadores e projeção

- Corrigidos turnos pendentes nas turmas FIC e incluídas referências de turno para as matrizes de simulação 21 e 22.
- Removidas disciplinas de Seminário das matrizes de Comércio e de Manutenção que continham componentes com essa denominação.
- Corrigido o cálculo de **% Outras ofertas**, incluindo o valor no retorno do cálculo anual dos indicadores.
- Na Projeção por cenário, o cumprimento da faixa de carga passa a destacar a célula inteira por estado, e não apenas por um indicador lateral discreto.
- Em cenários de simulação, cada célula mostra a variação da média do grupo no semestre em relação ao cenário real (Δ para cima/baixo).
- Ajustadas as larguras das colunas da tela Oferta para que as colunas finais, inclusive Ações, permaneçam visíveis.

# CHANGELOG

## 1.0.20
- `data/db.json` passa a ser a fonte de dados versionada no Git durante a fase anterior à migração para MySQL.
- Docker passa a usar `/app/data/db.json` diretamente, sem o volume `acha_data`.
- Evita que um volume Docker antigo mantenha dados diferentes daqueles presentes no commit.
- Mantém as redes externas `database_network` e `proxy_network`.
- Mantém os dados completos da versão 1.0.19, incluindo cenários POCV, matrizes, ofertas, docentes e usuários.

# ACHA v1.0.19 — Identificação da FaSEs na tela de login

- Adicionada à tela inicial de login a identificação institucional de que o sistema é desenvolvido pela **FaSEs — Fábrica de Software Escola**, do Campus Natal-Zona Norte do IFRN.
- Mantido o layout e a identidade visual existentes.

# 1.0.18 — Indicadores: metas e legibilidade

- Metas dos indicadores atualizadas: Técnico ≥ 60%, PROEJA ≥ 10%, Formação de Professores ≥ 20% e Outras Ofertas < 20%.
- Indicadores passam a exibir status visual por ano (verde, amarelo e vermelho).
- Incluído percentual de Outras Ofertas com detalhamento clicável das ofertas consideradas.
- Primeira coluna das tabelas ampliada para melhorar a leitura dos nomes das formas de oferta.
- Mantida a regra de MEq = vagas de entrada × (carga horária anualizada / 800).

## 1.0.16 — Indicadores calculados em todos os anos do cenário

- Criada uma função única de cálculo anual dos indicadores.
- A mesma fórmula é executada independentemente para cada ano do período do cenário selecionado.
- A continuidade de uma oferta em outro semestre não é contada como nova entrada.
- A troca de cenário recalcula todo o período do cenário escolhido.
- Mantidas as regras de MEq = vagas de entrada × CH anualizada / 800.

## Indicadores — refatoração dos cálculos

- Página de Indicadores refeita a partir das regras definidas na conversa.
- MEq = vagas de entrada × (CH anualizada / 800).
- Cálculo anual por coorte de entrada, sem duplicar continuidade semestral.
- Técnico, PROEJA e Formação de professores calculados em MEq.
- Vagas noturnas calculadas em vagas físicas.
- Percentuais clicáveis mostram as ofertas consideradas no numerador.
- Metas exibidas também como faixa/quantidade de MEq necessária.
- Mantido o cenário de Manutenção Subsequente + Artesanato.
- PROEJA tratado como recorte da oferta; não é somado novamente ao total geral.

## 1.0.15 — Atualização dos indicadores

- Formalizada a regra de matrícula equivalente: vagas × CH anualizada / 800.
- Separadas vagas de entrada e matrícula equivalente.
- Mantido o cenário de Artesanato subsequente sem nova entrada de Manutenção Integrado.

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

## v1.0.17
- Corrigida a apresentação dos indicadores anuais: todos os anos do cenário permanecem visíveis e calculados.
- Corrigida a cor dos percentuais sem faixa de meta cadastrada, que estavam sendo renderizados em branco.
- Tabelas anuais passam a usar layout fixo responsivo para exibir todas as colunas no desktop e rolagem horizontal apenas quando necessária.

## 1.0.22
- Corrigida a troca de cenário na Projeção por cenário, com atualização forçada dos semestres e da grade.
- Corrigida a regra de % Outras ofertas: qualquer valor < 20% atende à meta.
- Removida a disciplina Orientação ao Desenvolvimento do Projeto Integrador das matrizes de Manutenção e os componentes de Seminário das matrizes de Comércio Integrado.
- Definidos como Noite os turnos anteriormente A definir do Auxiliar em Eletricista, replicando a definição em todos os cenários.

## 1.0.46 — 2026-09-10
- Corrigida a escala visual das barras de Média semestral na Previsão de carga-horária: todas as barras agora usam a mesma escala proporcional, permitindo comparar corretamente as cargas entre grupos.
- Padronizado o arredondamento das extremidades das barras.
- Evitado o corte irregular das barras nas células da tabela.

## 1.0.43 — 2026-09-10
- Atualizado `data/db.json` com o backup atual obtido do ACHA online em 2026-09-10.
- Mantida a correção de determinação do turno por turma implementada na 1.0.42.
- Atualização de versão/cache para 1.0.43.
