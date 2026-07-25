# backend/

API REST + WebSocket del sistema, in Node.js/Express. Parte del progetto [IoT Home Energy Monitor](../README.md).

## Italiano

### Descrizione

Sottoscrive i dati ottimizzati pubblicati via MQTT dagli ESP32 sul topic `home/<presa>/optimized`, li persiste su MongoDB con cache Redis, e li espone al frontend tramite REST API e WebSocket (Socket.IO). Pubblica inoltre sul broker i comandi diretti agli altri componenti: i comandi on/off sul topic `home/<deviceId>/commands` (eseguiti dal gateway), le richieste di healthcheck su `home/system/healthcheck` (a cui rispondono gateway ed ESP32 sottoscrivendo `home/system/healthcheck/response`) e le richieste di flush della coda di ritentativo verso gli ESP32 su `home/system/flush`. Gestisce inoltre l'autenticazione dell'amministratore (JWT) e il logging di sistema con endpoint dedicato.

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
```

CommonJS puro, nessun transpiler/bundler.

### Setup

Due file `.env` distinti, **non intercambiabili**:

**`backend/.env`** — serve esclusivamente per l'esecuzione locale (`npm run dev`, fuori Docker): è l'opposto del `.env` nella root, che è invece quello effettivamente letto da `docker-compose.yml` e usato in produzione. Il container backend **non legge mai** `backend/.env`.

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

Sequenza di avvio attesa nei log: `[MongoDB] connesso` → `[Redis] connesso` → `[MQTT] connesso al broker` → `[Server] in ascolto sulla porta 3000`. Il servizio dipende da `mongodb`/`redis`/`mosquitto` (`condition: service_healthy`): non si avvia prima che siano pronti.

Il `Dockerfile` copia prima solo `package*.json` ed esegue `npm ci --omit=dev`, poi copia il resto del codice — mantiene il layer delle dipendenze in cache Docker.

### Struttura interna

```
backend/
├── package.json
├── package-lock.json
├── .env.example
├── Dockerfile
├── .dockerignore
└── src/
    ├── app.js
    │   # entry point: Express + Socket.IO, mount rotte/middleware
    ├── config/
    │   # connessione MongoDB (Mongoose) e Redis
    ├── models/
    │   # Presa, ConsumoOttimizzato (time-series), Previsione, Log (TTL 30gg)
    ├── repositories/
    │   # accesso dati puro (Mongoose + Redis), nessuna logica di business
    ├── services/
    │   # logica di business: presa, consumo (+cache), comando (+retry MQTT),
    │   # admin (flush/healthcheck), auth (JWT), log
    ├── controllers/
    │   # orchestrazione req/res
    ├── routes/
    │   # endpoint Express (auth, logs, admin, presa, consumo)
    ├── middleware/
    │   # errorHandler centralizzato, auth (verifyToken)
    ├── mqtt/
    │   ├── client.js
    │   │   # client MQTT unico: subscribe optimized/healthcheck-response,
    │   │   # publish comandi/flush/healthcheck, retry con backoff
    ├── websocket/
    │   # setup Socket.IO, notifica push per presa sottoscritta
    └── utils/
        ├── retry.js
        │   # retry generico con backoff esponenziale
```

### Come testarlo in isolamento

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

**Retry con backoff** (verifica manuale): fermare il container `mosquitto` e chiamare `POST /api/admin/flush`; nei log del backend compaiono i tentativi con attesa crescente, e dopo il quinto fallimento un documento in `logs` con `evento: "mqtt.retry_esaurito"`.

Nessuna test suite automatizzata — verifica finora manuale (`curl`, `mosquitto_pub`/`sub`, `redis-cli`, `mongosh`).

### Note e limiti noti

- HTTPS scartato per scelta: il traffico remoto passa da Tailscale, cifrato a livello WireGuard.
- Un solo amministratore con credenziali fisse in `.env`: nessun ruolo separato, nessuna registrazione, nessun refresh token — possedere un token valido implica essere l'admin.
- `presaService.js`: la scrittura su MongoDB avviene prima della registrazione/rimozione MQTT del dispositivo — se la pubblicazione fallisce dopo i retry, la presa resta creata/rimossa in Mongo senza che il gateway lo sappia (nessun rollback implementato).
- `adminService.js`: un fallimento di pubblicazione dopo i retry su flush/healthcheck è indistinguibile lato HTTP da "nessuna risposta in tempo".

---

## English

### Description

Subscribes to the optimized data published over MQTT by the ESP32 boards on the topic `home/<plug>/optimized`, persists it to MongoDB with a Redis cache, and exposes it to the frontend via REST API and WebSocket (Socket.IO). It also publishes commands directed at the other components: on/off commands on the `home/<deviceId>/commands` topic (executed by the gateway), healthcheck requests on `home/system/healthcheck` (answered by the gateway and the ESP32 boards subscribing to `home/system/healthcheck/response`), and requests to flush the retry queue on the ESP32 boards over `home/system/flush`. It also handles administrator authentication (JWT) and system logging with a dedicated endpoint.

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
```

Plain CommonJS, no transpiler/bundler.

### Setup

Two distinct `.env` files, **not interchangeable**:

**`backend/.env`** — used exclusively for local execution (`npm run dev`, outside Docker): it is the opposite of the root `.env`, which is the one actually read by `docker-compose.yml` and used in production. The backend container **never reads** `backend/.env`.

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

Expected startup sequence in the logs: `[MongoDB] connesso` → `[Redis] connesso` → `[MQTT] connesso al broker` → `[Server] in ascolto sulla porta 3000`. The service depends on `mongodb`/`redis`/`mosquitto` (`condition: service_healthy`) and won't start before they are ready.

The `Dockerfile` first copies only `package*.json` and runs `npm ci --omit=dev`, then copies the rest of the code — this keeps the dependency layer cached by Docker.

### Internal structure

```
backend/
├── package.json
├── package-lock.json
├── .env.example
├── Dockerfile
├── .dockerignore
└── src/
    ├── app.js
    │   # entry point: Express + Socket.IO, mounts routes/middleware
    ├── config/
    │   # MongoDB (Mongoose) and Redis connection
    ├── models/
    │   # Presa, ConsumoOttimizzato (time-series), Previsione, Log (30-day TTL)
    ├── repositories/
    │   # pure data access (Mongoose + Redis), no business logic
    ├── services/
    │   # business logic: plug, consumption (+cache), command (+MQTT retry),
    │   # admin (flush/healthcheck), auth (JWT), logs
    ├── controllers/
    │   # req/res orchestration
    ├── routes/
    │   # Express endpoints (auth, logs, admin, plug, consumption)
    ├── middleware/
    │   # centralized error handler, auth (verifyToken)
    ├── mqtt/
    │   ├── client.js
    │   │   # single MQTT client: subscribes to optimized/healthcheck-response,
    │   │   # publishes commands/flush/healthcheck, retry with backoff
    ├── websocket/
    │   # Socket.IO setup, push notifications per subscribed plug
    └── utils/
        ├── retry.js
        │   # generic exponential-backoff retry
```

### How to test it in isolation

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

**Retry with backoff** (manual check): stop the `mosquitto` container and call `POST /api/admin/flush`; the backend logs show increasing-wait retry attempts, and after the fifth failure a document is written to `logs` with `evento: "mqtt.retry_esaurito"`.

No automated test suite — verification so far has been manual (`curl`, `mosquitto_pub`/`sub`, `redis-cli`, `mongosh`).

### Notes and known limitations

- HTTPS was deliberately dropped: remote traffic already goes through Tailscale, encrypted at the WireGuard layer.
- Single administrator with fixed credentials in `.env`: no separate role, no registration, no refresh token — holding a valid token already implies being the admin.
- `presaService.js`: the MongoDB write happens before the MQTT registration/removal of the device — if the publish fails after retries, the plug stays created/removed in Mongo without the gateway knowing (no rollback implemented).
- `adminService.js`: a publish failure after retries on flush/healthcheck is indistinguishable, on the HTTP side, from "no response arrived in time".
