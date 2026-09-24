# v1.0.161

- Login: substituído o logo do Campus Natal-Zona Norte pelo logo institucional preto do IFRN.
- Login: mantido o ACHA como identidade principal e o logo do IFRN em tamanho reduzido no rodapé.
- Login: criado pequeno espaçamento entre o logo do IFRN e o texto de rodapé para melhorar a leitura.

# ACHA 1.0.160

- Tela de login centralizada, com maior contraste e identidade visual do ACHA.
- Logo oficial do IFRN Campus Natal-Zona Norte posicionada com menor destaque no rodapé.
- Corrigidos os caminhos dos arquivos de logo, agora servidos a partir de `/assets`.
- Login SUAP passa a usar a rota do servidor para construir a autorização, garantindo que a `redirect_uri` usada pelo navegador seja exatamente a configurada no servidor.
- Quando `SUAP_REDIRECT_URI` não for definida, a URI é derivada do domínio/protocolo da requisição, incluindo suporte a Nginx Proxy Manager via `X-Forwarded-Proto` e `X-Forwarded-Host`.
- Docker Compose passou a repassar as variáveis de configuração do SUAP ao container.
- Corrigido o parâmetro `grant_type` para `implicit`.

## 1.0.159
- Tela de login redesenhada sem imagem de fundo.
- Inclusão das marcas oficiais do IFRN e do Campus Natal-Zona Norte.
- Fundo da tela de acesso com maior contraste e tratamento visual institucional.
- Mantido o acesso exclusivamente via SUAP/IFRN.

# v1.0.158

- Acesso ao ACHA exclusivamente pelo SUAP/IFRN.
- Removido da tela de login o formulário de usuário e senha próprios do sistema.
- Endpoint legado de login local bloqueado; não cria mais sessões por usuário/senha do ACHA.
- Removida do Meu Perfil a alteração de senha própria do ACHA.
- Mantida a autenticação institucional via OAuth2 do SUAP/IFRN como única porta de entrada.

# v1.0.156

- Corrigida a associação visual e de status de cada pendência de disciplina optativa à sua própria solicitação.
- Pendências optativas independentes agora não reutilizam a última aprovação/pendência da mesma oferta-base.

# v1.0.154

- Corrige múltiplas pendências independentes de disciplinas optativas na mesma oferta, inclusive no modo de visualização do Diretor.
- O bloqueio de solicitação duplicada passa a considerar a disciplina optativa específica, não a oferta-base.
- Linhas pendentes de optativas também são reconhecidas quando a solicitação é do tipo offer_confirm.
- Impede selecionar duas vezes a mesma disciplina optativa no modal.

# v1.0.153

- Reimplementado o fluxo de demandas avulsas sem Oferta especial, com curso obrigatório nos tipos aplicáveis e lista somente de cursos em oferta no semestre.
- Devoluções permanecem consultáveis sem bloquear a nova validação.
- Cada optativa selecionada gera pendência independente para a Direção.
- Alterações de nome, grupo e curso aprovadas pela Direção retornam para validação final do Coordenador.

# v1.0.152

- Corrigido o layout da tabela Oferta Acadêmica.
- Restaurada a permissão de Edição da Oferta para Coordenador de Curso, recuperando validação e seleção em lote.
- Corrigida a tabela para usar distribuição explícita de colunas e evitar compressão do Curso/Disciplina e espaço vazio.
- Corrigido o alvo da ordenação de colunas para a tabela de ofertas.

# v1.0.148

- Corrige a criação de solicitações independentes para cada disciplina optativa selecionada, permitindo à Direção validar uma, algumas ou todas separadamente.
- Cada pendência de optativa passa a exibir a disciplina optativa individual no item da tela de Pendências.

# v1.0.147

- Cada disciplina optativa selecionada gera uma solicitação independente para validação da Direção.
- A Direção pode aprovar individualmente uma, algumas ou todas as optativas selecionadas.
- Aprovações de optativas são acumuladas na mesma oferta, sem uma aprovação substituir outra.
- Desfazimento de uma aprovação optativa remove apenas aquela disciplina da oferta e retorna sua solicitação para Pendente.

# v1.0.146

- Atualização do tutorial dos Coordenadores com seção completa sobre disciplinas optativas, seleção de múltiplas disciplinas, carga-horária mínima, salvamento e validação pela Direção.


## 1.0.145
- Disponibiliza o tutorial do Coordenador de Curso diretamente no menu lateral do ACHA.
- O tutorial é aberto em nova aba em PDF.
- Acesso ao tutorial liberado para Coordenador de Curso, Coordenação de Área e Direção.
- Incluído o PDF atualizado do Tutorial ACHA para Coordenadores.

## 1.0.143 — Otimização efetiva do modal de detalhes
- Modal de detalhes reorganizado em grade de 4 colunas para desktop.
- Campos compactados em linha (rótulo + valor), reduzindo drasticamente a altura.
- Curso, semestre, turma, turno, disciplina e demais metadados passam a ocupar múltiplas colunas conforme o conteúdo.
- Justificativas e alterações longas permanecem em largura integral.
- Modal dimensionado para a viewport sem rolagem interna para o conjunto normal de dados.
- Layout responsivo: 2 colunas em telas médias e 1 em telas pequenas.
## 1.0.141
- Desfazer decisão da Direção retorna a solicitação para pendente.
- Mantido histórico do desfazimento.
- Coordenador pode desistir da solicitação enquanto pendente.

## 1.0.140
- Ajuste fino dos botões da coluna Decisão da Direção para o mesmo tamanho visual compacto da coluna Ações do Coordenador.
- Botões de validação e menu padronizados em 32px, com tipografia e espaçamento equivalentes.

# v1.0.138

- Corrigida abertura de detalhes pelo menu da Direção.
- Reorganizada a tabela de pendências com data/solicitante, turma, turno e curso.
- Removida a coluna Tipo.
- Reduzida a tipografia dos botões/menu da Direção para o padrão do Coordenador.

# v1.0.138

- Corrigida abertura de detalhes no menu da Direção.
- Redesenhada a tabela de pendências: data/solicitante unificados; removido tipo; adicionadas turma, turno e curso.
- Ações da Direção permanecem exclusivamente no menu, com tipografia compacta.

## 1.0.136
- Padroniza a coluna Decisão da Direção com o mesmo layout visual da coluna Ações do Coordenador.
- Ajusta larguras, alinhamento, tipografia, espaçamento e comportamento responsivo da tabela de Pendências.

# v1.0.135

- Corrige o menu do Coordenador para não oferecer desfazer quando a confirmação foi realizada pela Direção.
- Retorna mensagem explícita quando uma confirmação da Direção é enviada ao endpoint de desfazer do Coordenador.

# v1.0.132 — Decisão da Direção no padrão das ações do Coordenador

- Coluna **Decisão** da Direção redesenhada no mesmo padrão visual dos controles de ação do Coordenador: botão `✓`, botão `✕` e menu `…`.
- Ações concluídas passam a oferecer **Desfazer** dentro do menu suspenso, sem ocupar espaço com botão textual.
- `Ver detalhes` também foi incorporado ao menu de ações.
- Menu flutuante usa o mesmo comportamento do menu do Coordenador, escapando de clipping da tabela.
- Layout da coluna de decisão permanece contido na largura disponível.

# ACHA — Changelog

## 1.0.130
- Permite à Direção desfazer ações aprovadas sobre ofertas: confirmação, alteração, exclusão e duplicação.
- A reversão restaura o snapshot anterior da oferta e registra quem/quando desfez a ação.
- A ação desfeita deixa de ser considerada aprovação vigente no fluxo.

v1.0.129
- Ajustado o Panorama de validação por cursos para consolidar matrizes diferentes do mesmo curso.
- Matrizes vigentes do mesmo curso passam a aparecer como uma única linha, por exemplo, Marketing.
- Cursos que possuem simultaneamente oferta Regular e PROEJA continuam separados como `Curso (Regular)` e `Curso (PROEJA)`.
- Filtros de curso passam a usar exatamente essa mesma regra de agrupamento.
## 1.0.126
- Padroniza a identificação visual de cursos com mesmo nome em todo o sistema.
- Comércio passa a aparecer como **Comércio (Regular)** e **Comércio (PROEJA)** quando aplicável.
- Diferencia matrizes/variantes com mesmo nome por modalidade, ano e turno quando necessário.
- Atualiza seletores de curso, Visualizar como, Docentes, Matrizes, POCV, Projeções, Indicadores, Pendências e demais telas que exibem cursos.
- Ignora o nome bruto persistido na oferta quando a matriz permite obter a identificação correta do curso.
- Atualiza cache-busting para 1.0.126.

## v1.0.123 — Restringe alterações após aprovação
- Ofertas aprovadas pelo Coordenador passam a permitir exclusivamente "Desfazer aprovação".
- Interface e backend bloqueiam novas alterações/exclusões em ofertas já aprovadas.
- A mesma regra é aplicada ao modo Direção → Visualizar como Coordenador.

# CHANGELOG

- v1.0.121 — Identifica visualmente alterações pendentes nas ofertas (nome, grupo, optativa, turno, CH e exclusão), mantendo o resumo dentro da largura da página; reduz a largura da coluna de ações e aumenta o contraste dos botões e menus do Coordenador.

## 1.0.119
- Corrige definitivamente o menu de ações do coordenador, renderizando-o fora da tabela para evitar corte e barras de rolagem.

## 1.0.117
- Corrige cache de assets da interface do Coordenador para garantir carregamento das correções de menu e solicitações.

- v1.0.117 — Corrige ações do Coordenador no menu suspenso, posicionamento do menu e identidade do coordenador simulado ao desistir de solicitações.
# CHANGELOG

## 1.0.114
- Reformulação das ações da visão do Coordenador: validar + menu de opções por linha.
- Solicitação de alteração de nome e mudança de grupo com modais específicos.
- Escolha de optativa disponível no menu e atualização imediata do nome exibido enquanto aguarda aprovação.
- Permissões de visualização bloqueiam ações também no backend.

# ACHA v1.0.112

## 1.0.112 — correções do fluxo do coordenador

- Corrige a abertura da janela de demanda avulsa na visão do coordenador.
- Permite solicitar alterações de oferta mesmo quando a única alteração é o turno.
- Corrige o salvamento das optativas para coordenadores, registrando a solicitação para validação.
- A visão do coordenador passa a iniciar com o filtro de status em “Todos”, mantendo as ofertas visíveis após confirmação, alteração ou exclusão.
- Ajusta o botão de limpar filtros para preservar esse comportamento na visão do coordenador.

# ACHA v1.0.111

## 1.0.111 — correção do menu lateral no celular

- corrige o conflito de CSS que mantinha a barra lateral com `display: none` em telas móveis;
- o menu lateral volta a ser exibido ao clicar no botão de menu;
- mantém o backdrop/escurecimento e o fechamento ao clicar fora ou em um item do menu.

# ACHA v1.0.110

## 1.0.110 — porta interna 3000 e acesso via Nginx Proxy Manager

- altera a porta HTTP interna do ACHA de 5000 para 3000;
- remove a publicação da porta no host;
- mantém a porta 3000 disponível na rede Docker para acesso pelo Nginx Proxy Manager;
- atualiza o healthcheck para a porta 3000;
- atualiza a identificação de versão exibida pelo servidor para 1.0.110.

# ACHA v1.0.109

## Deploy Docker — migração inicial para MySQL
- `db.json` passa a ser empacotado na imagem Docker e deixa de depender de volume externo no primeiro deploy.
- Removido o volume `./data:/app/data` do `docker-compose.yml`, que sobrescrevia o `db.json` presente na imagem.
- Removida a exclusão de `data/db.json` do `.dockerignore`, garantindo que o arquivo seja incluído no build.
- Mantida a migração em modo `initial`: o `db.json` é usado como fonte somente quando o banco MySQL ainda não contém dados.
- O MySQL continua sendo a fonte de dados de produção após a migração.

# Changelog

- v1.0.122 — Corrige a ação Validar do Coordenador com acionamento direto do botão e usa a identidade do Coordenador simulado nas operações em modo de visualização da Direção.

## 1.0.115
- Corrige os eventos dos botões de validar e do menu de ações do Coordenador.
- Ativa abertura/fechamento do menu suspenso e execução das ações solicitar exclusão, alteração de nome, mudança de grupo e escolha de optativa.


## 1.0.107 — incluir schema.sql no build Git/Docker

- corrigido o `.gitignore`, que estava ignorando `*.sql` e impedia o `database/schema.sql` de ser versionado no Git;
- `database/schema.sql` passa a ser explicitamente incluído na imagem Docker;
- corrige `Schema não encontrado: /app/database/schema.sql` no primeiro deploy pelo Portainer;
- mantém o fluxo schema → migração inicial → aplicação.


## 1.0.106 — correção do build no Portainer

- removido `image: acha:...` do Compose;
- Portainer volta a construir a imagem diretamente do repositório Git configurado na Stack;
- elimina o erro `pull access denied for acha`;
- mantém o primeiro deploy no mesmo container: schema → migração inicial → aplicação;
- adicionada variável `ACHA_DATA_PATH` para disponibilizar o `db.json` sem versioná-lo no Git;
- mantém `5002:5000` e as redes externas.


## 1.0.105 — Docker/Portainer: inicialização em container único

- removidos os serviços `acha-schema` e `acha-migrate` do Compose;
- schema e migração inicial passam a ser executados pelo entrypoint do próprio ACHA;
- evita que Portainer tente fazer pull de imagens intermediárias como `acha-acha-migrate`;
- mantém MySQL externo;
- mantém `5002:5000`;
- primeira inicialização: schema → migração segura → aplicação;
- redeploy: se o banco já estiver populado, a migração inicial não limpa nem recarrega os dados.


## 1.0.104 — primeiro deploy MySQL: schema + migração inicial

- o Compose passa a executar três etapas na ordem: `acha-schema` → `acha-migrate` → `acha`;
- a primeira migração usa `data/db.json` como fonte;
- a migração inicial é protegida: se o banco já contiver dados completos, não limpa nem migra novamente;
- se o banco estiver parcialmente preenchido, a migração é interrompida para evitar perda de dados;
- o ACHA só inicia depois da conclusão bem-sucedida da migração inicial;
- `acha-migrate` monta `./data` em modo somente leitura;
- permanece o MySQL externo, sem serviço `mysql:` no Compose;
- porta externa `5002` e porta interna `5000`.


## 1.0.103 — inicialização resiliente do schema MySQL

- o ACHA passa a verificar/criar o schema antes da primeira leitura do MySQL;
- `readDatabase()` não depende mais exclusivamente do serviço `acha-schema` do Docker Compose;
- mantém-se o serviço `acha-schema` como inicialização explícita do deploy;
- corrige o cenário em que o container ACHA inicia com o banco criado, mas sem as tabelas `semestres` e demais tabelas do schema;
- inicialização continua idempotente com `CREATE TABLE IF NOT EXISTS`.


## 1.0.102 — compactação da tabela de projeção

- grade de carga horária passa a ocupar toda a largura disponível;
- colunas de semestre ficam compactadas para exibir o período completo em telas desktop;
- rolagem horizontal é preservada apenas para telas menores, mantendo legibilidade;
- tabela de ofertas recebe o mesmo comportamento de largura no desktop.


## 1.0.100 — correção POCV/projeção

- restauradas as funções auxiliares da POCV removidas durante a limpeza do pacote;
- corrigidos `ensurePocvScenarios`, `buildInitialPocvScenario` e `normalizePocvScenario`;
- restaurados `matrixDuration` e `cohortTurn` necessários à projeção;
- corrige o erro `ensurePocvScenarios is not defined` na página de Cenários;
- a Projeção volta a receber os cenários e ofertas reconstruídos do MySQL.


## 1.0.99 — Docker + inicialização do schema MySQL

- porta externa `5002` e porta interna `5000`;
- serviço `acha-schema` para inicialização idempotente do schema;
- MySQL continua sendo externo e compartilhado;
- ACHA depende da conclusão bem-sucedida do inicializador de schema;
- redes externas `database_network` e `proxy_network` mantidas;
- nenhum dado é apagado pelo inicializador do schema;
- adicionada documentação do fluxo de produção.


## 1.0.98 — migração seletiva de docentes

- adicionada `npm run migrate:mysql:docentes`;
- migração lê `DB_FILE` e trabalha exclusivamente com `teachers` → `docentes`;
- atualização por ID com inserção de novos docentes;
- remoção de docentes ausentes no backup;
- operação transacional com rollback em caso de erro;
- demais tabelas não são alteradas;
- versão preparada para versionamento Git;
- `.gitignore` reforçado para não versionar credenciais, dados persistidos, backups e arquivos ZIP;
- Docker ajustado para porta 5001 e redes externas `database_network` e `proxy_network`;
- Docker não cria instância MySQL própria.

# ACHA 1.0.96

- Corrigido o parser JSON das requisições HTTP (`body(req)`), necessário ao login SUAP e demais endpoints POST/PUT.
- Mantida a arquitetura MySQL como fonte única.

# ACHA — Changelog

## 1.0.95 — correção do endpoint JSON
- Corrigida a função `send()` ausente no servidor, que causava `ReferenceError` nas APIs.
- Mantida a arquitetura MySQL como fonte única operacional.
- Mantidos backups JSON apenas para recuperação/compatibilidade.

# CHANGELOG

## 1.0.95

- MySQL passa a ser a fonte única de dados operacionais.
- Estado inicial da aplicação é carregado do MySQL antes de abrir a porta HTTP.
- Removido fallback silencioso para `db.json` na leitura operacional.
- `db.json` passa a ser exclusivamente snapshot de recuperação/compatibilidade.
- Gravações atualizam o snapshot JSON somente após sucesso da transação MySQL.
- Falha definitiva de persistência recarrega o estado do MySQL para evitar manter no cache uma alteração não persistida.
- Docker/Compose passam a declarar `mysql2` e as variáveis `MYSQL_*` corretamente.
- Versão HTTP/terminal atualizada para 1.0.95.

# Changelog

## 1.0.107 — incluir schema.sql no build Git/Docker

- corrigido o `.gitignore`, que estava ignorando `*.sql` e impedia o `database/schema.sql` de ser versionado no Git;
- `database/schema.sql` passa a ser explicitamente incluído na imagem Docker;
- corrige `Schema não encontrado: /app/database/schema.sql` no primeiro deploy pelo Portainer;
- mantém o fluxo schema → migração inicial → aplicação.


## 1.0.106 — correção do build no Portainer

- removido `image: acha:...` do Compose;
- Portainer volta a construir a imagem diretamente do repositório Git configurado na Stack;
- elimina o erro `pull access denied for acha`;
- mantém o primeiro deploy no mesmo container: schema → migração inicial → aplicação;
- adicionada variável `ACHA_DATA_PATH` para disponibilizar o `db.json` sem versioná-lo no Git;
- mantém `5002:5000` e as redes externas.


## 1.0.105 — Docker/Portainer: inicialização em container único

- removidos os serviços `acha-schema` e `acha-migrate` do Compose;
- schema e migração inicial passam a ser executados pelo entrypoint do próprio ACHA;
- evita que Portainer tente fazer pull de imagens intermediárias como `acha-acha-migrate`;
- mantém MySQL externo;
- mantém `5002:5000`;
- primeira inicialização: schema → migração segura → aplicação;
- redeploy: se o banco já estiver populado, a migração inicial não limpa nem recarrega os dados.


## 1.0.104 — primeiro deploy MySQL: schema + migração inicial

- o Compose passa a executar três etapas na ordem: `acha-schema` → `acha-migrate` → `acha`;
- a primeira migração usa `data/db.json` como fonte;
- a migração inicial é protegida: se o banco já contiver dados completos, não limpa nem migra novamente;
- se o banco estiver parcialmente preenchido, a migração é interrompida para evitar perda de dados;
- o ACHA só inicia depois da conclusão bem-sucedida da migração inicial;
- `acha-migrate` monta `./data` em modo somente leitura;
- permanece o MySQL externo, sem serviço `mysql:` no Compose;
- porta externa `5002` e porta interna `5000`.


## 1.0.103 — inicialização resiliente do schema MySQL

- o ACHA passa a verificar/criar o schema antes da primeira leitura do MySQL;
- `readDatabase()` não depende mais exclusivamente do serviço `acha-schema` do Docker Compose;
- mantém-se o serviço `acha-schema` como inicialização explícita do deploy;
- corrige o cenário em que o container ACHA inicia com o banco criado, mas sem as tabelas `semestres` e demais tabelas do schema;
- inicialização continua idempotente com `CREATE TABLE IF NOT EXISTS`.


## 1.0.102 — compactação da tabela de projeção

- grade de carga horária passa a ocupar toda a largura disponível;
- colunas de semestre ficam compactadas para exibir o período completo em telas desktop;
- rolagem horizontal é preservada apenas para telas menores, mantendo legibilidade;
- tabela de ofertas recebe o mesmo comportamento de largura no desktop.


## 1.0.100 — correção POCV/projeção

- restauradas as funções auxiliares da POCV removidas durante a limpeza do pacote;
- corrigidos `ensurePocvScenarios`, `buildInitialPocvScenario` e `normalizePocvScenario`;
- restaurados `matrixDuration` e `cohortTurn` necessários à projeção;
- corrige o erro `ensurePocvScenarios is not defined` na página de Cenários;
- a Projeção volta a receber os cenários e ofertas reconstruídos do MySQL.
 — ACHA

## 1.0.93
- Define o MySQL como fonte primária de persistência.
- `writeDB()` deixa de atualizar o `db.json` antes da gravação; a transação MySQL é executada primeiro.
- O `db.json` passa a ser mantido como cópia de recuperação/compatibilidade somente após sucesso no MySQL.
- Cria backups automáticos em `data/backups/` após sincronizações bem-sucedidas.
- Adiciona `npm run backup:mysql` para exportar manualmente o estado atual do MySQL para JSON.
- Mantém o mecanismo de retry da sincronização e o endpoint `/api/mysql/status`.

## 1.0.92
- Avança a migração para MySQL como fonte efetiva de leitura da API.
- Remove a sobreposição silenciosa das estruturas operacionais pelo `db.json` quando o modo MySQL está ativo.
- A API aguarda a sincronização MySQL pendente antes de realizar novas leituras.
- Persiste `extraOffers` e `pocvConfig` em `sistema_metadados` para não depender desses dados exclusivamente do JSON.
- Atualiza o identificador de versão exibido pelo servidor e pelo backup.

## 1.0.91
- Corrige a persistência imediata das confirmações críticas no MySQL.
- Confirmação direta de oferta agora salva no JSON e aguarda a sincronização MySQL antes de responder sucesso.
- Em falha do MySQL, mantém o JSON e agenda nova tentativa.
- Adiciona `/api/mysql/status` para diagnóstico do último estado de sincronização.
- Adiciona `npm run test:mysql:sync` para verificar ofertas e confirmações no MySQL.

## v1.0.113 — Permissões por configuração na visão Coordenador

- A visualização de Coordenador pela Direção passa a usar a configuração real de acesso do perfil, sem forçar Edição.
- Perfil com Visualização não exibe ações de cadastro, edição, exclusão, validação, seleção em lote ou salvamento.
- Perfil com Edição mantém as ações e permite salvar normalmente.
- O modo "Visualizar como" também respeita o nível configurado no backend, impedindo mutações quando o perfil simulado é somente leitura.

## 1.0.125
- Dashboard da Direção: Panorama de validação filtrado por semestre.
- Percentuais de validação passam a considerar as ofertas efetivamente aprovadas/confirmadas e são recalculados automaticamente.
- Dashboard atualiza os dados do panorama periodicamente sem exigir recarregamento manual.
- Tabela do panorama exibe somente o semestre selecionado, mantendo a largura da página.

## v1.0.133
- Padronizada a coluna Decisão da Direção com o mesmo componente visual de ações do Coordenador.
- Aprovação usa o botão ✓ no padrão teal; demais ações ficam no menu ⋯.
- Removido o botão X direto da coluna para evitar diferença de interação.
- Notas de decisão deixam de ocupar a coluna; detalhes e correção ficam no menu.
- Ajustadas larguras da tabela para evitar estouro horizontal.

## 1.0.144
- Corrigido o fluxo de desfazimento das decisões da Direção: confirmação, exclusão, alteração e duplicação retornam a solicitação para `pending`.
- Mantido o vínculo com o coordenador solicitante para permitir nova avaliação ou desistência.
- Adicionada normalização de registros legados que estavam marcados como `undone`, convertendo-os para `pending` quando decorrentes de desfazimento da Direção.
- Removido o status visual legado "Desfeitas" da página de Pendências.
