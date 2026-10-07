# Project instructions

- Учебная мини-CRM: одна страница, один пользователь, данные в `localStorage` браузера.
- Runtime: Node.js 24+, ES modules, plain HTML/CSS/JS. No external dependencies, CDNs, fonts or services.
- Run tests with `node --test`; start locally with `node server.js` and open http://127.0.0.1:3000.
- Domain logic (validation, search, filter, sort) lives in `src/clients.js` and must not touch the DOM or storage.
- Persistence lives in `src/storage.js`; the storage object is passed in so tests can use a fake.
- DOM code lives in `src/app.js`; render user data with `textContent`, never `innerHTML`.
- UI text is in Russian.
- Add or update tests for every behavior change.
- Work in small vertical stages; implement only the approved stage.
- Do not write secrets, `.env` files, credentials, or private keys.
- Before claiming completion, show `node --test` output and the list of changed files.
- Do not commit or push unless the user explicitly asks.
