# systemd/

Unit systemd per l'avvio automatico del sistema al boot del Raspberry Pi. Parte del progetto [IoT Home Energy Monitor](../README.md).

## Italiano

### Descrizione

Contiene due unit systemd separate, con cicli di vita diversi:

- **`iot-energy-docker.service`** — avvia/arresta l'intero stack Docker (broker MQTT, backend, frontend, MongoDB, Redis)
- **`iot-energy-gateway.service`** — avvia/arresta il gateway Python, che gira fuori Docker direttamente sull'host

Sono due unit distinte, non una sola, perché hanno cicli di vita diversi (containerizzato vs processo diretto sull'host) e una dipendenza d'ordine: il gateway deve aspettare che mosquitto sia sano prima di partire.

### Dipendenze

- Le unit richiamano lo script [`manage.sh`](../README.md) nella root del repository
- `iot-energy-docker.service` usa `RequiresMountsFor=/mnt/wd1tb`: impedisce l'avvio di mongodb/redis — e la scrittura di dati sulla scheda SD in una directory vuota — se l'hard disk esterno non risulta ancora montato al boot (vedi [README di root](../README.md) per il setup del disco)
- `iot-energy-gateway.service` è `Type=simple`, con `Environment=PYTHONUNBUFFERED=1` per avere i log in tempo reale nel journal (senza, Python bufferizza stdout quando non è collegato a un terminale)

### Struttura interna

```
systemd/
├── iot-energy-docker.service
│   # unit per lo stack Docker
└── iot-energy-gateway.service
    # unit per il gateway Python
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

### Note

- Se il contenuto delle unit cambia, ripetere la copia in `/etc/systemd/system/` e `sudo systemctl daemon-reload`.
- Non copre la logica applicativa dei singoli servizi (backend, frontend, gateway, ESP32) — solo come vengono avviati/arrestati a livello di sistema operativo.

---

## English

### Description

Contains two separate systemd units, with different lifecycles:

- **`iot-energy-docker.service`** — starts/stops the entire Docker stack (MQTT broker, backend, frontend, MongoDB, Redis)
- **`iot-energy-gateway.service`** — starts/stops the Python gateway, which runs outside Docker directly on the host

These are two distinct units, not one, because they have different lifecycles (containerized vs. a direct host process) and an ordering dependency: the gateway must wait for mosquitto to be healthy before starting.

### Dependencies

- The units call the [`manage.sh`](../README.md) script in the repository root
- `iot-energy-docker.service` uses `RequiresMountsFor=/mnt/wd1tb`: this prevents mongodb/redis from starting — and writing data to an empty directory on the SD card — if the external hard disk is not yet mounted at boot (see the [root README](../README.md) for the disk setup)
- `iot-energy-gateway.service` is `Type=simple`, with `Environment=PYTHONUNBUFFERED=1` to get real-time logs in the journal (without it, Python buffers stdout when not attached to a terminal)

### Internal structure

```
systemd/
├── iot-energy-docker.service
│   # unit for the Docker stack
└── iot-energy-gateway.service
    # unit for the Python gateway
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

### Notes

- If the unit files change, repeat the copy to `/etc/systemd/system/` and `sudo systemctl daemon-reload`.
- Does not cover the application logic of the individual services (backend, frontend, gateway, ESP32) — only how they are started/stopped at the operating-system level.
