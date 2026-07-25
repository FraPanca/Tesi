# gateway/

Servizio Python che legge i consumi dalle prese Tapo P110 e ne inoltra i comandi on/off. Parte del progetto [IoT Home Energy Monitor](../README.md).

## Italiano

### Descrizione

Legge corrente/tensione/potenza dalle prese Tapo P110 ogni `POLLING_INTERVAL` secondi tramite `python-kasa`, pubblica i dati grezzi sul topic MQTT `home/<deviceId>/raw`, e sottoscrive `home/<deviceId>/commands` per eseguire i comandi on/off inoltrati dal backend. Risponde inoltre alle richieste di healthcheck su `home/system/healthcheck`, pubblicando lo stato su `home/system/healthcheck/response`. Rilegge periodicamente `devices.json` per intercettare l'aggiunta/rimozione di prese senza dover riavviare il processo.

**È l'unico servizio dell'architettura a girare fuori Docker**, nativamente sull'host del Raspberry Pi (vedi il [README di root](../README.md) per la motivazione della scelta).

### Requisiti di sistema

- Python 3.13 (sviluppato in venv su Raspberry Pi 5, architettura aarch64)
- Un **account Tapo** (TP-Link), lo stesso usato per configurare le prese nell'app: `python-kasa` si autentica al cloud Tapo con queste credenziali, non solo in locale
- Accesso di rete locale alle prese Tapo P110 (stessa LAN/VLAN), raggiungibili agli IP fissi indicati nel [README di root](../README.md#indirizzi-ip-statici)
- Il broker MQTT (vedi [`mosquitto/`](../mosquitto/README.md)) deve essere raggiungibile — non richiede backend/frontend attivi

#### Dipendenze Python (`requirements.txt`)

```
python-kasa==0.10.2
paho-mqtt==2.1.0
python-dotenv==1.2.2
```

Solo le dipendenze dirette sono pinnate; le transitive (`aiohttp`, `cryptography`, ecc.) sono risolte da pip.

### Setup

```bash
cd gateway
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp config/.env.example config/.env
# compilare: TAPO_USERNAME, TAPO_PASSWORD, MQTT_USER, MQTT_PASSWORD
# (MQTT_USER/PASSWORD devono coincidere con il passwordfile di mosquitto e col .env di root)

# modificare config/devices.json con ip + id di ogni presa Tapo P110
```

Le credenziali del broker vanno create separatamente — vedi [`mosquitto/README.md`](../mosquitto/README.md).

### Variabili d'ambiente (`config/.env`)

| Variabile | Scopo | Note |
|---|---|---|
| `TAPO_USERNAME` / `TAPO_PASSWORD` | Login account Tapo (cloud) | stesso account usato nell'app |
| `MQTT_BROKER` | Host del broker | `localhost` — il gateway è nativo sull'host, il broker è raggiunto via port mapping Docker |
| `MQTT_PORT` | Porta broker | `1883` |
| `MQTT_USER` / `MQTT_PASSWORD` | Credenziali MQTT | devono coincidere col `passwordfile` di mosquitto e col `.env` di root |
| `POLLING_INTERVAL` | Secondi tra due letture della stessa presa | default `10` |
| `CHECK_INTERVAL` | Secondi tra due riletture di `devices.json` (add/remove) | default `30` |
| `WARNING_INTERVAL` | Ogni quanti fallimenti consecutivi loggare un warning aggregato | default `5` |
| `BACKOFF_TIME` | Tetto massimo (secondi) del backoff esponenziale sui retry di connessione | default `60` |
| `LOG_MAX_BYTES` / `LOG_BACKUP_COUNT` | Rotazione log | default `1000000` / `3` |

### Come eseguirlo

```bash
cd src
source ../venv/bin/activate   # se non già attivo
python main.py
```

Nessun comando di build: componente interamente interpretato (Python), nessuno step di compilazione.

### Struttura interna

```
gateway/
├── requirements.txt
├── venv/
│   # non tracciato — va ricreato
├── config/
│   ├── .env
│   │   # non tracciato — credenziali reali
│   ├── .env.example
│   │   # tracciato — template
│   ├── devices.json
│   │   # tracciato — mapping ip -> id presa
├── logs/
│   ├── .gitkeep
│   ├── presa1.log
│   ├── presa2.log
│   │   # uno per device_id, ruotati automaticamente
│   ├── warning.log
│   ├── error.log
└── src/
    ├── config.py
    │   # carica .env, definisce costanti (path, MQTT, intervalli)
    ├── main.py
    │   # entrypoint
    ├── devices/
    │   ├── device_manager.py
    │   │   # orchestratore: crea/rimuove task asyncio per ogni presa
    │   ├── device_monitor.py
    │   │   # loop per singola presa: polling, backoff, comandi
    ├── mqtt/
    │   ├── mqtt_publisher.py
    │   │   # client MQTT dedicato al publish
    │   ├── mqtt_subscriber.py
    │   │   # client MQTT dedicato al subscribe (comandi, healthcheck)
    ├── logger/
    │   ├── energy_logger.py
    │   │   # log rotanti (RotatingFileHandler)
    └── registry/
        ├── device_registry.py
        │   # CRUD su devices.json
```

### Come testarlo in isolamento

È possibile testare questo componente da solo, a condizione che il broker MQTT sia già attivo: non sono necessari backend, frontend, MongoDB o Redis.

**Verifica connessione base**: al lancio di `python main.py`, in console: `SYSTEM => MQTT connected`, poi `SYSTEM => Started monitoring for <id> (<ip>)` per ogni presa in `devices.json`, poi letture periodiche `DEVICE: <id> => Power: ... W`.

**Verifica dati sul broker:**
```bash
docker exec -it mosquitto mosquitto_sub -t "home/+/raw" -u <user> -P <password>
```
Payload atteso: `{"deviceId": "presa1", "timestamp": 1784454193.22, "power": 12.4, "voltage": 230.1, "current": 0.054}`

**Test comando on/off:**
```bash
docker exec -it mosquitto mosquitto_pub -t "home/presa1/commands" \
  -m '{"action":"off","ip":"192.168.1.180"}' -u <user> -P <password>
```

**Test healthcheck:**
```bash
docker exec -it mosquitto mosquitto_sub -t "home/system/healthcheck/response" -u <user> -P <password>
docker exec -it mosquitto mosquitto_pub -t "home/system/healthcheck" -m '{}' -u <user> -P <password>
# risposta attesa: {"componente": "gateway", "stato": "ok"}
```

**Test CLI diretto sulle prese** (bypassa MQTT, isola problemi di connessione fisica):
```bash
kasa --host <ip> --username <TAPO_USERNAME> --password <TAPO_PASSWORD> discover
```

### Note e limiti noti

- Timestamp nel payload `raw`: epoch UTC in secondi (`time.time()`), non ISO 8601 — assunzione implicita che backend e modulo Prophet devono trattare in modo coerente.
- `deviceId` è un id fisso (`presaN`, in `devices.json`), non l'alias impostato nell'app Tapo — per non rompere la continuità delle serie storiche se l'utente rinomina una presa.
- Due client MQTT separati e indipendenti (publish/subscribe): chi estende la logica di risposta a un comando deve importare esplicitamente `mqtt_publisher`.
- Dispositivi Tapo con schema di crittografia `TPAP` (dopo aggiornamento firmware auto-update) non sono supportati da `python-kasa` (`Unsupported device ... encrypt_type='TPAP'`). Workaround verificato: nell'app Tapo, Me → Third-Party Compatibility → disattivare e riattivare il toggle. Consigliato disattivare gli aggiornamenti firmware automatici sulle prese.

---

## English

### Description

Reads current/voltage/power from the Tapo P110 plugs every `POLLING_INTERVAL` seconds via `python-kasa`, publishes the raw data to the MQTT topic `home/<deviceId>/raw`, and subscribes to `home/<deviceId>/commands` to execute the on/off commands forwarded by the backend. It also answers healthcheck requests on `home/system/healthcheck`, publishing its status on `home/system/healthcheck/response`. It periodically re-reads `devices.json` to pick up added/removed plugs without restarting the process.

**It is the only service in the architecture that runs outside Docker**, natively on the Raspberry Pi host (see the [root README](../README.md) for the reasoning behind this choice).

### System requirements

- Python 3.13 (developed in a venv on a Raspberry Pi 5, aarch64 architecture)
- A **Tapo account** (TP-Link), the same one used to set up the plugs in the app: `python-kasa` authenticates against the Tapo cloud with these credentials, not just locally
- Local network access to the Tapo P110 plugs (same LAN/VLAN), reachable at the fixed IPs listed in the [root README](../README.md#static-ip-addresses)
- The MQTT broker (see [`mosquitto/`](../mosquitto/README.md)) must be reachable — no backend/frontend needed

#### Python dependencies (`requirements.txt`)

```
python-kasa==0.10.2
paho-mqtt==2.1.0
python-dotenv==1.2.2
```

Only direct dependencies are pinned; transitive ones (`aiohttp`, `cryptography`, etc.) are resolved by pip.

### Setup

```bash
cd gateway
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp config/.env.example config/.env
# fill in: TAPO_USERNAME, TAPO_PASSWORD, MQTT_USER, MQTT_PASSWORD
# (MQTT_USER/PASSWORD must match mosquitto's passwordfile and the root .env)

# edit config/devices.json with the ip + id of each Tapo P110 plug
```

Broker credentials must be created separately — see [`mosquitto/README.md`](../mosquitto/README.md).

### Environment variables (`config/.env`)

| Variable | Purpose | Notes |
|---|---|---|
| `TAPO_USERNAME` / `TAPO_PASSWORD` | Tapo (cloud) account login | same account used in the app |
| `MQTT_BROKER` | Broker host | `localhost` — the gateway runs natively on the host, the broker is reached through Docker port mapping |
| `MQTT_PORT` | Broker port | `1883` |
| `MQTT_USER` / `MQTT_PASSWORD` | MQTT credentials | must match mosquitto's `passwordfile` and the root `.env` |
| `POLLING_INTERVAL` | Seconds between two readings of the same plug | default `10` |
| `CHECK_INTERVAL` | Seconds between two re-reads of `devices.json` (add/remove) | default `30` |
| `WARNING_INTERVAL` | Consecutive failures before logging an aggregated warning | default `5` |
| `BACKOFF_TIME` | Max cap (seconds) for exponential backoff on connection retries | default `60` |
| `LOG_MAX_BYTES` / `LOG_BACKUP_COUNT` | Log rotation | default `1000000` / `3` |

### How to run it

```bash
cd src
source ../venv/bin/activate   # if not already active
python main.py
```

No build step: entirely interpreted (Python), no compilation involved.

### Internal structure

```
gateway/
├── requirements.txt
├── venv/
│   # not tracked — must be recreated
├── config/
│   ├── .env
│   │   # not tracked — real credentials
│   ├── .env.example
│   │   # tracked — template
│   ├── devices.json
│   │   # tracked — ip -> plug id mapping
├── logs/
│   ├── .gitkeep
│   ├── presa1.log
│   ├── presa2.log
│   │   # one per device_id, auto-rotated
│   ├── warning.log
│   ├── error.log
└── src/
    ├── config.py
    │   # loads .env, defines constants (paths, MQTT, intervals)
    ├── main.py
    │   # entrypoint
    ├── devices/
    │   ├── device_manager.py
    │   │   # orchestrator: creates/removes an asyncio task per plug
    │   ├── device_monitor.py
    │   │   # per-plug loop: polling, backoff, commands
    ├── mqtt/
    │   ├── mqtt_publisher.py
    │   │   # MQTT client dedicated to publishing
    │   ├── mqtt_subscriber.py
    │   │   # MQTT client dedicated to subscribing (commands, healthcheck)
    ├── logger/
    │   ├── energy_logger.py
    │   │   # rotating logs (RotatingFileHandler)
    └── registry/
        ├── device_registry.py
        │   # CRUD on devices.json
```

### How to test it in isolation

This component can be tested on its own, provided the MQTT broker is already running: no backend, frontend, MongoDB, or Redis is required.

**Basic connection check**: on `python main.py` startup, the console shows: `SYSTEM => MQTT connected`, then `SYSTEM => Started monitoring for <id> (<ip>)` for each plug in `devices.json`, then periodic `DEVICE: <id> => Power: ... W` readings.

**Checking data on the broker:**
```bash
docker exec -it mosquitto mosquitto_sub -t "home/+/raw" -u <user> -P <password>
```
Expected payload: `{"deviceId": "presa1", "timestamp": 1784454193.22, "power": 12.4, "voltage": 230.1, "current": 0.054}`

**Testing an on/off command:**
```bash
docker exec -it mosquitto mosquitto_pub -t "home/presa1/commands" \
  -m '{"action":"off","ip":"192.168.1.180"}' -u <user> -P <password>
```

**Testing healthcheck:**
```bash
docker exec -it mosquitto mosquitto_sub -t "home/system/healthcheck/response" -u <user> -P <password>
docker exec -it mosquitto mosquitto_pub -t "home/system/healthcheck" -m '{}' -u <user> -P <password>
# expected response: {"componente": "gateway", "stato": "ok"}
```

**Direct CLI test on the plugs** (bypasses MQTT, isolates physical connection issues):
```bash
kasa --host <ip> --username <TAPO_USERNAME> --password <TAPO_PASSWORD> discover
```

### Notes and known limitations

- Timestamp in the `raw` payload: UTC epoch in seconds (`time.time()`), not ISO 8601 — an implicit assumption that the backend and the Prophet module must handle consistently.
- `deviceId` is a fixed id (`presaN`, in `devices.json`), not the alias set in the Tapo app — so the historical series stays continuous even if the user renames a plug.
- Two separate, independent MQTT clients (publish/subscribe): anyone extending the response logic for an incoming command must explicitly import `mqtt_publisher`.
- Tapo devices with the `TPAP` encryption scheme (after a firmware auto-update) are not supported by `python-kasa` (`Unsupported device ... encrypt_type='TPAP'`). Verified workaround: in the Tapo app, Me → Third-Party Compatibility → toggle off and back on. Disabling automatic firmware updates on the plugs is recommended.
