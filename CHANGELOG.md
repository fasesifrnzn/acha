# Changelog

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
