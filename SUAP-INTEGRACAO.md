# Integração institucional SUAP/IFRN

O ACHA utiliza o fluxo OAuth2 do cliente JavaScript oficial do IFRN para autenticação institucional.

## Configuração no SUAP

Cadastre a aplicação com:

- **Name:** ACHA
- **Authorization grant type:** Implicit
- **Client type:** Public
- **Redirect URI:** `http://localhost:3000/login.html`
- **Algorithm:** No OIDC support
- **Ativo:** marcado

O fluxo atual não utiliza Client Secret.

## Fluxo de autenticação

1. O usuário acessa o ACHA.
2. Sem sessão, o servidor apresenta `login.html`.
3. O usuário seleciona **Entrar com SUAP / IFRN**.
4. O navegador é direcionado ao SUAP.
5. O SUAP autentica o usuário e retorna para `login.html#access_token=...`.
6. O JavaScript captura o token e remove o fragmento da URL.
7. O token é enviado ao servidor do ACHA.
8. O servidor consulta os dados do usuário no SUAP.
9. O ACHA identifica o cadastro local pela matrícula.
10. A sessão do ACHA é criada e o usuário é direcionado ao sistema.

## API de dados do usuário

A rota utilizada é:

```text
GET https://suap.ifrn.edu.br/api/rh/meus-dados/
```

Com:

```text
Authorization: Bearer <access_token>
Accept: application/json
```

Entre os dados retornados pelo SUAP estão matrícula, nome, e-mail, vínculo, cargo e URLs de foto. O ACHA utiliza a matrícula para vincular o usuário institucional ao docente cadastrado e a URL da foto para o perfil.

## Variáveis de ambiente

Use `.env.example` como modelo:

```env
SUAP_CLIENT_ID=...
SUAP_REDIRECT_URI=http://localhost:3000/login.html
SUAP_BASE_URL=https://suap.ifrn.edu.br
SUAP_SCOPE=identificacao email documentos_pessoais
```

O arquivo `.env` local não deve ser versionado.

## Vínculo no ACHA

A matrícula deve ser cadastrada no registro do docente. Exemplo:

```text
Edmilson Campos → 1835439 → Diretor Geral
Alba Lopes → 2813232 → Coordenador de Curso → Licenciatura em Informática
```

O cadastro local continua sendo a fonte de autorização do ACHA.

## Fluxo antigo

A implementação anterior utilizava Authorization Code + Confidential e a rota `/api/suap/callback`. Esse fluxo foi substituído. A rota antiga não deve ser utilizada na configuração atual.
