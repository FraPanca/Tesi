# backend/

API REST + WebSocket del sistema, in Node.js/Express. Parte del progetto [IoT Home Energy Monitor](../README.md).

## Italiano

### Descrizione

Sottoscrive i dati ottimizzati pubblicati via MQTT dagli ESP32 sul topic `home/<presa>/optimized`, li persiste su MongoDB con cache Redis, e li espone al frontend tramite REST API e WebSocket (Socket.IO). Pubblica inoltre sul broker i comandi diretti agli altri componenti: i comandi on/off sul topic `home/<deviceId>/commands` (eseguiti dal gateway), le richieste di healthcheck su `home/system/healthcheck` (a cui rispondono gateway ed ESP32 sottoscrivendo `home/system/healthcheck/response`) e le richieste di flush della coda di ritentativo verso gli ESP32 su `home/system/flush`. Gestisce inoltre l'autenticazione dell'amministratore (JWT) e il logging di sistema con endpoint dedicato.

Espone anche le previsioni dei consumi prodotte dal modulo [Prophet](../prophet/README.md) (`/api/previsioni`, scritte solo da Prophet, lette dal frontend) e un endpoint di logging non autenticato (`POST /api/logs`) usato da componenti esterni non autenticati, oggi solo Prophet, per segnalare fallimenti. Vedi "API previsioni e logging esterno" sotto per il contratto esatto.

Architettura a layer: `routes` → `controllers` → `services` → `repositories`, con un client MQTT unico condiviso e un middleware di autenticazione (`verifyToken`) montato sulle rotte admin.

### Requisiti / versioni

| Componente | Versione |
|---|---|
| Node.js | 20 (immagine Docker `node:20-slim`) |
| MongoDB | 7 |
| Redis | 7 |
| Eclipse Mosquitto (broker) | 2 |

Librerie principali (`package.json`):

```
express       ^5.1.0
mongoose      ^8.0.0
redis         ^4.6.0    (client ufficiale, non ioredis)
mqtt          ^5.3.0
socket.io     ^4.7.0
jsonwebtoken  ^9.0.3
bcryptjs      ^3.0.3
dotenv        ^16.4.0
nodemon       ^3.0.0    (solo dev)
jest          ^30.4.2   (solo dev, test)
supertest     ^7.2.2    (solo dev, test di integrazione HTTP)
```

CommonJS puro, nessun transpiler/bundler.

### Setup

Due file `.env` distinti, **non intercambiabili**:

**`backend/.env`**: serve esclusivamente per l'esecuzione locale (`npm run dev`, fuori Docker), è l'opposto del `.env` nella root, che è invece quello effettivamente letto da `docker-compose.yml` e usato in produzione. Il container backend **non legge mai** `backend/.env`.

```dotenv
PORT=3000
MONGO_URI=mongodb://localhost:27017/iot_energy
REDIS_URI=redis://localhost:6379
MQTT_BROKER_URL=mqtt://localhost:1883

MQTT_USER=
MQTT_PASSWORD=

JWT_SECRET=
JWT_EXPIRES_IN=12h

ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=
```

**`.env` nella root del repository** (letto da `docker-compose.yml`, usato realmente in produzione): stesse chiavi rilevanti (`MQTT_USER`, `MQTT_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`) più `MONGO_ROOT_USER`/`MONGO_ROOT_PASSWORD`. `MQTT_USER`/`MQTT_PASSWORD` devono coincidere con `gateway/config/.env` e con l'utente creato nel broker.

Generazione dei segreti:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"    # JWT_SECRET
node -e "require('bcryptjs').hash(process.argv[1],10).then(console.log)" 'la-tua-password'   # ADMIN_PASSWORD_HASH
```

Sia `middleware/auth.js` che `services/authService.js` verificano le variabili al `require` e lanciano un errore esplicito se mancano: il processo si rifiuta di partire finché non sono valorizzate.

### Come buildarlo/eseguirlo

**Locale, fuori Docker** (richiede MongoDB/Redis/Mosquitto raggiungibili):
```bash
cd backend
cp .env.example .env   # e compilare i valori
npm install
npm run dev             # nodemon, riavvio automatico
# oppure: npm start      (produzione, nessun riavvio automatico)
```

**Docker** (come effettivamente deployato):
```bash
docker compose build backend
docker compose up -d --build backend
docker compose logs -f backend
```

Sequenza di avvio attesa nei log: `[MongoDB] connesso`, poi `[Redis] connesso`, poi `[MQTT] connesso al broker`, poi `[Server] in ascolto sulla porta 3000`. Il servizio dipende da `mongodb`/`redis`/`mosquitto` (`condition: service_healthy`): non si avvia prima che siano pronti.

Il `Dockerfile` è multi-stage in tre fasi (`build` → `test` → `production`): lo stage `test` esegue `npm run test` come parte della build stessa, quindi il codice non supera mai lo stage di produzione senza che i test siano passati. Perché lo stage `test` venga effettivamente eseguito (Docker costruisce solo gli stage referenziati dallo stage finale), `production` include un `COPY --from=test` mirato a un file che non serve a runtime, usato solo per forzare `test` nel grafo di build: se i test falliscono, la build si interrompe lì, prima che l'immagine di produzione venga creata.

### Struttura interna

```
backend/
├── package.json
├── package-lock.json
├── .env.example
├── Dockerfile
├── .dockerignore
├── src/
│   ├── app.js
│   │   # entry point: Express + Socket.IO, mount rotte/middleware;
│   │   # avvio reale (Mongo/Redis/MQTT/listen) protetto da `if (require.main === module)`,
│   │   # per poter importare l'app nei test senza connessioni reali
│   ├── config/
│   │   ├── db.js
│   │   │   # connessione MongoDB (Mongoose)
│   │   └── redis.js
│   │       # connessione Redis
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── comandoController.js
│   │   ├── consumoController.js
│   │   ├── logController.js
│   │   ├── presaController.js
│   │   └── previsioneController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   │   # verifyToken
│   │   └── errorHandler.js
│   │       # gestore errori centralizzato
│   ├── models/
│   │   ├── ConsumoOttimizzato.js
│   │   │   # collezione time-series
│   │   ├── Log.js
│   │   │   # collezione "logs", TTL index 30 giorni
│   │   ├── Presa.js
│   │   └── Previsione.js
│   │       # generatoIl, orizzonte, valoriPrevisti[], metriche?/suggerimenti?/anomalie?, vedi sotto
│   ├── mqtt/
│   │   └── client.js
│   │       # client MQTT unico: subscribe optimized/healthcheck-response,
│   │       # publish comandi/flush/healthcheck, retry con backoff
│   ├── repositories/
│   │   ├── consumoRepository.js
│   │   ├── logRepository.js
│   │   ├── presaRepository.js
│   │   └── previsioneRepository.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   │   # POST /api/auth/login
│   │   ├── consumoRoutes.js
│   │   ├── logRoutes.js
│   │   │   # GET /api/logs (JWT), POST /api/logs (non autenticata)
│   │   ├── presaRoutes.js
│   │   └── previsioneRoutes.js
│   │       # POST /api/previsioni/:presaId, GET /api/previsioni/:presaId/ultima, nessuna JWT
│   ├── services/
│   │   ├── adminService.js
│   │   │   # flush/healthcheck
│   │   ├── authService.js
│   │   │   # login, firma JWT
│   │   ├── comandoService.js
│   │   │   # invio comandi on/off, con retry MQTT
│   │   ├── consumoService.js
│   │   │   # logica consumi + cache Redis
│   │   ├── logService.js
│   │   │   # validazione filtri di GET /api/logs
│   │   ├── presaService.js
│   │   └── previsioneService.js
│   ├── utils/
│   │   └── retry.js
│   │       # retry generico con backoff esponenziale
│   └── websocket/
│       └── index.js
│           # setup Socket.IO, notifica push per presa sottoscritta
└── tests/
    ├── unit/
    │   ├── utils/
    │   │   └── retry.test.js
    │   ├── mqtt/
    │   │   └── client.test.js
    │   ├── middleware/
    │   │   └── auth.test.js
    │   └── services/
    │       ├── consumoService.test.js
    │       ├── comandoService.test.js
    │       ├── presaService.test.js
    │       ├── authService.test.js
    │       ├── logService.test.js
    │       └── PrevisioneService.test.js
    └── integration/
        └── app.test.js
```

### API previsioni e logging esterno

Due rotte pensate per l'integrazione con [Prophet](../prophet/README.md), **nessuna delle due richiede JWT** (stesso trattamento di `/api/prese`/`/api/consumi`):

| Rotta | Chi la usa | Note |
|---|---|---|
| `POST /api/previsioni/:presaId` | Scritta solo da Prophet | Ogni chiamata crea un **nuovo documento**, mai un update-in-place: lo storico delle previsioni si accumula. `presaId` preso solo dal path, un eventuale `presaId` nel body è ignorato. Corpo: `orizzonte.da`/`orizzonte.a`, `valoriPrevisti[]` (`ds`, `yhat`, `yhatLower?`, `yhatUpper?`); `metriche?`/`suggerimenti?`/`anomalie?` opzionali |
| `GET /api/previsioni/:presaId/ultima` | Letta dal frontend | Previsione più recente per la presa (ordinata su `generatoIl`). 404 se non esiste nulla, stesso esito anche per un `presaId` mai registrato: nessun controllo di esistenza presa separato |
| `POST /api/logs` | Componenti esterni non autenticati (oggi solo Prophet) | Per segnalare fallimenti senza scrivere dati fittizi altrove (es. `evento: "prophet.forecast_fallito"`). `origine` è **sempre forzato a `'sistema'`** lato server: un valore diverso nel body viene ignorato |

**Vincolo di formato importante**: ogni data nel body di `POST /api/previsioni/:presaId` (`orizzonte.da`, `orizzonte.a`, ogni `valoriPrevisti[].ds`, ogni `anomalie[].ds`) **deve avere timezone esplicito** (`Z` o offset `±HH:MM`): il backend rifiuta con 400 una stringa "naive" (es. `"2026-08-11 14:00:00"`, il formato nativo di pandas/Prophet senza timezone). Non è un dettaglio implementativo minore: una data senza timezone esplicito viene interpretata in modo diverso a seconda del fuso orario del server che la genera (uno scarto di due ore è stato osservato fra un server UTC e uno Europe/Rome sullo stesso identico input).

In lettura (`GET`), tutte le date nella risposta sono **sempre** ISO 8601 con `Z` (UTC): comportamento nativo di JavaScript sulla serializzazione di un `Date`, utile da annotare per chi consuma l'API (es. il frontend).

Schema `Previsione` completo:
```
presaId: String (obbligatorio)
generatoIl: Date (default: adesso)
orizzonte: { da: Date, a: Date } (obbligatori)
valoriPrevisti: [{ ds: Date, yhat: Number, yhatLower?: Number, yhatUpper?: Number }]
metriche?: { mae?: Number, rmse?: Number, baselineConfronto?: String }  // solo valutazione offline
suggerimenti?: [String]                    // sempre presente come array, [] se assente dal body
anomalie?: [{ ds: Date, y: Number, punteggio: Number }]  // sempre presente come array, [] se assente dal body
```

### Come testarlo

#### Suite di test automatizzata

**Framework:** Jest, più `supertest` per un singolo test di integrazione HTTP.

**Setup** (se non già fatto):
```bash
cd backend
npm install --save-dev jest supertest
```
e aggiungere in `package.json`:
```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch"
}
```

**Comandi:**
```bash
npm test                    # tutta la suite
npx jest <path-al-file>     # un singolo file
npm run test:watch          # riesecuzione automatica
```

Non serve nessun `.env` reale né MongoDB/Redis/MQTT attivi: tutto lo strato esterno è mockato (repository Mongo/Redis, client MQTT, modello `Log`), lasciando reale tutta la logica applicativa; il test di integrazione fa lo stesso a livello di intera applicazione HTTP. Le uniche variabili d'ambiente necessarie (`JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`) sono impostate direttamente nei file di test che ne hanno bisogno.

**Risultato attuale:** 101 test, tutti verdi. La tabella seguente riflette la suite al momento della sua introduzione (9 suite, 62 test); da allora è stata aggiunta almeno `PrevisioneService.test.js`, senza un dettaglio per singolo file disponibile per l'incremento.

| File | N. test | Cosa verifica |
|---|---|---|
| `utils/retry.test.js` | 6 | Backoff esponenziale, esaurimento tentativi, valori di default |
| `mqtt/client.test.js` | 7 | Mapping payload ESP32→backend, sottoscrizione ai topic corretti, gestione errori/log su fallimento, pubblicazione comandi |
| `services/consumoService.test.js` | 10 | Salvataggio dato + notifica websocket, logica di spegnimento automatico per soglia potenza, lettura cache |
| `services/comandoService.test.js` | 4 | Validazione azione on/off, presa non trovata, pubblicazione MQTT + aggiornamento ottimistico stato |
| `services/presaService.test.js` | 10 | Vincoli su presaId/IP duplicati, whitelist campi in update, deregistrazione dispositivo alla rimozione |
| `services/authService.test.js` | 6 | Login con JWT reale, credenziali errate, campi mancanti, logging |
| `middleware/auth.test.js` | 5 | Token valido/mancante/malformato/scaduto/firmato con secret errato |
| `services/logService.test.js` | 5 | Validazione filtri di ricerca log |
| `integration/app.test.js` | 9 | Routing reale + controller + service + gestore errori + middleware auth, end-to-end via supertest |

Copertura funzionale dei percorsi critici e dei contratti tra componenti, non esaustiva.

#### Verifica manuale

Non richiede gateway/ESP32 reali per rispondere a REST/auth (i topic MQTT possono essere simulati con `mosquitto_pub`), ma richiede MongoDB/Redis/Mosquitto raggiungibili.

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"la-tua-password"}'
# atteso: { "token": "..." }
```

**Endpoint protetti:**
```bash
curl http://localhost:3000/api/logs -H "Authorization: Bearer <token>"
curl -X POST http://localhost:3000/api/admin/flush -H "Authorization: Bearer <token>"
```

**Filtri sui log:**
```bash
curl "http://localhost:3000/api/logs?livello=error&limite=20" -H "Authorization: Bearer <token>"
```

**Retry con backoff:** fermare il container `mosquitto` e chiamare `POST /api/admin/flush`; nei log del backend compaiono i tentativi con attesa crescente, e dopo il quinto fallimento un documento in `logs` con `evento: "mqtt.retry_esaurito"`.

### Note e limiti noti

- HTTPS scartato per scelta: il traffico remoto passa da Tailscale, cifrato a livello WireGuard.
- Un solo amministratore con credenziali fisse in `.env`: nessun ruolo separato, nessuna registrazione, nessun refresh token. Possedere un token valido implica essere l'admin.
- `presaService.js`: la scrittura su MongoDB avviene prima della registrazione/rimozione MQTT del dispositivo. Se la pubblicazione fallisce dopo i retry, la presa resta creata/rimossa in Mongo senza che il gateway lo sappia (nessun rollback implementato).
- `adminService.js`: un fallimento di pubblicazione dopo i retry su flush/healthcheck è indistinguibile lato HTTP da "nessuna risposta in tempo".
- Il payload MQTT `optimized` include anche un campo `valore_singolo` (booleano, distingue un placeholder temporaneo pubblicato dagli ESP32 da un aggregato consolidato). **Il backend lo ignora completamente**: ogni valore ricevuto, incluso quello singolo, viene persistito come dato normale e mai rimosso, senza campo di schema dedicato né esposizione all'API. Scelta deliberata, dopo aver valutato e scartato sia un campo di schema sia una struttura in memoria per tracciare e rimuovere i placeholder.
- Espone `GET /api/health` (risponde `{ status: 'ok' }`), usato dall'healthcheck Docker del container per determinare quando il servizio è pronto.
- Nella segmentazione di rete Docker (`backend-net`/`frontend-net`, vedi [README di root](../README.md)), il backend è l'unico servizio presente su entrambe le reti: è il solo punto di contatto tra frontend e servizi dati (MongoDB, Redis, broker MQTT).

---

## English

### Description

Subscribes to the optimized data published over MQTT by the ESP32 boards on the topic `home/<plug>/optimized`, persists it to MongoDB with a Redis cache, and exposes it to the frontend via REST API and WebSocket (Socket.IO). It also publishes commands directed at the other components: on/off commands on the `home/<deviceId>/commands` topic (executed by the gateway), healthcheck requests on `home/system/healthcheck` (answered by the gateway and the ESP32 boards subscribing to `home/system/healthcheck/response`), and requests to flush the retry queue on the ESP32 boards over `home/system/flush`. It also handles administrator authentication (JWT) and system logging with a dedicated endpoint.

It also exposes the consumption forecasts produced by the [Prophet](../prophet/README.md) module (`/api/previsioni`, written only by Prophet, read by the frontend) and an unauthenticated logging endpoint (`POST /api/logs`) used by unauthenticated external components, today only Prophet, to report failures. See "Forecast API and external logging" below for the exact contract.

Layered architecture: `routes` → `controllers` → `services` → `repositories`, with a single shared MQTT client and an authentication middleware (`verifyToken`) mounted on the admin routes.

### Requirements / versions

| Component | Version |
|---|---|
| Node.js | 20 (Docker image `node:20-slim`) |
| MongoDB | 7 |
| Redis | 7 |
| Eclipse Mosquitto (broker) | 2 |

Main libraries (`package.json`):

```
express       ^5.1.0
mongoose      ^8.0.0
redis         ^4.6.0    (official client, not ioredis)
mqtt          ^5.3.0
socket.io     ^4.7.0
jsonwebtoken  ^9.0.3
bcryptjs      ^3.0.3
dotenv        ^16.4.0
nodemon       ^3.0.0    (dev only)
jest          ^30.4.2   (dev only, testing)
supertest     ^7.2.2    (dev only, HTTP integration test)
```

Plain CommonJS, no transpiler/bundler.

### Setup

Two distinct `.env` files, **not interchangeable**:

**`backend/.env`**: used exclusively for local execution (`npm run dev`, outside Docker), the opposite of the root `.env`, which is the one actually read by `docker-compose.yml` and used in production. The backend container **never reads** `backend/.env`.

```dotenv
PORT=3000
MONGO_URI=mongodb://localhost:27017/iot_energy
REDIS_URI=redis://localhost:6379
MQTT_BROKER_URL=mqtt://localhost:1883

MQTT_USER=
MQTT_PASSWORD=

JWT_SECRET=
JWT_EXPIRES_IN=12h

ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=
```

**Root `.env`** (read by `docker-compose.yml`, the one actually used in production): same relevant keys (`MQTT_USER`, `MQTT_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`) plus `MONGO_ROOT_USER`/`MONGO_ROOT_PASSWORD`. `MQTT_USER`/`MQTT_PASSWORD` must match `gateway/config/.env` and the user created on the broker.

Secret generation:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"    # JWT_SECRET
node -e "require('bcryptjs').hash(process.argv[1],10).then(console.log)" 'your-password'   # ADMIN_PASSWORD_HASH
```

Both `middleware/auth.js` and `services/authService.js` check these variables at `require` time and throw an explicit error if any is missing: the process refuses to start until they are set.

### How to build/run it

**Locally, outside Docker** (requires reachable MongoDB/Redis/Mosquitto):
```bash
cd backend
cp .env.example .env   # and fill in the values
npm install
npm run dev             # nodemon, auto-restart
# or: npm start          (production, no auto-restart)
```

**Docker** (how it is actually deployed):
```bash
docker compose build backend
docker compose up -d --build backend
docker compose logs -f backend
```

Expected startup sequence in the logs: `[MongoDB] connesso`, then `[Redis] connesso`, then `[MQTT] connesso al broker`, then `[Server] in ascolto sulla porta 3000`. The service depends on `mongodb`/`redis`/`mosquitto` (`condition: service_healthy`) and won't start before they are ready.

The `Dockerfile` is multi-stage in three phases (`build` → `test` → `production`): the `test` stage runs `npm run test` as part of the build itself, so the code never reaches the production stage without the tests passing. For the `test` stage to actually run (Docker only builds the stages referenced by the final stage), `production` includes a targeted `COPY --from=test` of a file that isn't needed at runtime, used only to force `test` into the build graph: if the tests fail, the build stops there, before the production image is created.

### Internal structure

```
backend/
├── package.json
├── package-lock.json
├── .env.example
├── Dockerfile
├── .dockerignore
├── src/
│   ├── app.js
│   │   # entry point: Express + Socket.IO, mounts routes/middleware;
│   │   # real startup (Mongo/Redis/MQTT/listen) guarded by `if (require.main === module)`,
│   │   # so the app can be imported in tests without opening real connections
│   ├── config/
│   │   ├── db.js
│   │   │   # MongoDB (Mongoose) connection
│   │   └── redis.js
│   │       # Redis connection
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── comandoController.js
│   │   ├── consumoController.js
│   │   ├── logController.js
│   │   ├── presaController.js
│   │   └── previsioneController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   │   # verifyToken
│   │   └── errorHandler.js
│   │       # centralized error handler
│   ├── models/
│   │   ├── ConsumoOttimizzato.js
│   │   │   # time-series collection
│   │   ├── Log.js
│   │   │   # "logs" collection, 30-day TTL index
│   │   ├── Presa.js
│   │   └── Previsione.js
│   │       # generatoIl, orizzonte, valoriPrevisti[], metriche?/suggerimenti?/anomalie?, see below
│   ├── mqtt/
│   │   └── client.js
│   │       # single MQTT client: subscribes to optimized/healthcheck-response,
│   │       # publishes commands/flush/healthcheck, retry with backoff
│   ├── repositories/
│   │   ├── consumoRepository.js
│   │   ├── logRepository.js
│   │   ├── presaRepository.js
│   │   └── previsioneRepository.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   │   # POST /api/auth/login
│   │   ├── consumoRoutes.js
│   │   ├── logRoutes.js
│   │   │   # GET /api/logs (JWT), POST /api/logs (unauthenticated)
│   │   ├── presaRoutes.js
│   │   └── previsioneRoutes.js
│   │       # POST /api/previsioni/:presaId, GET /api/previsioni/:presaId/ultima, no JWT
│   ├── services/
│   │   ├── adminService.js
│   │   │   # flush/healthcheck
│   │   ├── authService.js
│   │   │   # login, JWT signing
│   │   ├── comandoService.js
│   │   │   # sends on/off commands, with MQTT retry
│   │   ├── consumoService.js
│   │   │   # consumption logic + Redis cache
│   │   ├── logService.js
│   │   │   # validates GET /api/logs filters
│   │   ├── presaService.js
│   │   └── previsioneService.js
│   ├── utils/
│   │   └── retry.js
│   │       # generic exponential-backoff retry
│   └── websocket/
│       └── index.js
│           # Socket.IO setup, push notifications per subscribed plug
└── tests/
    ├── unit/
    │   ├── utils/
    │   │   └── retry.test.js
    │   ├── mqtt/
    │   │   └── client.test.js
    │   ├── middleware/
    │   │   └── auth.test.js
    │   └── services/
    │       ├── consumoService.test.js
    │       ├── comandoService.test.js
    │       ├── presaService.test.js
    │       ├── authService.test.js
    │       ├── logService.test.js
    │       └── PrevisioneService.test.js
    └── integration/
        └── app.test.js
```

### Forecast API and external logging

Two routes built for integration with [Prophet](../prophet/README.md), **neither requires JWT** (same treatment as `/api/prese`/`/api/consumi`):

| Route | Used by | Notes |
|---|---|---|
| `POST /api/previsioni/:presaId` | Written only by Prophet | Every call creates a **new document**, never an in-place update: the forecast history accumulates. `presaId` is taken only from the path, any `presaId` in the body is ignored. Body: `orizzonte.da`/`orizzonte.a`, `valoriPrevisti[]` (`ds`, `yhat`, `yhatLower?`, `yhatUpper?`); `metriche?`/`suggerimenti?`/`anomalie?` optional |
| `GET /api/previsioni/:presaId/ultima` | Read by the frontend | Most recent forecast for the plug (ordered by `generatoIl`). 404 if none exists, same outcome for a `presaId` that was never registered: there's no separate plug-existence check |
| `POST /api/logs` | Unauthenticated external components (today only Prophet) | Reports failures without writing fake data elsewhere (e.g. `evento: "prophet.forecast_fallito"`). `origine` is **always forced to `'sistema'`** server-side: a different value in the body is ignored |

**Important format constraint**: every date in the `POST /api/previsioni/:presaId` body (`orizzonte.da`, `orizzonte.a`, every `valoriPrevisti[].ds`, every `anomalie[].ds`) **must have an explicit timezone** (`Z` or `±HH:MM` offset): the backend rejects a "naive" string (e.g. `"2026-08-11 14:00:00"`, pandas/Prophet's native tz-less format) with a 400. This isn't a minor implementation detail: a date without an explicit timezone is interpreted differently depending on the timezone of the server generating it (a two-hour discrepancy was observed between a UTC server and a Europe/Rome one on the exact same input).

On reads (`GET`), every date in the response is **always** ISO 8601 with `Z` (UTC): JavaScript's native behavior when serializing a `Date`, worth noting for anyone consuming the API (e.g. the frontend).

Full `Previsione` schema:
```
presaId: String (required)
generatoIl: Date (default: now)
orizzonte: { da: Date, a: Date } (required)
valoriPrevisti: [{ ds: Date, yhat: Number, yhatLower?: Number, yhatUpper?: Number }]
metriche?: { mae?: Number, rmse?: Number, baselineConfronto?: String }  // offline evaluation only
suggerimenti?: [String]                    // always present as an array, [] if absent from the body
anomalie?: [{ ds: Date, y: Number, punteggio: Number }]  // always present as an array, [] if absent from the body
```

### How to test it

#### Automated test suite

**Framework:** Jest, plus `supertest` for a single HTTP integration test.

**Setup** (if not already done):
```bash
cd backend
npm install --save-dev jest supertest
```
and add to `package.json`:
```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch"
}
```

**Commands:**
```bash
npm test                    # whole suite
npx jest <path-to-file>     # a single file
npm run test:watch          # auto re-run
```

No real `.env` or a running MongoDB/Redis/MQTT is needed: the entire external layer is mocked (Mongo/Redis repositories, MQTT client, the `Log` model), leaving all the application logic real; the integration test does the same at the whole-HTTP-application level. The only environment variables needed (`JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`) are set directly in the test files that need them.

**Current result:** 101 tests, all passing. The table below reflects the suite as it was introduced (9 suites, 62 tests); at least `PrevisioneService.test.js` has been added since then, with no per-file detail available for the increment.

| File | # tests | What it checks |
|---|---|---|
| `utils/retry.test.js` | 6 | Exponential backoff, retry exhaustion, default values |
| `mqtt/client.test.js` | 7 | ESP32→backend payload mapping, subscribing to the right topics, error/log handling on failure, command publishing |
| `services/consumoService.test.js` | 10 | Saving a reading + websocket notification, power-threshold auto-shutoff logic, cache reads |
| `services/comandoService.test.js` | 4 | On/off action validation, plug not found, MQTT publish + optimistic state update |
| `services/presaService.test.js` | 10 | Constraints on duplicate presaId/IP, field whitelist on update, device deregistration on removal |
| `services/authService.test.js` | 6 | Login with a real JWT, wrong credentials, missing fields, logging |
| `middleware/auth.test.js` | 5 | Valid/missing/malformed/expired token, token signed with the wrong secret |
| `services/logService.test.js` | 5 | Log search filter validation |
| `integration/app.test.js` | 9 | Real routing + controller + service + error handler + auth middleware, end-to-end via supertest |

Functional coverage of the critical paths and the contracts between components, not exhaustive.

#### Manual verification

Does not need a real gateway/ESP32 to respond to REST/auth calls (MQTT topics can be simulated with `mosquitto_pub`), but does require reachable MongoDB/Redis/Mosquitto.

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
# expected: { "token": "..." }
```

**Protected endpoints:**
```bash
curl http://localhost:3000/api/logs -H "Authorization: Bearer <token>"
curl -X POST http://localhost:3000/api/admin/flush -H "Authorization: Bearer <token>"
```

**Log filters:**
```bash
curl "http://localhost:3000/api/logs?livello=error&limite=20" -H "Authorization: Bearer <token>"
```

**Retry with backoff:** stop the `mosquitto` container and call `POST /api/admin/flush`; the backend logs show increasing-wait retry attempts, and after the fifth failure a document is written to `logs` with `evento: "mqtt.retry_esaurito"`.

### Notes and known limitations

- HTTPS was deliberately dropped: remote traffic already goes through Tailscale, encrypted at the WireGuard layer.
- Single administrator with fixed credentials in `.env`: no separate role, no registration, no refresh token. Holding a valid token already implies being the admin.
- `presaService.js`: the MongoDB write happens before the MQTT registration/removal of the device. If the publish fails after retries, the plug stays created/removed in Mongo without the gateway knowing (no rollback implemented).
- `adminService.js`: a publish failure after retries on flush/healthcheck is indistinguishable, on the HTTP side, from "no response arrived in time".
- The MQTT `optimized` payload also includes a `valore_singolo` field (boolean, distinguishes a temporary placeholder published by the ESP32 boards from a consolidated aggregate). **The backend ignores it entirely**: every value received, including the single one, is persisted as a normal reading and never removed, with no dedicated schema field and no API exposure. A deliberate choice, after evaluating and dropping both a schema field and an in-memory structure to track and remove placeholders.
- Exposes `GET /api/health` (responds `{ status: 'ok' }`), used by the container's Docker healthcheck to determine when the service is ready.
- In the Docker network segmentation (`backend-net`/`frontend-net`, see the [root README](../README.md)), the backend is the only service present on both networks: it's the sole point of contact between the frontend and the data services (MongoDB, Redis, MQTT broker).