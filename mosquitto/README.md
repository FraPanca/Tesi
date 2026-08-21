# mosquitto/

Configurazione del broker MQTT Eclipse Mosquitto. Parte del progetto [IoT Home Energy Monitor](../README.md).

## Italiano

### Descrizione

Punto di scambio intermedio tra tutti i componenti del sistema (gateway, ESP32, backend): riceve i dati grezzi delle prese dal gateway, li rende disponibili all'ESP32 load balancer per l'instradamento verso i worker, riceve i dati ottimizzati diretti al backend, e inoltra in entrambe le direzioni i comandi on/off e le richieste di stato/manutenzione (healthcheck, flush). Richiede autenticazione (`allow_anonymous false`): nessun client può connettersi senza uno username/password validi nel `passwordfile`.

### Requisiti

- Docker + plugin Docker Compose
- Immagine ufficiale `eclipse-mosquitto:2`, usata così com'è, nessun Dockerfile custom
- Autenticazione obbligatoria (`allow_anonymous false`): richiede un file di password generato a mano (vedi Setup)

### Setup

**Generazione delle credenziali** (una tantum, o al cambio password):
```bash
docker run --rm -it \
  -v $(pwd)/config:/mosquitto/config \
  --entrypoint mosquitto_passwd \
  eclipse-mosquitto:2 \
  -c /mosquitto/config/passwordfile <username>
```
`-c` crea o sovrascrive il file: usarlo solo la prima volta; per utenti aggiuntivi, stesso comando senza `-c`.

**Permessi** (l'utente interno del container ha uid/gid `1883`):
```bash
sudo chown 1883:1883 config/passwordfile
sudo chmod 0700 config/passwordfile
sudo chown -R 1883:1883 data log
```

Le stesse credenziali (`MQTT_USER`/`MQTT_PASSWORD`) vanno impostate in tre punti coerenti: `.env` di root, `gateway/config/.env`, `esp32/*/secrets.h`. Vedi il [README di root](../README.md).

### Come eseguirlo

```bash
# dalla root del progetto, dove sta docker-compose.yml
docker compose up -d mosquitto
docker compose ps   # attendere STATUS "healthy"
```

Nessun comando di build: immagine ufficiale, nessuna compilazione.

### Struttura interna

```
mosquitto/
└── config/
    ├── mosquitto.conf
    │   # tracciato, nessun segreto
    └── passwordfile
        # non tracciato, hash delle credenziali MQTT
```

`data/` e `log/` non sono tracciati e vengono creati a runtime dal container per la persistenza del broker (`mosquitto.db`) e per i suoi log. `persistence true` è attivo in `mosquitto.conf`.

### Flusso dati e topic MQTT

Tutti i topic del sistema passano da questo broker. Tabella completa:

| Topic | Publisher | Subscriber | Payload (esempio) | Descrizione |
|---|---|---|---|---|
| `home/<deviceId>/raw` | Gateway | Load balancer ESP32 (sottoscrive `home/+/raw`) | `{"deviceId":"presa1","timestamp":1784454193.22,"power":12.4,"voltage":230.1,"current":0.054}` | Lettura grezza di potenza/tensione/corrente di una presa |
| `home/lb/worker1/raw` | Load balancer | Worker 1 | stesso payload di `raw` | Instradamento del dato grezzo verso il worker assegnato al dispositivo (parità dell'hash calcolato sul topic di arrivo) |
| `home/lb/worker2/raw` | Load balancer | Worker 2 | stesso payload di `raw` | Come sopra, per i dispositivi instradati sull'altro worker |
| `home/<presa_id>/optimized` | Worker 1 / Worker 2 | Backend | `{"presa_id":"presa1","power_w":12.6,"voltage_v":230.0,"current_a":0.055,"sample_count":6,"timestamp_start":...,"timestamp_end":...}` | Dato ottimizzato, pronto per la persistenza su MongoDB |
| `home/<deviceId>/commands` | Backend | Gateway | `{"action":"off","ip":"192.168.1.180"}` | Comando on/off inoltrato dal frontend ed eseguito dal gateway sulla presa fisica |
| `home/system/healthcheck` | Backend (admin) | Gateway, Load balancer, Worker 1, Worker 2 | `{}` | Richiesta di stato, in broadcast a tutti i componenti |
| `home/system/healthcheck/response` | Gateway, Load balancer, Worker 1, Worker 2 | Backend | `{"componente":"gateway","stato":"ok"}` | Risposta individuale di ciascun componente alla richiesta di healthcheck |
| `home/system/flush` | Backend (admin) | Worker 1, Worker 2 | `{}` | Richiesta di svuotamento della coda di ritentativo dei messaggi `optimized` pendenti (solo i worker) |

Nessun ACL per-topic è configurato: un client autenticato può sottoscrivere/pubblicare su qualsiasi topic, l'unico controllo d'accesso è a livello di connessione (username/password).

### Come testarlo in isolamento

```bash
# sottoscrizione a tutti i topic (verifica generale del traffico)
docker exec -it mosquitto mosquitto_sub -t "home/#" -v -u <user> -P <password>

# pubblicazione manuale di un dato grezzo (simula il gateway)
docker exec -it mosquitto mosquitto_pub -t "home/presa1/raw" \
  -m '{"deviceId":"presa1","timestamp":1784471181.5,"power":11.3,"voltage":225.1,"current":0.084}' \
  -u <user> -P <password>
```

### Note e limiti noti

- Impostare le credenziali come variabili d'ambiente del container Docker (fatto nel compose) **non crea da sola** l'utente sul broker: serve sempre il passo `mosquitto_passwd`.
- Nessun ACL per-topic configurato o verificato, vedi sopra.
- Dati persistiti su hard disk esterno, non sulla scheda SD del Raspberry. Vedi [`systemd/README.md`](../systemd/README.md) e il [README di root](../README.md) per il setup del mount.
- Nella segmentazione di rete Docker (`backend-net`/`frontend-net`, vedi [README di root](../README.md)), il broker è su `backend-net`: non è raggiungibile direttamente dal frontend, solo da gateway (via port mapping sull'host), backend, ed ESP32 (via rete locale).

---

## English

### Description

Intermediate exchange point between all the system's components (gateway, ESP32, backend): receives raw plug data from the gateway, makes it available to the ESP32 load balancer for routing to the workers, receives the optimized data destined for the backend, and forwards on/off commands and status/maintenance requests (healthcheck, flush) in both directions. Requires authentication (`allow_anonymous false`): no client can connect without a valid username/password in the `passwordfile`.

### Requirements

- Docker + Docker Compose plugin
- Official `eclipse-mosquitto:2` image, used as is, no custom Dockerfile
- Authentication is mandatory (`allow_anonymous false`): requires a manually generated password file (see Setup)

### Setup

**Generating credentials** (one-time, or when the password changes):
```bash
docker run --rm -it \
  -v $(pwd)/config:/mosquitto/config \
  --entrypoint mosquitto_passwd \
  eclipse-mosquitto:2 \
  -c /mosquitto/config/passwordfile <username>
```
`-c` creates or overwrites the file: use it only the first time; for additional users, run the same command without `-c`.

**Permissions** (the container's internal user has uid/gid `1883`):
```bash
sudo chown 1883:1883 config/passwordfile
sudo chmod 0700 config/passwordfile
sudo chown -R 1883:1883 data log
```

The same credentials (`MQTT_USER`/`MQTT_PASSWORD`) must be set consistently in three places: the root `.env`, `gateway/config/.env`, and `esp32/*/secrets.h`. See the [root README](../README.md).

### How to run it

```bash
# from the project root, where docker-compose.yml lives
docker compose up -d mosquitto
docker compose ps   # wait until STATUS shows "healthy"
```

No build step: official image, nothing to compile.

### Internal structure

```
mosquitto/
└── config/
    ├── mosquitto.conf
    │   # tracked, no secrets
    └── passwordfile
        # not tracked, MQTT credential hashes
```

`data/` and `log/` are not tracked and are created at runtime by the container for the broker's persistence (`mosquitto.db`) and its logs. `persistence true` is enabled in `mosquitto.conf`.

### Data flow and MQTT topics

Every topic in the system passes through this broker. Full table:

| Topic | Publisher | Subscriber | Payload (example) | Description |
|---|---|---|---|---|
| `home/<deviceId>/raw` | Gateway | ESP32 load balancer (subscribes to `home/+/raw`) | `{"deviceId":"presa1","timestamp":1784454193.22,"power":12.4,"voltage":230.1,"current":0.054}` | Raw power/voltage/current reading from a plug |
| `home/lb/worker1/raw` | Load balancer | Worker 1 | same payload as `raw` | Routes the raw reading to the worker assigned to the device (parity of a hash computed on the incoming topic) |
| `home/lb/worker2/raw` | Load balancer | Worker 2 | same payload as `raw` | Same as above, for devices routed to the other worker |
| `home/<presa_id>/optimized` | Worker 1 / Worker 2 | Backend | `{"presa_id":"presa1","power_w":12.6,"voltage_v":230.0,"current_a":0.055,"sample_count":6,"timestamp_start":...,"timestamp_end":...}` | Optimized reading, ready for persistence to MongoDB |
| `home/<deviceId>/commands` | Backend | Gateway | `{"action":"off","ip":"192.168.1.180"}` | On/off command forwarded by the frontend and executed by the gateway on the physical plug |
| `home/system/healthcheck` | Backend (admin) | Gateway, Load balancer, Worker 1, Worker 2 | `{}` | Status request, broadcast to all components |
| `home/system/healthcheck/response` | Gateway, Load balancer, Worker 1, Worker 2 | Backend | `{"componente":"gateway","stato":"ok"}` | Individual response from each component to the healthcheck request |
| `home/system/flush` | Backend (admin) | Worker 1, Worker 2 | `{}` | Request to empty the retry queue of pending `optimized` messages (workers only) |

No per-topic ACL is configured: an authenticated client can subscribe/publish to any topic, the only access control is at the connection level (username/password).

### How to test it in isolation

```bash
# subscribe to all topics (general traffic check)
docker exec -it mosquitto mosquitto_sub -t "home/#" -v -u <user> -P <password>

# manually publish a raw reading (simulates the gateway)
docker exec -it mosquitto mosquitto_pub -t "home/presa1/raw" \
  -m '{"deviceId":"presa1","timestamp":1784471181.5,"power":11.3,"voltage":225.1,"current":0.084}' \
  -u <user> -P <password>
```

### Notes and known limitations

- Setting credentials as Docker environment variables (already done in the compose file) does **not** create the broker user by itself: the `mosquitto_passwd` step is always required.
- No per-topic ACL configured or verified, see above.
- Data is persisted on the external hard disk, not on the Raspberry Pi's SD card. See [`systemd/README.md`](../systemd/README.md) and the [root README](../README.md) for the mount setup.
- In the Docker network segmentation (`backend-net`/`frontend-net`, see the [root README](../README.md)), the broker is on `backend-net`: it isn't directly reachable from the frontend, only from the gateway (via port mapping on the host), the backend, and the ESP32 boards (via the local network).