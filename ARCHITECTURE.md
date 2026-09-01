# Arquitetura do ACHA

## Visão geral

O ACHA é uma aplicação web Node.js, sem framework backend adicional. O frontend é composto por HTML, CSS e JavaScript e é servido pelo `server.js`.

A aplicação utiliza uma arquitetura simples de servidor HTTP + API JSON + frontend estático.

## Dados

A fonte única de dados acadêmicos é `data/db.json`.

As páginas não mantêm cópias embutidas do banco. O `server.js` fornece os dados por API e persiste as alterações no arquivo JSON.

Em produção, `DB_FILE` deve apontar para armazenamento persistente.

## Autenticação

O SUAP autentica o usuário institucional. Após receber o `access_token`, o ACHA consulta:

```text
GET /api/rh/meus-dados/
```

O resultado é associado ao cadastro local por matrícula. A partir desse cadastro, o ACHA determina o perfil e, quando aplicável, o curso do coordenador.

O frontend recebe uma sessão do ACHA; o token OAuth não deve permanecer exposto na URL após o processamento do retorno.

## Autorização

A autenticação e a autorização são responsabilidades distintas:

1. SUAP confirma a identidade institucional;
2. ACHA localiza o usuário pelo vínculo cadastrado;
3. ACHA aplica o papel (`diretor_geral`, `diretoria_academica` ou `coordenador_curso`);
4. coordenadores têm seus dados acadêmicos filtrados pelo curso associado.

## Interface

`app.js` concentra recursos compartilhados, incluindo navegação, identificação do usuário e utilitários de normalização e visualização.

`style.css` contém o estilo global das páginas autenticadas. A tela `login.html` possui CSS isolado para evitar que o layout da aplicação autenticada afete o login.

## Execução

O acesso deve ocorrer pelo servidor HTTP. Abrir os arquivos diretamente via `file://` não é suportado.
