# esp32/

Firmware C++ per i 3 ESP32 del sistema (1 load balancer + 2 worker). Parte del progetto [IoT Home Energy Monitor](../README.md).

## Italiano

### Descrizione

Il **load balancer** riceve i dati grezzi pubblicati dal gateway (sottoscrive `home/+/raw`) e li instrada verso uno dei 2 **worker**, calcolando un hash sul topic MQTT di arrivo e instradando in base alla sua parità (pari/dispari): la stessa presa finisce quindi sempre sullo stesso worker, non un round-robin per singolo messaggio. Ogni **worker** raggruppa le letture simili entro una certa tolleranza, scarta errori/rumore isolato, e pubblica il dato ottimizzato consumato poi dal backend. I tre ESP32 comunicano solo via WiFi + MQTT, senza collegamento fisico tra loro tranne durante flash/debug via USB.

### Requisiti di sistema

- Arduino IDE 2.x
- Board package "esp32 by Espressif Systems", da Boards Manager: `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
- Board selezionata: "ESP32 Dev Module"
- Librerie (Library Manager):
  - `PubSubClient` (Nick O'Leary): supporta solo QoS 0 in pubblicazione, nessuna ritrasmissione/ack reale a livello di protocollo
  - `ArduinoJson` ≥ 7.0 (Benoit Blanchon): API `JsonDocument`, non la vecchia `StaticJsonDocument<N>` di v6
- Driver USB-seriale adatto alla propria board (CP2102/CP2104: Silicon Labs; CH340/CH9102: WCH)
- Alimentazione **dedicata consigliata** per ogni ESP32: un hub USB passivo condiviso può causare brownout/reset (`POWERON_RESET`, `RTCWDT_RTC_RESET`) per i picchi di corrente del WiFi (~400-500mA)

### Setup

1. Installare Arduino IDE + board package ESP32
2. Installare `PubSubClient` e `ArduinoJson` da Library Manager
3. Installare il driver USB-seriale adatto alla propria board
4. Per ciascuna cartella (`load_balancer/`, `worker1/`, `worker2/`): copiare `secrets.h.example` in `secrets.h` e compilare:
   ```c
   #define WIFI_SSID     "..."
   #define WIFI_PASSWORD "..."
   #define MQTT_BROKER   "192.168.1.178"   // IP del Raspberry Pi 5
   #define MQTT_USER     "..."             // stesso utente di gateway/config/.env
   #define MQTT_PASS     "..."             // stessa password di gateway/config/.env
   ```

Solo `secrets.h` è un duplicato identico nelle 3 cartelle. `config.h` invece **differisce** tra load balancer e worker (worker1 e worker2 hanno lo stesso `config.h`): la differenza riguarda la gestione dei LED, diversa tra i due ruoli (vedi tabella in Configurazione).

### Come buildarlo/caricarlo

Nessun comando da riga di comando: bottone **Upload** di Arduino IDE (Board: "ESP32 Dev Module", Port: la COM assegnata). Se l'upload si blocca su "Connecting....." su una board senza auto-reset, tenere premuto **BOOT/IO0** durante la connessione. Serial Monitor a **115200 baud** per i log.

### Struttura interna

```
esp32/
├── load_balancer/
│   ├── load_balancer.ino
│   ├── config.h
│   │   # non sensibile, versionabile; gestione LED specifica del load balancer
│   ├── secrets.h
│   │   # WiFi + credenziali MQTT, NON versionare
│   ├── secrets.h.example
│   │   # template versionabile
├── worker1/
│   ├── worker1.ino
│   │   # WORKER_ID 1 hardcoded
│   ├── config.h
│   ├── secrets.h
│   ├── secrets.h.example
└── worker2/
    ├── worker2.ino
    │   # WORKER_ID 2 hardcoded
    ├── config.h
    ├── secrets.h
    ├── secrets.h.example
```

### Configurazione (`config.h`)

| Costante | Valore | Significato |
|---|---|---|
| `MQTT_PORT` | 1883 | |
| `SOGLIA_ASSOLUTA_W` | 1.0 | tolleranza fissa (W) a bassa potenza |
| `SOGLIA_PERCENTUALE` | 0.02 (2%) | tolleranza relativa ad alta potenza |
| `TIMEOUT_GRUPPO_MS` | 30000 | chiusura forzata di un gruppo senza nuovi campioni compatibili |
| `MAX_PRESE` | 8 | slot prese gestibili in parallelo da un worker |
| `POWER_MAX_W` / `VOLTAGE_MIN_V` / `VOLTAGE_MAX_V` / `CURRENT_MAX_A` | 3680 / 180 / 260 / 16 | limiti fisici, scarto letture fuori range |
| `MAX_PENDENTI` | 4 | slot coda di ritentativo per publish falliti |
| `TIMEOUT_PENDENTE_MS` | 60000 | dopo quanto si rinuncia a un pendente |
| `LED_ON_MS` / `LED_PERIOD_MS` (solo LB) | 5000 / 300000 | LED acceso 5s ogni 5 minuti |
| `LED_DURATA_MS` (solo worker) | 2000 | LED acceso 2s ad ogni publish su `optimized` |

La soglia di raggruppamento effettiva è calcolata come `max(SOGLIA_ASSOLUTA_W, riferimento * SOGLIA_PERCENTUALE)`, con passaggio dalla componente assoluta a quella percentuale attorno ai 50W.

### Flusso dati e topic MQTT

| Topic | Publisher | Subscriber | Payload (esempio) | Descrizione |
|---|---|---|---|---|
| `home/<deviceId>/raw` | Gateway | Load balancer (`home/+/raw`) | `{"deviceId":"presa1","timestamp":1784454193.22,"power":12.4,"voltage":230.1,"current":0.054}` | Lettura grezza in arrivo dal gateway |
| `home/lb/worker1/raw` | Load balancer | Worker 1 | stesso payload di `raw` | Instradamento per parità dell'hash calcolato sul topic di arrivo |
| `home/lb/worker2/raw` | Load balancer | Worker 2 | stesso payload di `raw` | Come sopra, per l'altra metà dei dispositivi |
| `home/<presa_id>/optimized` | Worker 1 / Worker 2 | Backend | `{"presa_id","power_w","voltage_v","current_a","sample_count","timestamp_start","timestamp_end"}` | Dato ottimizzato pubblicato dal worker |
| `home/system/healthcheck` | Backend (admin) | Load balancer, Worker 1, Worker 2 | `{}` | Richiesta di stato; rispondono tutti e tre |
| `home/system/healthcheck/response` | Load balancer, Worker 1, Worker 2 | Backend | `{"componente":"esp32_load_balancer","stato":"ok"}` | `componente` ∈ `{esp32_load_balancer, esp32_worker1, esp32_worker2}` |
| `home/system/flush` | Backend (admin) | Worker 1, Worker 2 | `{}` | Svuota la coda di ritentativo pendente; solo i worker rispondono, non il load balancer |

Autenticazione MQTT obbligatoria: tutti e 3 i client si connettono con `MQTT_USER`/`MQTT_PASS`. Client ID: `esp32-load-balancer`, `esp32-worker1`, `esp32-worker2`.

### Come testarlo in isolamento

Non serve il gateway reale né le prese Tapo: si simula il gateway a mano.

```bash
mosquitto_sub -h 192.168.1.178 -t "home/#" -v -u <utente> -P <password>
mosquitto_pub -h 192.168.1.178 -t "home/presa1/raw" \
  -u <utente> -P <password> \
  -m '{"deviceId":"presa1","timestamp":1784471181.5,"power":11.3,"voltage":225.1,"current":0.084}'
```

Sequenza consigliata: flash del load balancer → verifica del routing su `home/lb/worker1/raw` e `home/lb/worker2/raw` → flash di worker1 → verifica di `home/presa1/optimized` → flash di worker2 → ripetizione.

### Note e limiti noti

- **Load balancer statico**: 2 worker fissi, nessuna registrazione dinamica di nuovi elaboratori (hardware fisso a 2 elaboratori).
- **Coda di ritentativo solo in RAM**: non sopravvive a un power loss dell'ESP32, limite dichiarato esplicitamente e lasciato in questo stato per rapporto costo/beneficio.
- **QoS 0 reale, non QoS 1/2 da protocollo**: per una garanzia di consegna conforme allo standard MQTT servirebbe cambiare libreria (es. `espMqttClient`, che supporta QoS 1/2 reali).
- Timestamp gestito come `double`, non `float`, per non perdere precisione a livello di secondi su epoch UTC.
- Filtro debounce a un campione: un campione fuori soglia non chiude subito il gruppo, resta "sospetto" finché il campione successivo lo conferma o lo smentisce. Rileva solo anomalie isolate a un singolo campione.

---

## English

### Description

The **load balancer** receives the raw data published by the gateway (subscribing to `home/+/raw`) and routes it to one of the 2 **workers**, computing a hash on the incoming MQTT topic and routing based on its parity (even/odd): the same plug is therefore always routed to the same worker, not a per-message round-robin. Each **worker** groups similar readings within a tolerance, discards isolated noise/errors, and publishes the optimized reading later consumed by the backend. The three ESP32 boards communicate only via WiFi + MQTT, with no physical link between them except during flashing/debugging over USB.

### System requirements

- Arduino IDE 2.x
- "esp32 by Espressif Systems" board package, from Boards Manager: `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
- Selected board: "ESP32 Dev Module"
- Libraries (Library Manager):
  - `PubSubClient` (Nick O'Leary): only supports QoS 0 on publish, no real protocol-level retransmission/ack
  - `ArduinoJson` ≥ 7.0 (Benoit Blanchon): uses the `JsonDocument` API, not the old v6 `StaticJsonDocument<N>`
- The correct USB-serial driver for your board (CP2102/CP2104: Silicon Labs; CH340/CH9102: WCH)
- **Recommended** dedicated power supply for each ESP32: a shared passive USB hub can cause brownout/reset (`POWERON_RESET`, `RTCWDT_RTC_RESET`) from WiFi current spikes (~400-500mA)

### Setup

1. Install Arduino IDE + the ESP32 board package
2. Install `PubSubClient` and `ArduinoJson` from the Library Manager
3. Install the correct USB-serial driver
4. For each folder (`load_balancer/`, `worker1/`, `worker2/`): copy `secrets.h.example` to `secrets.h` and fill it in:
   ```c
   #define WIFI_SSID     "..."
   #define WIFI_PASSWORD "..."
   #define MQTT_BROKER   "192.168.1.178"   // Raspberry Pi 5's IP
   #define MQTT_USER     "..."             // same user as gateway/config/.env
   #define MQTT_PASS     "..."             // same password as gateway/config/.env
   ```

Only `secrets.h` is an identical duplicate across the 3 folders. `config.h`, instead, **differs** between the load balancer and the workers (worker1 and worker2 share the same `config.h`): the difference concerns LED handling, which differs between the two roles (see the table in Configuration).

### How to build/upload it

No command-line build: use Arduino IDE's **Upload** button (Board: "ESP32 Dev Module", Port: the assigned COM port). If the upload hangs on "Connecting....." on a board without auto-reset, hold **BOOT/IO0** during the connection phase. Serial Monitor at **115200 baud** for logs.

### Internal structure

```
esp32/
├── load_balancer/
│   ├── load_balancer.ino
│   ├── config.h
│   │   # non-sensitive, versioned; LED handling specific to the load balancer
│   ├── secrets.h
│   │   # WiFi + MQTT credentials, NOT versioned
│   ├── secrets.h.example
│   │   # versioned template
├── worker1/
│   ├── worker1.ino
│   │   # WORKER_ID 1 hardcoded
│   ├── config.h
│   ├── secrets.h
│   ├── secrets.h.example
└── worker2/
    ├── worker2.ino
    │   # WORKER_ID 2 hardcoded
    ├── config.h
    ├── secrets.h
    ├── secrets.h.example
```

### Configuration (`config.h`)

| Constant | Value | Meaning |
|---|---|---|
| `MQTT_PORT` | 1883 | |
| `SOGLIA_ASSOLUTA_W` | 1.0 | fixed tolerance (W) at low power |
| `SOGLIA_PERCENTUALE` | 0.02 (2%) | relative tolerance at high power |
| `TIMEOUT_GRUPPO_MS` | 30000 | forced closure of a group with no new compatible samples |
| `MAX_PRESE` | 8 | plug slots a worker can handle in parallel |
| `POWER_MAX_W` / `VOLTAGE_MIN_V` / `VOLTAGE_MAX_V` / `CURRENT_MAX_A` | 3680 / 180 / 260 / 16 | physical limits, readings outside range are discarded |
| `MAX_PENDENTI` | 4 | retry queue slots for failed publishes |
| `TIMEOUT_PENDENTE_MS` | 60000 | time before giving up on a pending message |
| `LED_ON_MS` / `LED_PERIOD_MS` (LB only) | 5000 / 300000 | LED on for 5s every 5 minutes |
| `LED_DURATA_MS` (worker only) | 2000 | LED on for 2s on every publish to `optimized` |

The effective grouping threshold is computed as `max(SOGLIA_ASSOLUTA_W, reference * SOGLIA_PERCENTUALE)`, with the crossover from the absolute to the percentage component happening around 50W.

### Data flow and MQTT topics

| Topic | Publisher | Subscriber | Payload (example) | Description |
|---|---|---|---|---|
| `home/<deviceId>/raw` | Gateway | Load balancer (`home/+/raw`) | `{"deviceId":"presa1","timestamp":1784454193.22,"power":12.4,"voltage":230.1,"current":0.054}` | Raw reading arriving from the gateway |
| `home/lb/worker1/raw` | Load balancer | Worker 1 | same payload as `raw` | Routed by parity of a hash computed on the incoming topic |
| `home/lb/worker2/raw` | Load balancer | Worker 2 | same payload as `raw` | Same as above, for the other half of the devices |
| `home/<presa_id>/optimized` | Worker 1 / Worker 2 | Backend | `{"presa_id","power_w","voltage_v","current_a","sample_count","timestamp_start","timestamp_end"}` | Optimized reading published by the worker |
| `home/system/healthcheck` | Backend (admin) | Load balancer, Worker 1, Worker 2 | `{}` | Status request; all three respond |
| `home/system/healthcheck/response` | Load balancer, Worker 1, Worker 2 | Backend | `{"componente":"esp32_load_balancer","stato":"ok"}` | `componente` ∈ `{esp32_load_balancer, esp32_worker1, esp32_worker2}` |
| `home/system/flush` | Backend (admin) | Worker 1, Worker 2 | `{}` | Empties the pending retry queue; only the workers respond, not the load balancer |

MQTT authentication is mandatory: all 3 clients connect with `MQTT_USER`/`MQTT_PASS`. Client IDs: `esp32-load-balancer`, `esp32-worker1`, `esp32-worker2`.

### How to test it in isolation

Neither the real gateway nor the Tapo plugs are needed: the gateway can be simulated by hand.

```bash
mosquitto_sub -h 192.168.1.178 -t "home/#" -v -u <user> -P <password>
mosquitto_pub -h 192.168.1.178 -t "home/presa1/raw" \
  -u <user> -P <password> \
  -m '{"deviceId":"presa1","timestamp":1784471181.5,"power":11.3,"voltage":225.1,"current":0.084}'
```

Suggested sequence: flash the load balancer → verify routing on `home/lb/worker1/raw` and `home/lb/worker2/raw` → flash worker1 → verify `home/presa1/optimized` → flash worker2 → repeat.

### Notes and known limitations

- **Static load balancer**: 2 fixed workers, no dynamic registration of additional processors (fixed hardware with 2 processors).
- **RAM-only retry queue**: does not survive an ESP32 power loss, an explicitly stated limitation left in this state given the cost/benefit ratio.
- **Real QoS 0, not protocol-level QoS 1/2**: a standard-compliant MQTT delivery guarantee would require switching library (e.g. `espMqttClient`, which supports real QoS 1/2).
- Timestamps are handled as `double`, not `float`, to avoid losing second-level precision on UTC epoch values.
- Single-sample debounce filter: a sample outside the threshold does not immediately close the group, it stays "suspect" until the next sample confirms it or refutes it. Only detects single-sample anomalies.