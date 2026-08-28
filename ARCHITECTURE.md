# Arquitetura de dados

A fonte única de dados da aplicação é `data/db.json`, acessada pelas páginas por meio da API HTTP do `server.js`.

As páginas não mantêm cópias embutidas (`EMBEDDED_DB`/`EMBEDDED_TEACHERS`) para evitar divergência entre dados exibidos e dados persistidos.

Execute pelo servidor local (por exemplo, `node server.js` ou `Iniciar-POCV.bat`). O acesso via `file://` não é suportado para carregar o banco.

No Render, configure `DB_FILE` para armazenamento persistente quando esse recurso estiver disponível; sem disco persistente, alterações feitas no JSON local da instância podem ser perdidas em reinicializações/redeploys.
