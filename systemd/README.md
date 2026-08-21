# systemd/

Unit systemd per l'avvio automatico del sistema al boot del Raspberry Pi. Parte del progetto [IoT Home Energy Monitor](../README.md).

## Italiano

### Descrizione

Contiene le unit systemd per l'avvio automatico del sistema e per due job pianificati:

- **`iot-energy-docker.service`**: avvia/arresta l'intero stack Docker (broker MQTT, backend, frontend, MongoDB, Redis)
- **`iot-energy-gateway.service`**: avvia/arresta il gateway Python, che gira fuori Docker direttamente sull'host
- **`iot-prophet-forecast.service`** (oneshot) + **`iot-prophet-forecast.timer`**: a differenza delle prime due, non gestiscono l'avvio dello stack ma eseguono un **job giornaliero** di previsione dei consumi (`docker compose --profile jobs run --rm prophet`), poi terminano. Per il funzionamento del job, vedi [`prophet/README.md`](../prophet/README.md)
- **`iot-mongo-backup.service`** (oneshot) + **`iot-mongo-backup.timer`**: stesso pattern di Prophet, eseguono un **job giornaliero** di backup di MongoDB (`backup-mongo.sh` in root), poi terminano. Per il funzionamento dello script, vedi la sezione "Backup" nel [README di root](../README.md)

Le prime due sono unit distinte, non una sola, perché hanno cicli di vita diversi (containerizzato o processo diretto sull'host) e una dipendenza d'ordine: il gateway deve aspettare che mosquitto sia sano prima di partire. Le coppie service/timer di Prophet e del backup sono invece un pattern standard systemd per job schedulati, ripetuto identico in entrambi i casi: il `.timer` decide *quando* eseguire, il `.service` (`Type=oneshot`) decide *cosa* eseguire.

### Contenuto delle unit Prophet

```ini
# iot-prophet-forecast.service
[Unit]
Description=IoT Energy Monitor - Prophet forecast giornaliero
After=iot-energy-docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/home/francesco/iot
ExecStart=/usr/bin/docker compose --profile jobs run --rm prophet
TimeoutStartSec=600
```

```ini
# iot-prophet-forecast.timer
[Unit]
Description=Esegue il forecast Prophet una volta al giorno

[Timer]
OnCalendar=*-*-* 00:05:00
Persistent=true

[Install]
WantedBy=timers.target
```

### Dipendenze

- Le unit richiamano lo script [`manage.sh`](../README.md) nella root del repository
- `iot-energy-docker.service` usa `RequiresMountsFor=/mnt/wd1tb`: impedisce l'avvio di mongodb/redis, e la scrittura di dati sulla scheda SD in una directory vuota, se l'hard disk esterno non risulta ancora montato al boot (vedi [README di root](../README.md) per il setup del disco)
- `iot-energy-gateway.service` è `Type=simple`, con `Environment=PYTHONUNBUFFERED=1` per avere i log in tempo reale nel journal (senza, Python bufferizza stdout quando non è collegato a un terminale)
- `iot-prophet-forecast.service` usa `After=` ma **non** `Requires=` sullo stack Docker: se lo stack è stato fermato a mano (`manage.sh stop`), il trigger del timer non deve riavviarlo di nascosto. Con solo `After=`, se lo stack è giù il job fallisce (backend irraggiungibile) e lo segnala (`POST /api/logs`); il timer riprova al giro successivo. Con `Requires=` lo stack ripartirebbe silenziosamente, comportamento non voluto.
- `iot-prophet-forecast.timer` ha `Persistent=true`: se il Raspberry è spento o in riavvio esattamente all'orario schedulato (00:05), il job parte comunque al boot successivo invece di saltare il giorno. Economico da avere, evita un giorno di forecast mancante su un dispositivo domestico dove i riavvii non sono rari.
- `Type=oneshot`, non `Type=simple`, sul service: esegue e termina, non resta in esecuzione. Coerente con `docker compose ... run --rm`, che crea il container, lo esegue, lo distrugge.
- `TimeoutStartSec=600`: margine ampio rispetto al tempo reale di esecuzione (pochi secondi una volta che l'immagine è già costruita), pensato per assorbire eventuali rallentamenti, non perché il job richieda davvero 10 minuti.
- `iot-mongo-backup.service` usa lo stesso pattern `After=` senza `Requires=` verso lo stack Docker, per lo stesso motivo del job Prophet: se lo stack è stato fermato deliberatamente, il backup deve fallire in modo visibile, non farlo ripartire di nascosto.
- `iot-mongo-backup.timer` è schedulato alle 03:00, orario scelto per non competere per I/O con `iot-prophet-forecast.timer`, che gira alle 00:05.

### Struttura interna

```
systemd/
├── iot-energy-docker.service
│   # unit per lo stack Docker
├── iot-energy-gateway.service
│   # unit per il gateway Python
├── iot-prophet-forecast.service
│   # oneshot: esegue il job di previsione (docker compose --profile jobs run --rm prophet)
├── iot-prophet-forecast.timer
│   # pianifica l'esecuzione giornaliera del service sopra, alle 00:05
├── iot-mongo-backup.service
│   # oneshot: esegue backup-mongo.sh (dump MongoDB)
└── iot-mongo-backup.timer
    # pianifica l'esecuzione giornaliera del service sopra, alle 03:00
```

### Come installarle/eseguirle

Le unit sono versionate qui nel repo solo per tracciarle: **vanno anche copiate a mano** in `/etc/systemd/system/`, il percorso da cui systemd le legge effettivamente.

```bash
sudo cp iot-energy-docker.service iot-energy-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable iot-energy-docker.service iot-energy-gateway.service
sudo systemctl start iot-energy-docker.service iot-energy-gateway.service
```

(`enable` registra l'avvio automatico al boot; `start` avvia i servizi subito, senza attendere un riavvio. In alternativa, `systemctl enable --now` fa entrambe le cose in un solo comando.)

Gestione quotidiana tramite lo script wrapper in root:
```bash
./manage.sh start     # avvia lo stack Docker, poi il gateway
./manage.sh stop      # arresta il gateway, poi lo stack Docker (arresto "soft", grace period per SIGTERM)
./manage.sh status
```

Output dei servizi sotto systemd:
```bash
sudo journalctl -u iot-energy-docker.service -f
sudo journalctl -u iot-energy-gateway.service -f
```

**Unit Prophet** (job schedulato, installazione separata dalle prime due):

```bash
sudo cp iot-prophet-forecast.service iot-prophet-forecast.timer /etc/systemd/system/
sudo systemd-analyze verify iot-prophet-forecast.service iot-prophet-forecast.timer   # da lanciare prima del daemon-reload
sudo systemctl daemon-reload
sudo systemctl enable --now iot-prophet-forecast.timer
```

Da notare: **si abilita solo il `.timer`, mai il `.service` direttamente**. Il `.service` è `Type=oneshot`, pensato per essere invocato dal timer quando scatta l'orario schedulato, non per girare al boot: abilitarlo direttamente non avrebbe l'effetto desiderato.

Trigger manuale del job schedulato, senza aspettare le 00:05 (utile per verificare che l'unit funzioni tramite systemd stesso, non bypassandolo):
```bash
sudo systemctl start iot-prophet-forecast.service
journalctl -u iot-prophet-forecast.service -f
```

Conferma della schedulazione:
```bash
systemctl list-timers | grep prophet
```

Per un test rapido del solo container, senza passare da systemd, vedi [`prophet/README.md`](../prophet/README.md).

**Unit di backup MongoDB** (job schedulato, stesso pattern di Prophet, installazione separata):

```bash
sudo cp iot-mongo-backup.service iot-mongo-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now iot-mongo-backup.timer
```

Verifica/test manuale, senza aspettare le 03:00:
```bash
sudo systemctl start iot-mongo-backup.service
sudo journalctl -u iot-mongo-backup.service -n 20
ls -lh /mnt/wd1tb/iot-energy/backups/mongodb/
```

Cosa fa lo script (`backup-mongo.sh`), formato del dump, rotazione, e procedura di restore: vedi la sezione "Backup" nel [README di root](../README.md).

### Note

- Se il contenuto delle unit cambia, ripetere la copia in `/etc/systemd/system/` e `sudo systemctl daemon-reload`.
- Non copre la logica applicativa dei singoli servizi (backend, frontend, gateway, ESP32, prophet, backup), solo come vengono avviati/arrestati o schedulati a livello di sistema operativo. Per il funzionamento del job Prophet, vedi [`prophet/README.md`](../prophet/README.md); per il backup, vedi la sezione "Backup" nel [README di root](../README.md).

---

## English

### Description

Contains the systemd units for automatic system startup and for two scheduled jobs:

- **`iot-energy-docker.service`**: starts/stops the entire Docker stack (MQTT broker, backend, frontend, MongoDB, Redis)
- **`iot-energy-gateway.service`**: starts/stops the Python gateway, which runs outside Docker directly on the host
- **`iot-prophet-forecast.service`** (oneshot) + **`iot-prophet-forecast.timer`**: unlike the first two, these don't manage the stack's startup but run a **daily job** that forecasts consumption (`docker compose --profile jobs run --rm prophet`), then exit. For how the job works, see [`prophet/README.md`](../prophet/README.md)
- **`iot-mongo-backup.service`** (oneshot) + **`iot-mongo-backup.timer`**: same pattern as Prophet, running a **daily job** that backs up MongoDB (`backup-mongo.sh` in the root), then exiting. For how the script works, see the "Backup" section in the [root README](../README.md)

The first two are distinct units, not one, because they have different lifecycles (containerized or a direct host process) and an ordering dependency: the gateway must wait for mosquitto to be healthy before starting. The Prophet and backup service/timer pairs are instead a standard systemd pattern for scheduled jobs, repeated identically in both cases: the `.timer` decides *when* to run, the `.service` (`Type=oneshot`) decides *what* to run.

### Content of the Prophet units

```ini
# iot-prophet-forecast.service
[Unit]
Description=IoT Energy Monitor - Prophet forecast giornaliero
After=iot-energy-docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/home/francesco/iot
ExecStart=/usr/bin/docker compose --profile jobs run --rm prophet
TimeoutStartSec=600
```

```ini
# iot-prophet-forecast.timer
[Unit]
Description=Esegue il forecast Prophet una volta al giorno

[Timer]
OnCalendar=*-*-* 00:05:00
Persistent=true

[Install]
WantedBy=timers.target
```

### Dependencies

- The units call the [`manage.sh`](../README.md) script in the repository root
- `iot-energy-docker.service` uses `RequiresMountsFor=/mnt/wd1tb`: this prevents mongodb/redis from starting, and writing data to an empty directory on the SD card, if the external hard disk is not yet mounted at boot (see the [root README](../README.md) for the disk setup)
- `iot-energy-gateway.service` is `Type=simple`, with `Environment=PYTHONUNBUFFERED=1` to get real-time logs in the journal (without it, Python buffers stdout when not attached to a terminal)
- `iot-prophet-forecast.service` uses `After=` but **not** `Requires=` on the Docker stack: if the stack was stopped by hand (`manage.sh stop`), the timer's trigger must not silently bring it back up. With only `After=`, if the stack is down the job fails (backend unreachable) and reports it (`POST /api/logs`); the timer retries on the next run. With `Requires=` the stack would restart silently, which isn't the intended behavior.
- `iot-prophet-forecast.timer` has `Persistent=true`: if the Raspberry Pi is off or rebooting exactly at the scheduled time (00:05), the job still runs at the next boot instead of skipping the day. Cheap to have, avoids a missing day of forecasts on a home device where reboots aren't rare.
- `Type=oneshot`, not `Type=simple`, on the service: it runs and exits, it doesn't stay running. Consistent with `docker compose ... run --rm`, which creates the container, runs it, and destroys it.
- `TimeoutStartSec=600`: a generous margin compared to the actual execution time (a few seconds once the image is already built), meant to absorb occasional slowdowns, not because the job actually needs 10 minutes.
- `iot-mongo-backup.service` uses the same `After=` without `Requires=` pattern toward the Docker stack, for the same reason as the Prophet job: if the stack was stopped deliberately, the backup must fail visibly, not silently bring it back up.
- `iot-mongo-backup.timer` is scheduled at 03:00, a time chosen to avoid competing for I/O with `iot-prophet-forecast.timer`, which runs at 00:05.

### Internal structure

```
systemd/
├── iot-energy-docker.service
│   # unit for the Docker stack
├── iot-energy-gateway.service
│   # unit for the Python gateway
├── iot-prophet-forecast.service
│   # oneshot: runs the forecast job (docker compose --profile jobs run --rm prophet)
├── iot-prophet-forecast.timer
│   # schedules the daily run of the service above, at 00:05
├── iot-mongo-backup.service
│   # oneshot: runs backup-mongo.sh (MongoDB dump)
└── iot-mongo-backup.timer
    # schedules the daily run of the service above, at 03:00
```

### How to install/run them

The units are versioned here in the repo only for tracking: they **must also be copied by hand** to `/etc/systemd/system/`, the path systemd actually reads them from.

```bash
sudo cp iot-energy-docker.service iot-energy-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable iot-energy-docker.service iot-energy-gateway.service
sudo systemctl start iot-energy-docker.service iot-energy-gateway.service
```

(`enable` registers automatic startup at boot; `start` starts the services right away, without waiting for a reboot. Alternatively, `systemctl enable --now` does both in a single command.)

Day-to-day management through the wrapper script in the root:
```bash
./manage.sh start     # starts the Docker stack, then the gateway
./manage.sh stop      # stops the gateway, then the Docker stack (soft shutdown, SIGTERM grace period)
./manage.sh status
```

Service output under systemd:
```bash
sudo journalctl -u iot-energy-docker.service -f
sudo journalctl -u iot-energy-gateway.service -f
```

**Prophet unit** (scheduled job, installed separately from the first two):

```bash
sudo cp iot-prophet-forecast.service iot-prophet-forecast.timer /etc/systemd/system/
sudo systemd-analyze verify iot-prophet-forecast.service iot-prophet-forecast.timer   # run before daemon-reload
sudo systemctl daemon-reload
sudo systemctl enable --now iot-prophet-forecast.timer
```

Note: **only the `.timer` gets enabled, never the `.service` directly**. The `.service` is `Type=oneshot`, meant to be triggered by the timer when the scheduled time is reached, not to run at boot: enabling it directly would not have the intended effect.

Manually triggering the scheduled job, without waiting for 00:05 (useful to verify the unit works through systemd itself, not bypassing it):
```bash
sudo systemctl start iot-prophet-forecast.service
journalctl -u iot-prophet-forecast.service -f
```

Confirming the schedule:
```bash
systemctl list-timers | grep prophet
```

For a quick test of just the container, without going through systemd, see [`prophet/README.md`](../prophet/README.md).

**MongoDB backup unit** (scheduled job, same pattern as Prophet, installed separately):

```bash
sudo cp iot-mongo-backup.service iot-mongo-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now iot-mongo-backup.timer
```

Manual verification/test, without waiting for 03:00:
```bash
sudo systemctl start iot-mongo-backup.service
sudo journalctl -u iot-mongo-backup.service -n 20
ls -lh /mnt/wd1tb/iot-energy/backups/mongodb/
```

What the script does (`backup-mongo.sh`), the dump format, rotation, and the restore procedure: see the "Backup" section in the [root README](../README.md).

### Notes

- If the unit files change, repeat the copy to `/etc/systemd/system/` and `sudo systemctl daemon-reload`.
- Does not cover the application logic of the individual services (backend, frontend, gateway, ESP32, prophet, backup), only how they are started/stopped or scheduled at the operating-system level. For how the Prophet job works, see [`prophet/README.md`](../prophet/README.md); for the backup, see the "Backup" section in the [root README](../README.md).