# frontend/

Web app React (SPA) del sistema. Parte del progetto [IoT Home Energy Monitor](../README.md).

## Italiano

### Descrizione

Consuma le API REST/WebSocket esposte dal [`backend`](../backend/README.md) per costruire un'unica dashboard operativa: grafici dei consumi filtrabili per periodo e per presa, controllo on/off delle prese, stima costi (integrazione trapezoidale della potenza nel tempo — unica logica di calcolo lato client, il resto dei dati arriva già pronto dal backend), gestione delle soglie di spegnimento automatico, e una sezione admin protetta per la consultazione dei log di sistema e la diagnostica hardware (healthcheck/flush).

### Requisiti di sistema

- Node.js `^20.19.0` oppure `>=22.12.0` (richiesto da Vite 8, campo `engines` del pacchetto). Il `Dockerfile` usa `node:20-alpine`: verificare che la patch sia ≥20.19.
- npm (incluso con Node)
- Browser moderno con supporto ES modules per lo sviluppo (`npm run dev`)

### Librerie principali

| Libreria | Versione | Note |
|---|---|---|
| react / react-dom | 19.2.8 | |
| react-router-dom | 7.18.1 | routing |
| socket.io-client | 4.8.3 | deve restare compatibile con `socket.io ^4.7.0` lato backend |
| chart.js | 4.5.1 | grafico consumi |
| react-chartjs-2 | 5.3.1 | wrapper React di chart.js |
| vite | 8.1.5 | build tool |
| @vitejs/plugin-react | 6.0.4 | plugin JSX/Fast Refresh |

Linter: **Oxlint** (non ESLint), `.oxlintrc.json` in radice, nessuna configurazione aggiuntiva necessaria.

Per il testing (dev dependency, vedi sezione dedicata più sotto): `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`.

### Setup

```bash
cd frontend
npm install
cp .env.example .env
```

Variabile d'ambiente (`frontend/.env`, non committato):
```dotenv
VITE_API_BASE_URL=
```
Resta vuota sia in sviluppo sia in produzione: backend e WebSocket vengono raggiunti in modo relativo alla stessa origine della pagina (proxy Vite in dev, reverse proxy nginx in produzione). Va valorizzata solo per puntare a un backend su host/porta diversi. Le variabili `VITE_*` sono lette da Vite **al momento della build**, non a runtime — in Docker conta il valore presente quando gira `npm run build` dentro il `Dockerfile`.

### Come buildarlo/eseguirlo

- **`npm run dev`** — dev server Vite su `http://localhost:5173`, con proxy verso il backend su `:3000` (richiede il backend attivo)
- **`npm run build`** — build di produzione in `dist/` (bundle minificato, code-split)
- **`npm run preview`** — serve la build di produzione appena creata, utile per un test rapido senza Docker
- **`npm run lint`** (o `npx oxlint .`) — lint con Oxlint
- **Docker** — servizio dello stack completo definito in `docker-compose.yml` (root): build multi-stage Node→nginx, espone la porta 80 (configurabile), fa da reverse proxy verso `backend:3000`. Prima di avviarlo conviene verificare che la porta 80 sia effettivamente libera sull'host (`ss -tlnp | grep :80`), soprattutto se sul Raspberry gira già un altro servizio web. Dalla root: `docker compose up frontend` (o l'intero stack con `docker compose up`)

### Struttura interna

```
frontend/
├── .env.example
├── .dockerignore
├── Dockerfile
│   # build multi-stage: Node compila, nginx serve i file statici
├── nginx.conf
│   # serve la SPA + reverse proxy verso backend:3000 per /api e /socket.io
├── vite.config.js
│   # proxy dev verso il backend (REST + WebSocket, ws:true)
├── vitest.config.js
│   # configurazione dei test (Vitest), file separato da vite.config.js
├── package.json
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── style/
│   │   ├── index.css / Dashboard.css / ConsumptionChart.css / PresaCard.css
│   │   ├── DashboardWidgets.css / Login.css / AdminLogs.css / PresaDetail.css
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   │   # unico livello di autorizzazione: token valido = admin
│   │   ├── WebSocketContext.jsx
│   │   │   # un solo socket per tutta l'app
│   ├── services/
│   │   └── api/
│   │       ├── client.js
│   │       │   # header, formato errore, gestione 401
│   │       ├── auth.js
│   │       ├── prese.js
│   │       ├── consumi.js
│   │       ├── admin.js
│   │       ├── logs.js
│   ├── hooks/
│   │   ├── usePrese.js
│   │   │   # CRUD + comando on/off, fonte di verità della lista prese
│   │   ├── useReadingsHistory.js
│   │   ├── useRecentReadings.js
│   │   ├── useLogs.js
│   │   ├── useAdmin.js
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── PresaDetail.jsx
│   │   ├── Login.jsx
│   │   ├── AdminLogs.jsx
│   └── components/
│       ├── ConsumptionChart.jsx
│       ├── PresaCard.jsx
│       ├── CostEstimator.jsx
│       ├── AddPresaForm.jsx
│       ├── RequireAuth.jsx
│       ├── LogTable.jsx
│       ├── AdminDiagnostics.jsx
└── tests/
    ├── setup.js
    │   # estende expect con i matcher jest-dom, pulisce il DOM tra i test
    └── unit/
        ├── services/
        │   └── client.test.js
        ├── context/
        │   └── AuthContext.test.js
        ├── components/
        │   ├── RequireAuth.test.jsx
        │   ├── PresaCard.test.jsx
        │   ├── AddPresaForm.test.jsx
        │   └── CostEstimator.test.jsx
        └── hooks/
            └── usePrese.test.js
```

### Come si avvia/testa

#### Suite di test automatizzata

**Framework:** Vitest (non Jest — scelto per l'integrazione nativa con la configurazione Vite già presente, meno configurazione necessaria rispetto a Jest su un progetto Vite/ESM), con React Testing Library.

**Setup** (se non già fatto):
```bash
cd frontend
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```
e aggiungere in `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

File di configurazione (nuovi, non modificano il `vite.config.js` esistente): `vitest.config.js` e `tests/setup.js` (estende `expect` con i matcher `jest-dom`, pulisce il DOM tra i test).

**Comandi:**
```bash
npm test                       # tutta la suite
npx vitest run <path-al-file>  # un singolo file
npm run test:watch             # riesecuzione automatica
```

**Risultato attuale:** 7 suite, 48 test, tutti verdi.

| File | N. test | Cosa verifica |
|---|---|---|
| `services/client.test.js` | 10 | Contratto di `apiFetch`: headers, gestione 204, formato errori, logout automatico solo sui 401 autenticati |
| `context/AuthContext.test.js` | 7 | Persistenza sessione in localStorage, login/logout, wiring dell'handler 401→logout |
| `components/RequireAuth.test.jsx` | 2 | Redirect a `/login` se non autenticato |
| `components/PresaCard.test.jsx` | 9 | Display potenza/soglia, stati disabled ON/OFF, invio comando (attesa/errore), rimozione |
| `components/AddPresaForm.test.jsx` | 6 | Trim campi, conversione soglia potenza, errore, chiusura solo su successo |
| `components/CostEstimator.test.jsx` | 7 | Stima energia (integrazione trapezoidale potenza→kWh), formato tariffa con virgola |
| `hooks/usePrese.test.js` | 7 | Caricamento iniziale, CRUD, aggiornamento ottimistico dopo un comando |

Esplicitamente esclusi dalla suite: `ConsumptionChart` (integrazione Chart.js/canvas — basso valore/alto attrito per test automatizzati) e `WebSocketContext` (richiederebbe mock approfonditi del protocollo Socket.IO).

Copertura funzionale, non esaustiva — coerente con la priorità di progetto data al sistema end-to-end e al modulo Prophet.

#### Verifica manuale in isolamento

Non ha una modalità mock: consuma REST/WebSocket reali del backend.

- **Verifica strutturale senza backend**: `npm run build` compila tutto il codice e cattura errori di sintassi/import/JSX, senza richiedere il backend attivo.
- **Verifica funzionale**: richiede il backend (e a cascata Mongo/Redis/Mosquitto) attivo — `docker compose up backend mongodb redis mosquitto` dalla root, poi `npm run dev`.

### Note e limiti noti

- Routing con un solo guard (`RequireAuth`) sulla rotta `/admin/logs` — unica sezione autenticata, il resto dell'app è pubblico per contratto di backend.
- Deploy: build statica servita da nginx, che fa anche da reverse proxy verso il backend — stessa origine per pagina/REST/WebSocket, nessun CORS necessario, funziona identicamente da localhost, LAN o Tailscale.

---

## English

### Description

Consumes the REST/WebSocket API exposed by the [`backend`](../backend/README.md) to build a single operational dashboard: consumption charts filterable by time period and by plug, on/off plug control, cost estimation (trapezoidal integration of power over time — the only client-side calculation logic, the rest of the data arrives already computed from the backend), automatic shutdown threshold management, and a protected admin section for browsing system logs and hardware diagnostics (healthcheck/flush).

### System requirements

- Node.js `^20.19.0` or `>=22.12.0` (required by Vite 8, `engines` field of the package). The `Dockerfile` uses `node:20-alpine`: verify the patch version is ≥20.19.
- npm (bundled with Node)
- A modern browser with ES modules support for development (`npm run dev`)

### Main libraries

| Library | Version | Notes |
|---|---|---|
| react / react-dom | 19.2.8 | |
| react-router-dom | 7.18.1 | routing |
| socket.io-client | 4.8.3 | must stay compatible with `socket.io ^4.7.0` on the backend |
| chart.js | 4.5.1 | consumption chart |
| react-chartjs-2 | 5.3.1 | React wrapper for chart.js |
| vite | 8.1.5 | build tool |
| @vitejs/plugin-react | 6.0.4 | JSX/Fast Refresh plugin |

Linter: **Oxlint** (not ESLint), `.oxlintrc.json` at the root, no extra configuration needed.

For testing (dev dependency, see the dedicated section below): `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`.

### Setup

```bash
cd frontend
npm install
cp .env.example .env
```

Environment variable (`frontend/.env`, not committed):
```dotenv
VITE_API_BASE_URL=
```
Left empty both in development and production: the backend and WebSocket are reached relative to the page's own origin (Vite dev proxy, nginx reverse proxy in production). Only set it to point to a backend on a different host/port. `VITE_*` variables are read by Vite **at build time**, not at runtime — in Docker, what matters is the value present when `npm run build` runs inside the `Dockerfile`.

### How to build/run it

- **`npm run dev`** — Vite dev server on `http://localhost:5173`, proxying to the backend on `:3000` (requires the backend to be running)
- **`npm run build`** — production build in `dist/` (minified bundle, code-split)
- **`npm run preview`** — serves the freshly created production build, useful for a quick check without Docker
- **`npm run lint`** (or `npx oxlint .`) — lint with Oxlint
- **Docker** — a service of the full stack defined in `docker-compose.yml` (root): multi-stage Node→nginx build, exposes port 80 (configurable), reverse-proxies to `backend:3000`. Before starting it, it's worth checking that port 80 is actually free on the host (`ss -tlnp | grep :80`), especially if another web service is already running on the Raspberry Pi. From the root: `docker compose up frontend` (or the whole stack with `docker compose up`)

### Internal structure

```
frontend/
├── .env.example
├── .dockerignore
├── Dockerfile
│   # multi-stage build: Node compiles, nginx serves the static files
├── nginx.conf
│   # serves the SPA + reverse-proxies to backend:3000 for /api and /socket.io
├── vite.config.js
│   # dev proxy to the backend (REST + WebSocket, ws:true)
├── vitest.config.js
│   # test configuration (Vitest), separate file from vite.config.js
├── package.json
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── style/
│   │   ├── index.css / Dashboard.css / ConsumptionChart.css / PresaCard.css
│   │   ├── DashboardWidgets.css / Login.css / AdminLogs.css / PresaDetail.css
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   │   # single authorization level: valid token = admin
│   │   ├── WebSocketContext.jsx
│   │   │   # one socket for the whole app
│   ├── services/
│   │   └── api/
│   │       ├── client.js
│   │       │   # headers, error format, 401 handling
│   │       ├── auth.js
│   │       ├── prese.js
│   │       ├── consumi.js
│   │       ├── admin.js
│   │       ├── logs.js
│   ├── hooks/
│   │   ├── usePrese.js
│   │   │   # CRUD + on/off command, single source of truth for the plug list
│   │   ├── useReadingsHistory.js
│   │   ├── useRecentReadings.js
│   │   ├── useLogs.js
│   │   ├── useAdmin.js
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── PresaDetail.jsx
│   │   ├── Login.jsx
│   │   ├── AdminLogs.jsx
│   └── components/
│       ├── ConsumptionChart.jsx
│       ├── PresaCard.jsx
│       ├── CostEstimator.jsx
│       ├── AddPresaForm.jsx
│       ├── RequireAuth.jsx
│       ├── LogTable.jsx
│       ├── AdminDiagnostics.jsx
└── tests/
    ├── setup.js
    │   # extends expect with the jest-dom matchers, cleans up the DOM between tests
    └── unit/
        ├── services/
        │   └── client.test.js
        ├── context/
        │   └── AuthContext.test.js
        ├── components/
        │   ├── RequireAuth.test.jsx
        │   ├── PresaCard.test.jsx
        │   ├── AddPresaForm.test.jsx
        │   └── CostEstimator.test.jsx
        └── hooks/
            └── usePrese.test.js
```

### How to start/test it

#### Automated test suite

**Framework:** Vitest (not Jest — chosen for its native integration with the existing Vite configuration, requiring less setup than Jest on a Vite/ESM project), with React Testing Library.

**Setup** (if not already done):
```bash
cd frontend
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```
and add to `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Configuration files (new, do not modify the existing `vite.config.js`): `vitest.config.js` and `tests/setup.js` (extends `expect` with the `jest-dom` matchers, cleans up the DOM between tests).

**Commands:**
```bash
npm test                       # whole suite
npx vitest run <path-to-file>  # a single file
npm run test:watch             # auto re-run
```

**Current result:** 7 suites, 48 tests, all passing.

| File | # tests | What it checks |
|---|---|---|
| `services/client.test.js` | 10 | `apiFetch` contract: headers, 204 handling, error format, automatic logout only on authenticated 401s |
| `context/AuthContext.test.js` | 7 | Session persistence in localStorage, login/logout, wiring of the 401→logout handler |
| `components/RequireAuth.test.jsx` | 2 | Redirect to `/login` when not authenticated |
| `components/PresaCard.test.jsx` | 9 | Power/threshold display, ON/OFF disabled states, sending a command (pending/error), removal |
| `components/AddPresaForm.test.jsx` | 6 | Field trimming, power threshold conversion, error handling, closes only on success |
| `components/CostEstimator.test.jsx` | 7 | Energy estimate (trapezoidal power→kWh integration), comma-formatted tariff |
| `hooks/usePrese.test.js` | 7 | Initial load, CRUD, optimistic update after a command |

Explicitly excluded from the suite: `ConsumptionChart` (Chart.js/canvas integration — low value/high friction for automated testing) and `WebSocketContext` (would require deep mocking of the Socket.IO protocol).

Functional coverage, not exhaustive — consistent with the project's priority given to the end-to-end system and the Prophet module.

#### Manual verification in isolation

There is no mock mode: it consumes the backend's real REST/WebSocket API.

- **Structural check without a backend**: `npm run build` compiles all the source code and catches syntax/import/JSX errors, without requiring the backend to be running.
- **Functional check**: requires the backend (and, transitively, Mongo/Redis/Mosquitto) running — `docker compose up backend mongodb redis mosquitto` from the root, then `npm run dev`.

### Notes and known limitations

- Routing has a single guard (`RequireAuth`) on the `/admin/logs` route — the only authenticated section; the rest of the app is public by backend contract.
- Deploy: static build served by nginx, which also acts as reverse proxy to the backend — same origin for the page/REST/WebSocket, no CORS needed, works identically from localhost, LAN, or Tailscale.