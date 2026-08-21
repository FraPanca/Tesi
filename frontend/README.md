# frontend/

Web app React (SPA) del sistema. Parte del progetto [IoT Home Energy Monitor](../README.md).

## Italiano

### Descrizione

Consuma le API REST/WebSocket esposte dal [`backend`](../backend/README.md) per costruire un'unica dashboard operativa: grafici dei consumi a scala temporale reale (non a categorie) filtrabili per periodo e per presa, controllo on/off delle prese, stima costi (integrazione trapezoidale della potenza nel tempo), gestione delle soglie di spegnimento automatico, e una sezione admin protetta per la consultazione dei log di sistema e la diagnostica hardware (healthcheck/flush). Include inoltre una **sezione previsioni/anomalie per singola presa**, che mostra le previsioni a 7 giorni prodotte da [Prophet](../prophet/README.md) con banda di confidenza, il giorno di consumo previsto più alto, i suggerimenti di risparmio testuali e le anomalie rilevate. Nessuna logica di calcolo lato client oltre alla stima costo e all'aggregazione giornaliera delle previsioni: il resto dei dati arriva già pronto dal backend.

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
| chart.js | 4.5.1 | grafici consumi e previsioni |
| react-chartjs-2 | 5.3.1 | wrapper React di chart.js |
| chartjs-adapter-date-fns | 3.0.0 | asse a scala temporale reale (non a categorie) |
| date-fns | 4.4.0 | dipendenza dell'adapter, formattazione date in italiano |
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
Resta vuota sia in sviluppo sia in produzione: backend e WebSocket vengono raggiunti in modo relativo alla stessa origine della pagina (proxy Vite in dev, reverse proxy nginx in produzione). Va valorizzata solo per puntare a un backend su host/porta diversi. Le variabili `VITE_*` sono lette da Vite **al momento della build**, non a runtime: in Docker conta il valore presente quando gira `npm run build` dentro il `Dockerfile`.

### Come buildarlo/eseguirlo

- **`npm run dev`**: dev server Vite su `http://localhost:5173`, con proxy verso il backend su `:3000` (richiede il backend attivo)
- **`npm run build`**: build di produzione in `dist/` (bundle minificato, code-split)
- **`npm run preview`**: serve la build di produzione appena creata, utile per un test rapido senza Docker
- **`npm run lint`** (o `npx oxlint .`): lint con Oxlint
- **Docker**: servizio dello stack completo definito in `docker-compose.yml` (root): build multi-stage in tre fasi (`build` → `test` → `production`), espone la porta 80 (configurabile), fa da reverse proxy verso `backend:3000`. Lo stage `test` esegue `npm run test` come parte della build: se i test falliscono, la build si interrompe prima che l'immagine di produzione (Node→nginx) venga creata; lo stage `production` include un `COPY --from=test` mirato a un file non necessario a runtime, usato solo per forzare `test` nel grafo di build (Docker altrimenti costruirebbe solo gli stage referenziati dallo stage finale). Prima di avviarlo conviene verificare che la porta 80 sia effettivamente libera sull'host (`ss -tlnp | grep :80`), soprattutto se sul Raspberry gira già un altro servizio web. Dalla root: `docker compose up frontend` (o l'intero stack con `docker compose up`)

### Struttura interna

```
frontend/
├── .env.example
├── .dockerignore
├── Dockerfile
│   # build multi-stage a tre fasi (build/test/production): Node compila e testa, nginx serve i file statici
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
│   │   ├── ForecastChart.css / PrevisioniPanel.css / AnomalieList.css
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
│   │       ├── previsioni.js
│   ├── hooks/
│   │   ├── usePrese.js
│   │   │   # CRUD + comando on/off, fonte di verità della lista prese
│   │   ├── useReadingsHistory.js
│   │   ├── useRecentReadings.js
│   │   ├── useLogs.js
│   │   ├── useAdmin.js
│   │   ├── useNow.js
│   │   │   # concetto di "adesso" che avanza nel tempo, riusato per grafico e finestre scorrevoli
│   │   ├── usePrevisione.js
│   │   │   # quattro stati: loading/disponibile/assente/errore
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── PresaDetail.jsx
│   │   ├── Login.jsx
│   │   ├── AdminLogs.jsx
│   └── components/
│       ├── ConsumptionChart.jsx
│       ├── ForecastChart.jsx
│       ├── PrevisioniPanel.jsx
│       ├── AnomalieList.jsx
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
        │   ├── AddPresaForm.test.jsx
        │   ├── AnomalieList.test.jsx
        │   ├── ConsumptionChart.test.jsx
        │   ├── CostEstimator.test.jsx
        │   ├── ForecastChart.test.jsx
        │   ├── PresaCard.test.jsx
        │   ├── PrevisioniPanel.test.jsx
        │   └── RequireAuth.test.jsx
        ├── hooks/
        │   ├── UsePrevisione.test.js
        │   ├── useNow.test.js
        │   └── usePrese.test.js
        └── pages/
            ├── Dashboard.test.jsx
            └── Presadetail.test.jsx
```

### Dettagli implementativi

- **`services/api/*.js`**: mappa 1:1 le route reali del backend, verificate leggendo il codice sorgente. `client.js` centralizza header, formato errore e gestione del 401.
- **Context globali**: `AuthContext` (un solo livello di autorizzazione, token valido = admin), `WebSocketContext` (un solo socket per tutta l'app, connesso sempre alla stessa origine della pagina, mai un host fisso, per funzionare identicamente da locale/LAN/Tailscale).
- **Hook per dominio**: `usePrese`, `useReadingsHistory`/`useRecentReadings` (separati per semantica diversa dei due endpoint), `useLogs`, `useAdmin`, `useNow` (concetto di "adesso" che avanza nel tempo, riusato per grafico e finestre scorrevoli), `usePrevisione` (quattro stati: loading/disponibile/assente/errore; "assente" copre sia 404 sia previsione stantia, per esplicita indicazione del contratto Prophet).
- **Grafico consumi (`ConsumptionChart`)**: scala temporale reale (`type: 'time'` + `chartjs-adapter-date-fns`, non a categorie), punti ordinati per timestamp prima del disegno (indipendentemente dalla causa di un eventuale disordine in arrivo: le letture arrivano sia da fetch REST sia da append WebSocket, e con due worker ESP32 in parallelo l'ordine non è garantito), interpolazione monotona (`cubicInterpolationMode: 'monotone'`, non spline libera, per evitare sovrasterzo su punti ravvicinati), interruzione della linea sui buchi temporali ampi (>45 min, soglia indicativa), punto sintetico finale che distende l'ultimo valore noto fino ad "ora" (`useNow`, aggiornato ogni minuto), granularità dell'asse (`time.minUnit`, non `time.unit`) dipendente dal periodo selezionato (ore per "24h", giorni/mesi per periodi più lunghi).
- **Sezione previsioni (`PrevisioniPanel` + `ForecastChart` + `AnomalieList`)**, per singola presa in `PresaDetail`: prossime 24h (grafico con banda di confidenza `yhatLower`/`yhatUpper`), giorno con consumo previsto più alto (aggregazione a media oraria sui 168 punti, esplicitamente in fuso `Europe/Rome`, dato che i timestamp dal backend sono sempre UTC e la conversione resta a carico del frontend), suggerimenti testuali già pronti dal backend, anomalie (dati grezzi da Isolation Forest: `ds`/`y`/`punteggio`, mostrato come numero continuo, deliberatamente non categorizzato in etichette testuali, mancando un riferimento sui valori tipici prodotti in produzione).
- **Routing**: React Router, un solo guard (`RequireAuth`) su `/admin/logs`, unica sezione autenticata.
- **Deploy**: build statica servita da nginx, reverse proxy verso il backend, stessa origine per pagina/REST/WebSocket, nessun CORS necessario, stesso comportamento da localhost, LAN o Tailscale.
- **Design visivo**: palette ispirata ai colori normati dei conduttori elettrici, tipografia Space Grotesk/IBM Plex, lettura potenza in stile "display" nelle card.

### Come si avvia/testa

#### Suite di test automatizzata

**Framework:** Vitest (non Jest: scelto per l'integrazione nativa con la configurazione Vite già presente, meno configurazione necessaria rispetto a Jest su un progetto Vite/ESM), con React Testing Library.

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

**Risultato attuale:** 95 test, tutti verdi. La tabella seguente riflette i sette file originari della suite (48 test); da allora sono stati aggiunti test anche per `ConsumptionChart`, `AnomalieList`, `ForecastChart`, `PrevisioniPanel`, `Dashboard` e `PresaDetail` (vedi la struttura interna sopra per l'elenco completo dei file), senza un dettaglio per singolo file disponibile per l'incremento.

| File | N. test | Cosa verifica |
|---|---|---|
| `services/client.test.js` | 10 | Contratto di `apiFetch`: headers, gestione 204, formato errori, logout automatico solo sui 401 autenticati |
| `context/AuthContext.test.js` | 7 | Persistenza sessione in localStorage, login/logout, wiring dell'handler 401→logout |
| `components/RequireAuth.test.jsx` | 2 | Redirect a `/login` se non autenticato |
| `components/PresaCard.test.jsx` | 9 | Display potenza/soglia, stati disabled ON/OFF, invio comando (attesa/errore), rimozione |
| `components/AddPresaForm.test.jsx` | 6 | Trim campi, conversione soglia potenza, errore, chiusura solo su successo |
| `components/CostEstimator.test.jsx` | 7 | Stima energia (integrazione trapezoidale potenza→kWh), formato tariffa con virgola |
| `hooks/usePrese.test.js` | 7 | Caricamento iniziale, CRUD, aggiornamento ottimistico dopo un comando |

WebSocketContext resta fuori dalla suite: richiederebbe mock approfonditi del protocollo Socket.IO.

#### Verifica manuale in isolamento

Non ha una modalità mock: consuma REST/WebSocket reali del backend.

- **Verifica strutturale senza backend**: `npm run build` compila tutto il codice e cattura errori di sintassi/import/JSX, senza richiedere il backend attivo.
- **Verifica funzionale**: richiede il backend (e a cascata Mongo/Redis/Mosquitto) attivo, `docker compose up backend mongodb redis mosquitto` dalla root, poi `npm run dev`.

### Note e limiti noti

Decisioni tecniche degne di nota:

- In `useReadingsHistory` e `useRecentReadings`, `loading` viene sempre portato a `false` anche nel ramo in cui `presaId` è assente.
- Il confine temporale usato per i periodi 7/30 giorni è calcolato con `useMemo` ancorato al cambio di periodo, non con `Date.now()` invocato direttamente nel corpo del componente: quest'ultimo produrrebbe un valore diverso a ogni render, con refetch continui del grafico.
- Il socket WebSocket si connette sempre alla stessa origine della pagina, mai a un host fisso come `localhost:3000` (che dal punto di vista del browser indicherebbe sempre il dispositivo del client, non il server): necessario per funzionare identicamente da locale, LAN o Tailscale. Il proxy Vite estende questo comportamento al WebSocket in dev (`ws: true`), il reverse proxy nginx lo fa in produzione.
- Il grafico usa una scala temporale reale (`type: 'time'`), non a categorie, perché le letture non arrivano a intervalli regolari.
- I punti del grafico vengono ordinati esplicitamente per timestamp prima del disegno, nel componente: con la scala temporale, un punto fuori ordine cronologico produrrebbe altrimenti un segmento che torna indietro sull'asse.
- La curva usa `cubicInterpolationMode: 'monotone'` invece di una spline libera (`tension`): con punti molto ravvicinati nel tempo circondati da vicini più distanti, una spline libera produce un anello visivo, mentre l'interpolazione monotona resta vincolata al range locale dei due punti che collega.
- Un gruppo stabile sugli ESP32 non viene ripubblicato finché non arriva una transizione: l'ultimo dato visibile mostrerebbe altrimenti il valore del periodo *precedente*, non quello attuale. Il grafico distende l'ultimo valore noto fino a "ora" con un punto sintetico (`useNow`); lato ESP32, un valore viene pubblicato immediatamente a ogni transizione confermata, riducendo la finestra in cui il dato mostrato è superato.
- La linea si interrompe (punto sintetico `y: null`) quando il buco temporale tra due letture consecutive supera una soglia indicativa di 45 minuti, per non rappresentare come transizione continua un intervallo privo di dati.
- L'aggregazione per "giorno di picco" raggruppa i 168 punti delle previsioni con conversione esplicita a `Europe/Rome`, non usando direttamente la porzione data della stringa UTC: quest'ultima metterebbe nel giorno sbagliato i punti vicini alla mezzanotte italiana, per la differenza di 1-2 ore dovuta al cambio ora legale.
- I filtri di `useLogs` sono parametri primitivi, non un oggetto: un oggetto ricreato ad ogni render ha un riferimento diverso anche a contenuto identico, causando ricariche non necessarie se messo in una dependency array.

Altri punti da segnalare:

- **Anomalie senza etichetta di gravità testuale**: il campo `punteggio` (continuo, convenzione Isolation Forest) è mostrato come numero grezzo invece che come "alta"/"media"/"bassa", scelta deliberata, mancando un riferimento sui valori tipici prodotti in produzione.
- **Meccanismo "valore singolo" alle transizioni**: implementato sia lato ESP32 (pubblicazione immediata a ogni transizione confermata) sia lato backend (il campo `valore_singolo` viene ricevuto ma volutamente ignorato: ogni valore, incluso quello singolo, è persistito come lettura normale, senza distinzione a valle). Per il grafico l'effetto pratico resta comunque positivo: riduce la finestra di attesa prima che un nuovo dato reale arrivi dopo una transizione, anche senza un flag esplicito da consumare lato client.
- Routing con un solo guard (`RequireAuth`) sulla rotta `/admin/logs`, unica sezione autenticata: il resto dell'app è pubblico per contratto di backend.

---

## English

### Description

Consumes the REST/WebSocket API exposed by the [`backend`](../backend/README.md) to build a single operational dashboard: consumption charts on a real time scale (not categorical) filterable by time period and by plug, on/off plug control, cost estimation (trapezoidal integration of power over time), automatic shutdown threshold management, and a protected admin section for browsing system logs and hardware diagnostics (healthcheck/flush). It also includes a **forecast/anomalies section per plug**, showing the 7-day forecast produced by [Prophet](../prophet/README.md) with a confidence band, the day with the highest predicted consumption, text saving suggestions, and detected anomalies. No client-side calculation logic beyond the cost estimate and the daily aggregation of forecasts: the rest of the data arrives already computed from the backend.

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
| chart.js | 4.5.1 | consumption and forecast charts |
| react-chartjs-2 | 5.3.1 | React wrapper for chart.js |
| chartjs-adapter-date-fns | 3.0.0 | real time-scale axis (not categorical) |
| date-fns | 4.4.0 | adapter dependency, Italian date formatting |
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
Left empty both in development and production: the backend and WebSocket are reached relative to the page's own origin (Vite dev proxy, nginx reverse proxy in production). Only set it to point to a backend on a different host/port. `VITE_*` variables are read by Vite **at build time**, not at runtime: in Docker, what matters is the value present when `npm run build` runs inside the `Dockerfile`.

### How to build/run it

- **`npm run dev`**: Vite dev server on `http://localhost:5173`, proxying to the backend on `:3000` (requires the backend to be running)
- **`npm run build`**: production build in `dist/` (minified bundle, code-split)
- **`npm run preview`**: serves the freshly created production build, useful for a quick check without Docker
- **`npm run lint`** (or `npx oxlint .`): lint with Oxlint
- **Docker**: a service of the full stack defined in `docker-compose.yml` (root): multi-stage build in three phases (`build` → `test` → `production`), exposes port 80 (configurable), reverse-proxies to `backend:3000`. The `test` stage runs `npm run test` as part of the build: if the tests fail, the build stops before the production image (Node→nginx) is created; the `production` stage includes a targeted `COPY --from=test` of a file not needed at runtime, used only to force `test` into the build graph (Docker would otherwise only build the stages referenced by the final stage). Before starting it, it's worth checking that port 80 is actually free on the host (`ss -tlnp | grep :80`), especially if another web service is already running on the Raspberry Pi. From the root: `docker compose up frontend` (or the whole stack with `docker compose up`)

### Internal structure

```
frontend/
├── .env.example
├── .dockerignore
├── Dockerfile
│   # three-stage build (build/test/production): Node compiles and tests, nginx serves the static files
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
│   │   ├── ForecastChart.css / PrevisioniPanel.css / AnomalieList.css
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
│   │       ├── previsioni.js
│   ├── hooks/
│   │   ├── usePrese.js
│   │   │   # CRUD + on/off command, single source of truth for the plug list
│   │   ├── useReadingsHistory.js
│   │   ├── useRecentReadings.js
│   │   ├── useLogs.js
│   │   ├── useAdmin.js
│   │   ├── useNow.js
│   │   │   # concept of "now" advancing over time, reused for the chart and sliding windows
│   │   ├── usePrevisione.js
│   │   │   # four states: loading/available/absent/error
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── PresaDetail.jsx
│   │   ├── Login.jsx
│   │   ├── AdminLogs.jsx
│   └── components/
│       ├── ConsumptionChart.jsx
│       ├── ForecastChart.jsx
│       ├── PrevisioniPanel.jsx
│       ├── AnomalieList.jsx
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
        │   ├── AddPresaForm.test.jsx
        │   ├── AnomalieList.test.jsx
        │   ├── ConsumptionChart.test.jsx
        │   ├── CostEstimator.test.jsx
        │   ├── ForecastChart.test.jsx
        │   ├── PresaCard.test.jsx
        │   ├── PrevisioniPanel.test.jsx
        │   └── RequireAuth.test.jsx
        ├── hooks/
        │   ├── UsePrevisione.test.js
        │   ├── useNow.test.js
        │   └── usePrese.test.js
        └── pages/
            ├── Dashboard.test.jsx
            └── Presadetail.test.jsx
```

### Implementation details

- **`services/api/*.js`**: maps 1:1 to the backend's real routes, verified by reading the source code. `client.js` centralizes headers, error format, and 401 handling.
- **Global contexts**: `AuthContext` (a single authorization level, valid token = admin), `WebSocketContext` (one socket for the whole app, always connected to the page's own origin, never a fixed host, to work identically from local/LAN/Tailscale).
- **Domain hooks**: `usePrese`, `useReadingsHistory`/`useRecentReadings` (kept separate because the two endpoints have different semantics), `useLogs`, `useAdmin`, `useNow` (concept of "now" advancing over time, reused for the chart and sliding windows), `usePrevisione` (four states: loading/available/absent/error; "absent" covers both a 404 and a stale forecast, per the Prophet contract).
- **Consumption chart (`ConsumptionChart`)**: real time-scale axis (`type: 'time'` + `chartjs-adapter-date-fns`, not categorical), points sorted by timestamp before drawing (regardless of what causes any disorder on arrival: readings come both from REST fetches and WebSocket appends, and with two ESP32 workers in parallel the arrival order isn't guaranteed), monotone interpolation (`cubicInterpolationMode: 'monotone'`, not a free spline, to avoid overshoot on closely-spaced points), the line breaks on wide time gaps (>45 min, indicative threshold), a final synthetic point that extends the last known value up to "now" (`useNow`, updated every minute), axis granularity (`time.minUnit`, not `time.unit`) depending on the selected period (hours for "24h", days/months for longer periods).
- **Forecast section (`PrevisioniPanel` + `ForecastChart` + `AnomalieList`)**, per plug in `PresaDetail`: next 24h (chart with confidence band `yhatLower`/`yhatUpper`), day with the highest predicted consumption (hourly-average aggregation over the 168 points, explicitly in the `Europe/Rome` timezone, since timestamps from the backend are always UTC and conversion is the frontend's responsibility), text saving suggestions already prepared by the backend, anomalies (raw Isolation Forest data: `ds`/`y`/`punteggio`, shown as a continuous number, deliberately not categorized into text labels, for lack of a reference on typical production values).
- **Routing**: React Router, a single guard (`RequireAuth`) on `/admin/logs`, the only authenticated section.
- **Deploy**: static build served by nginx, reverse proxy to the backend, same origin for the page/REST/WebSocket, no CORS needed, identical behavior from localhost, LAN, or Tailscale.
- **Visual design**: palette inspired by standard electrical-conductor colors, Space Grotesk/IBM Plex typography, "display"-style power reading in the cards.

### How to start/test it

#### Automated test suite

**Framework:** Vitest (not Jest: chosen for its native integration with the existing Vite configuration, requiring less setup than Jest on a Vite/ESM project), with React Testing Library.

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

**Current result:** 95 tests, all passing. The table below reflects the suite's original seven files (48 tests); tests have since been added for `ConsumptionChart`, `AnomalieList`, `ForecastChart`, `PrevisioniPanel`, `Dashboard`, and `PresaDetail` as well (see the internal structure above for the complete file list), with no per-file detail available for the increment.

| File | # tests | What it checks |
|---|---|---|
| `services/client.test.js` | 10 | `apiFetch` contract: headers, 204 handling, error format, automatic logout only on authenticated 401s |
| `context/AuthContext.test.js` | 7 | Session persistence in localStorage, login/logout, wiring of the 401→logout handler |
| `components/RequireAuth.test.jsx` | 2 | Redirect to `/login` when not authenticated |
| `components/PresaCard.test.jsx` | 9 | Power/threshold display, ON/OFF disabled states, sending a command (pending/error), removal |
| `components/AddPresaForm.test.jsx` | 6 | Field trimming, power threshold conversion, error handling, closes only on success |
| `components/CostEstimator.test.jsx` | 7 | Energy estimate (trapezoidal power→kWh integration), comma-formatted tariff |
| `hooks/usePrese.test.js` | 7 | Initial load, CRUD, optimistic update after a command |

WebSocketContext remains outside the suite: it would require deep mocking of the Socket.IO protocol.

#### Manual verification in isolation

There is no mock mode: it consumes the backend's real REST/WebSocket API.

- **Structural check without a backend**: `npm run build` compiles all the source code and catches syntax/import/JSX errors, without requiring the backend to be running.
- **Functional check**: requires the backend (and, transitively, Mongo/Redis/Mosquitto) running, `docker compose up backend mongodb redis mosquitto` from the root, then `npm run dev`.

### Notes and known limitations

Notable technical decisions:

- In `useReadingsHistory` and `useRecentReadings`, `loading` is always set to `false` even on the branch where `presaId` is absent.
- The time boundary used for the 7/30-day periods is computed with `useMemo` anchored to the period change, not with `Date.now()` called directly in the component body: the latter would produce a different value on every render, causing continuous refetches of the chart.
- The WebSocket always connects to the page's own origin, never to a fixed host like `localhost:3000` (which, from the browser's point of view, always points to the client's own device, not the server): necessary to work identically from local, LAN, or Tailscale. The Vite dev proxy extends this behavior to WebSocket (`ws: true`), the nginx reverse proxy does it in production.
- The chart uses a real time-scale axis (`type: 'time'`), not categorical, because readings don't arrive at regular intervals.
- Chart points are explicitly sorted by timestamp before drawing, in the component: with the time scale, a point out of chronological order would otherwise produce a segment that goes backwards on the axis.
- The curve uses `cubicInterpolationMode: 'monotone'` instead of a free spline (`tension`): with points very close in time surrounded by more distant neighbors, a free spline produces a visual loop, while monotone interpolation stays constrained to the local range of the two points it connects.
- A stable group on the ESP32 boards isn't republished until a transition arrives: the last visible reading would otherwise show the value of the *previous* period, not the current one. The chart extends the last known value up to "now" with a synthetic point (`useNow`); on the ESP32 side, a value is published immediately on every confirmed transition, reducing the window in which the displayed data is stale.
- The line breaks (synthetic `y: null` point) when the time gap between two consecutive readings exceeds an indicative threshold of 45 minutes, so a data-free interval isn't represented as a continuous transition.
- The "peak day" aggregation groups the 168 forecast points with explicit conversion to `Europe/Rome`, rather than using the date portion of the UTC string directly: the latter would put points near Italian midnight on the wrong day, from the 1-2 hour DST difference.
- `useLogs` filters are primitive parameters, not an object: an object recreated on every render has a different reference even with identical content, causing unnecessary reloads when placed in a dependency array.

Other points worth noting:

- **Anomalies without a text severity label**: the `punteggio` field (continuous, Isolation Forest convention) is shown as a raw number instead of "high"/"medium"/"low", a deliberate choice, for lack of a reference on typical production values.
- **"Single value" mechanism on transitions**: implemented both on the ESP32 side (immediate publish on every confirmed transition) and on the backend side (the `valore_singolo` field is received but deliberately ignored: every value, including the single one, is persisted as a normal reading, with no downstream distinction). For the chart, the practical effect is still positive: it reduces the wait before a new real reading arrives after a transition, even without an explicit flag to consume client-side.
- Routing has a single guard (`RequireAuth`) on the `/admin/logs` route, the only authenticated section: the rest of the app is public by backend contract.