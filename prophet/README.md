# prophet/

Modulo di previsione dei consumi energetici. Parte del progetto [IoT Home Energy Monitor](../README.md).

## Italiano

### Descrizione

Job batch che genera previsioni dei consumi a 7 giorni per ciascuna presa tramite Prophet, valutato con rigore via cross-validation. Oltre alla previsione, calcola suggerimenti di risparmio basati sulla soglia di potenza impostata dall'utente e rileva consumi anomali. Scrive i risultati nel backend tramite `POST /api/previsioni/:presaId` (vedi "Contratto verso il backend" sotto) e segnala eventuali fallimenti tramite `POST /api/logs`. **Non è un servizio sempre acceso**: è un batch job containerizzato, eseguito una volta al giorno da un timer systemd dedicato, e non parte con lo stack Docker di default. Verificato in funzione in produzione reale sul Raspberry Pi, non solo in sviluppo. Vedi [`systemd/README.md`](../systemd/README.md) per come è schedulato.

### Requisiti

- Python 3.11
- `prophet` e la sua dipendenza `cmdstanpy` richiedono un **toolchain di compilazione C++** (`build-essential`, `g++`) **solo su architetture senza wheel precompilato**: su **ARM64 (Raspberry Pi)** non esiste un wheel precompilato su PyPI per la versione usata, verificato sia da ricerca sia empiricamente (prima build sul Pi reale: **~209 secondi**, compilazione da sorgente del binario Stan). Su **x86_64** il wheel include già un binario Stan precompilato, nessuna compilazione in quel caso. Nel `Dockerfile` questo è gestito automaticamente indipendentemente dall'architettura; da tenere presente solo se si esegue il codice fuori Docker su un Raspberry Pi.
- `matplotlib` (usata solo da `genera_grafico.py`, vedi sotto) ha invece un wheel precompilato anche per Linux ARM64: a differenza di `prophet`/`cmdstanpy`, non comporta rischio di compilazione lenta da sorgente.
- Accesso di rete al backend (`BACKEND_URL`), sia per leggere lo storico dei consumi sia per scrivere previsioni ed eventuali segnalazioni di errore.

Librerie Python di produzione (`requirements.txt`, versioni esatte):

```
prophet==1.3.0
pandas==2.2.3
numpy==1.26.4
requests==2.32.3
python-dotenv==1.2.2
PyYAML==6.0.2
scikit-learn==1.9.0
matplotlib==3.11.1
```

Per l'ambiente di test, vedi la sezione "Testing" più sotto.

### Setup

```bash
cd prophet
cp config/.env.example config/.env
```

Unica variabile richiesta in `config/.env`:

| Variabile | Scopo |
|---|---|
| `BACKEND_URL` | URL base del backend: usato per leggere lo storico dei consumi, scrivere le previsioni prodotte e segnalare eventuali errori |

Altre costanti di comportamento sono fissate in `src/config.py`, non esposte come variabili d'ambiente:

| Costante | Valore | Significato |
|---|---|---|
| `TIMEZONE` | `Europe/Rome` | fuso orario di riferimento, non configurabile via env |
| `ORIZZONTE_ORE` | 168 | orizzonte di previsione (7 giorni): un'unica `predict()` copre sia il caso "prossime 24h" sia l'intera settimana per il frontend |
| `STORICO_RICHIESTO_GIORNI` | 42 | quanto storico viene richiesto al backend per il training giornaliero, un multiplo dello storico minimo per avere margine |
| `STORICO_MINIMO_GIORNI` | 14 | soglia sotto la quale Prophet stesso segnala di non avere abbastanza dati per la stagionalità settimanale |

### Formato di `config/interruzioni.yaml`

Permette di dichiarare esplicitamente periodi in cui i dati richiedono un trattamento diverso dal normale. Due categorie, non intercambiabili:

- `assenza_vera`: nessun dato affidabile disponibile (es. presa scollegata fisicamente). I punti della griglia oraria in quell'intervallo diventano `NaN` e vengono esclusi dal training.
- `evento_speciale`: la presa è rimasta collegata, i dati sono reali ma anomali (es. vacanza: consumo quasi nullo ma genuino). Restano nel training, modellati esplicitamente come "holiday" di Prophet, ed esclusi solo dai cutoff usati per calcolare le metriche di accuratezza standard, altrimenti gonfierebbero l'errore.

Campi: `presa` (il `presaId` di una singola presa, oppure `"tutte"` per un evento che riguarda l'intero sistema, es. un blackout); `da`/`a` (date di calendario `YYYY-MM-DD`, ora locale Europe/Rome, entrambe incluse).

Esempio reale nel repository:
```yaml
interruzioni:
  - nome: "Vacanza agosto 2026"
    presa: "presa1"
    tipo: evento_speciale
    da: "2026-08-01"
    a: "2026-08-08"
```

### Struttura interna

```
prophet/
├── Dockerfile
├── requirements.txt
├── requirements-dev.txt
│   # solo pytest, per la suite di test, vedi Testing
├── pytest.ini
│   # pythonpath = src tests; testpaths = tests; marker "slow" per i test che richiedono Prophet/cmdstanpy reale
├── config/
│   ├── .env
│   │   # non tracciato, credenziali/URL reali
│   ├── .env.example
│   ├── interruzioni.yaml
│   │   # periodi di assenza_vera / evento_speciale, vedi sopra
├── src/
│   ├── __init__.py
│   ├── config.py
│   │   # carica config/.env, definisce BACKEND_URL, TIMEZONE, ORIZZONTE_ORE e le soglie di storico
│   ├── main.py
│   │   # entrypoint di produzione: per ogni presa ricostruisce la serie, addestra Prophet,
│   │   # genera la previsione a 168h e la pubblica sul backend
│   ├── data/
│   │   ├── __init__.py
│   │   ├── interruzioni.py
│   │   │   # carica config/interruzioni.yaml e lo applica alla serie ricostruita
│   │   ├── log_client.py
│   │   │   # segnala un fallimento al backend (POST /api/logs)
│   │   ├── reconstruction.py
│   │   │   # ricostruisce una griglia oraria regolare dagli eventi optimized irregolari
│   │   ├── rest_client.py
│   │   │   # client REST verso il backend, unico punto di accesso ai dati, nessun accesso diretto a MongoDB
│   ├── models/
│   │   ├── __init__.py
│   │   ├── anomaly_detection.py
│   │   │   # Isolation Forest per presa, feature contestuali (ora del giorno, giorno della settimana, potenza)
│   │   ├── prophet_model.py
│   │   │   # training del modello Prophet, un modello per presa
│   ├── forecast/
│   │   ├── __init__.py
│   │   ├── predict.py
│   │   │   # genera la previsione a 168h, costruzione dell'orizzonte futuro già tz-aware
│   │   ├── rest_publisher.py
│   │   │   # pubblica la previsione generata verso l'endpoint REST del backend
│   │   ├── suggerimenti.py
│   │   │   # suggerimenti di risparmio da soglia utente + anomalie recenti
│   └── evaluation/
│       ├── __init__.py
│       ├── baseline.py
│       │   # baseline di confronto: media mobile semplice, nessuna stagionalità
│       ├── cross_validation.py
│       │   # cross-validation rolling-origin con cutoff scelti manualmente
│       ├── metrics.py
│       │   # MAE, RMSE, coverage, MAPE/sMAPE
│       ├── run_evaluation.py
│       │   # eseguito offline/manualmente, non dal job schedulato, vedi sotto
│       ├── plotting.py
│       │   # funzione salva_grafico_confronto(): riusa training/predict esistenti, aggiunge solo la parte grafica
│       └── genera_grafico.py
│           # script manuale per produrre un PNG di confronto, vedi sotto
└── tests/
    ├── conftest.py
    │   # inietta il Prophet fittizio in sys.modules, vedi Testing
    ├── testutils.py
    │   # classe ProphetFittizio condivisa dai test
    └── unit/
        ├── data/
        │   ├── test_reconstruction.py
        │   ├── test_interruzioni.py
        │   ├── test_config_interruzioni_presa_valida.py
        │   ├── test_rest_client.py
        │   └── test_log_client.py
        ├── models/
        │   ├── test_prophet_model.py
        │   └── test_anomaly_detection.py
        ├── forecast/
        │   ├── test_predict.py
        │   ├── test_suggerimenti.py
        │   └── test_rest_publisher.py
        ├── evaluation/
        │   ├── test_metrics.py
        │   └── test_cross_validation.py
        └── main/
            └── test_main.py
```

### Come eseguirlo

**MAI `docker compose up`**: il servizio ha `profiles: ["jobs"]` nel `docker-compose.yml` di root, quindi non parte né con lo stack di default (`docker compose up -d`) né con `docker compose up` semplice: va invocato esplicitamente. Confermato anche empiricamente: `docker compose ps` non lo mostra tra i servizi attivi dopo un normale avvio dello stack.

**Esecuzione schedulata (produzione)**: gestita dal timer systemd `iot-prophet-forecast.timer`, installazione e dettagli in [`systemd/README.md`](../systemd/README.md).

Comandi reali, testati e funzionanti sul Raspberry Pi:
```bash
docker compose build prophet                              # rebuild dopo modifiche al codice
docker compose --profile jobs run --rm prophet             # esecuzione manuale (equivalente al job schedulato)
docker compose --profile jobs run --rm prophet \
    python -m evaluation.run_evaluation <presaId> <cutoff1> [cutoff2...]   # cross-validation, vedi sotto
```

I cutoff per la cross-validation vanno scelti manualmente, in formato ISO 8601 con offset esplicito (es. `2026-08-03T00:00:00+02:00`); il risultato è un CSV su stdout.

**`main.py` vs `evaluation/run_evaluation.py`**: due entrypoint distinti, da non confondere:

| | `src/main.py` | `src/evaluation/run_evaluation.py` |
|---|---|---|
| Quando gira | In produzione, schedulato dal timer | Offline, manuale (`python -m evaluation.run_evaluation`) |
| Scopo | Produce le previsioni correnti, le scrive nel backend | Cross-validation: valuta la qualità del modello (metriche, confronto con baseline) per una presa e uno o più cutoff |
| Effetti collaterali | Scrive dati reali nel backend | Nessuno: non scrive mai su Mongo/backend, solo lettura e calcolo di metriche |

### Generazione di grafici (`genera_grafico.py`)

Terzo script manuale, stesso pattern di `run_evaluation.py` (non schedulato, non richiamato da `main.py`). Produce un PNG con storico, previsione, banda di confidenza e dato reale di verifica sovrapposto, tramite `evaluation/plotting.py` (funzione `salva_grafico_confronto()`, che riusa il training/predict già esistenti e aggiunge solo la parte grafica con matplotlib, backend `Agg`, nessun display necessario nel container).

**Più permissivo di `run_evaluation.py`**: non applica `cutoff_validi()`, quindi nessun controllo di storico minimo né di sovrapposizione con le interruzioni dichiarate. Può quindi produrre un grafico anche con una verità di confronto solo parziale: va presentato come illustrazione qualitativa, non come sostituto della valutazione numerica di `run_evaluation.py`, che resta l'unica fonte affidabile per le metriche di accuratezza (MAE/RMSE/coverage).

Comando:
```bash
docker compose --profile jobs run --rm prophet \
  python -m evaluation.genera_grafico <presaId> <cutoff ISO 8601> /app/output/<nome-file>.png
```

Esempio verificato con Prophet reale (non un mock): `presa2`, cutoff `2026-08-04T00:00:00+02:00`, risultato in un grafico con storico, previsione, banda di confidenza all'80% e dato reale di verifica sovrapposto.

Richiede il volume `./prophet/output:/app/output` (vedi "Integrazione nel `docker-compose.yml` di root" sotto) e che la cartella `prophet/output/` esista già sull'host: senza il mount, il PNG scritto dentro il container sparisce quando `docker compose run --rm` lo distrugge al termine, comportamento normale di `--rm`. Il volume serve solo a questo script (`main.py` e `run_evaluation.py` non scrivono file, solo chiamate REST/stdout), ma è dichiarato una volta sola per l'intero servizio.

### Contratto verso il backend

- **`POST /api/previsioni/:presaId`**: non richiede JWT (come `/api/prese`/`/api/consumi`). Ogni chiamata crea un nuovo documento nello storico delle previsioni (mai un update-in-place). Corpo principale: `orizzonte.da`/`orizzonte.a`, `valoriPrevisti[]` (`ds`, `yhat`, `yhatLower`, `yhatUpper`); `metriche`/`suggerimenti`/`anomalie` opzionali.
- **Vincolo importante**: ogni data nel corpo (`orizzonte.da`/`.a`, ogni `ds`) **deve avere timezone esplicito** (`Z` o offset `±HH:MM`): il backend rifiuta con 400 una data "naive" (es. `"2026-08-11 14:00:00"`, il formato nativo di pandas/Prophet senza timezone). Questo è direttamente collegato ai punti 1-3 in "Note tecniche" sotto: l'orizzonte futuro va costruito già tz-aware, non ri-localizzato a posteriori.
- **`POST /api/logs`** (non protetta): usata per segnalare fallimenti (es. `evento: "prophet.forecast_fallito"`) senza scrivere previsioni fittizie. Il campo `origine` è forzato server-side a `'sistema'`.

### Note tecniche

Comportamenti osservati durante lo sviluppo e la messa in produzione, non teorici: osservati sul Pi.

1. **Prophet rifiuta `ds` timezone-aware** (`ValueError: Column ds has timezone specified`). Il timezone viene tolto solo per il tratto interno a Prophet (fit/predict), mai a monte, dove serve per il contratto col backend (vedi sopra).
2. **Cambio ora legale nell'orizzonte a 7 giorni**: non un caso limite raro, si verifica due volte l'anno con certezza. Ri-localizzare a posteriori l'output naive di Prophet non è affidabile in quel caso (`Cannot infer dst time`); l'orizzonte futuro viene quindi costruito già tz-aware fin dall'inizio.
3. **pandas 2.2.3 con `tz=` esplicito su un `date_range` che ha `start` già tz-aware**: può sollevare `AssertionError: Inferred time zone not equal to passed time zone`, per un disallineamento fra `pytz` (dietro la risoluzione di una stringa come `"Europe/Rome"`) e `zoneinfo.ZoneInfo` (già attaccato a `start`). Per questo `tz=` esplicito non viene mai passato se `start` è già tz-aware.
4. **`yhat_lower` negativo per dispositivi a basso consumo**: Prophet non ha un vincolo fisico di non negatività, quindi `yhat`/`yhat_lower`/`yhat_upper` vengono riportati a un minimo di zero in post-processing.
5. **Finestra anomalie e `evento_speciale`**: i giorni di `evento_speciale` vengono esclusi dalla finestra recente usata per il rilevamento delle anomalie prima dell'analisi. Senza questa esclusione, una vacanza dichiarata al suo interno farebbe risultare "anomali" i giorni normali successivi al rientro (osservato sui dati reali di `presa1`).

### Testing

**Framework:** pytest. Copertura pressoché completa del componente, su tre livelli: comportamenti osservati in produzione sul Pi, validazione di configurazione, logica applicativa. `pytest.ini` imposta anche un marker `slow` per i test che richiedono Prophet/cmdstanpy reale, non eseguiti nella suite rapida (vedi sotto).

**Setup**, venv dedicato dentro `prophet/`, separato da quello di produzione:
```bash
cd prophet
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
pip install pandas==2.2.3 numpy==1.26.4 PyYAML==6.0.2 scikit-learn==1.9.0 requests==2.32.3 python-dotenv==1.2.2
```

**`prophet`/`cmdstanpy` sono deliberatamente esclusi** da questa installazione (pur presenti in `requirements.txt`): pesanti da compilare, non necessari per la suite. Un `Prophet` fittizio (`tests/testutils.py`, iniettato in `sys.modules` da `tests/conftest.py`) lo sostituisce nei test, replicando solo il comportamento rilevante (es. il rifiuto di `ds` timezone-aware, come il Prophet vero).

**Comandi:**
```bash
pytest              # tutta la suite
pytest -v           # con il nome di ogni test
pytest <path>        # un singolo file
```

**Risultato attuale:** 92 test, tutti verdi.

| File | N. test | Cosa verifica |
|---|---|---|
| `test_reconstruction.py` | 8 | Deduplica timestamp; test di non regressione sul comportamento bfill/ffill della griglia (un punto prende sempre il valore della *prossima* lettura, mai della precedente); caso limite senza letture future → `NaN` |
| `test_interruzioni.py` | 15 | Filtro per presa (incluso `"tutte"`); conversione timezone; `assenza_vera` → NaN nei bordi esatti, `evento_speciale` non tocca `y`; `costruisci_holidays_df` su confini non a mezzanotte |
| `test_config_interruzioni_presa_valida.py` | 1 | **Non testa codice applicativo**: verifica che ogni `presa` dichiarata nel vero `interruzioni.yaml` esista in un elenco fisso di prese registrate (`presa1`, `presa2`), a copertura di un possibile errore di configurazione silenzioso. Elenco mantenuto a mano, va aggiornato se cambiano le prese reali |
| `test_rest_client.py` | 4 | URL/parametri di `get_prese`/`get_consumi`, `RestClientError` su risposta non ok |
| `test_log_client.py` | 3 | Forma del body `POST /api/logs`, resilienza se il backend è irraggiungibile |
| `test_prophet_model.py` | 6 | Rimozione del timezone da `ds` prima di `fit()`, e da `holidays` |
| `test_anomaly_detection.py` | 5 | Sotto soglia minima → nessun modello addestrato; su pattern sintetico con anomalie iniettate, rilevamento e ordinamento dal punteggio più negativo |
| `test_predict.py` | 7 | Attraversamento dei due cambi ora legale 2026 (168 righe, monotona, nessuna eccezione) con lo stesso meccanismo di produzione (`ZoneInfo`); clip a zero su `yhat`/`yhat_lower`/`yhat_upper` con valori negativi noti |
| `test_suggerimenti.py` | 10 | Nessun suggerimento se soglia `None` o nessun giorno a rischio; singolare/plurale; giorno di picco; anomalie vuote |
| `test_rest_publisher.py` | 5 | Forma del body `POST /api/previsioni/:presaId` (nomi campo `yhatLower`/`yhatUpper`); `suggerimenti`/`anomalie` inclusi solo se valorizzati; `PublisherError` su risposta non ok |
| `test_metrics.py` | 14 | `smape()` su coppie (0,0) non produce NaN/inf; `coverage()` sui bordi esatti |
| `test_cross_validation.py` | 9 | Solo `cutoff_validi()` (logica pura): storico minimo, sovrapposizione a interruzioni di qualunque tipo (assenza o evento speciale), bordi esatti |
| `test_main.py` | 5 | Storico insufficiente → `ValueError`; un fallimento su una presa non blocca le altre (`elabora_presa` viene comunque chiamato su tutte) |

**Esplicitamente escluso dalla suite rapida:**
- `evaluation.cross_validation.valuta_cutoff()`/`esegui()` e qualunque test con un fit Prophet reale: richiedono `cmdstanpy` compilato, marcati `slow`. Solo la logica pura di `cutoff_validi()` è coperta nella suite rapida.
- `evaluation/run_evaluation.py`: script CLI manuale, non schedulato, thin wrapper attorno a funzioni già coperte altrove, non testato direttamente.

### Integrazione nel `docker-compose.yml` di root

Il servizio `prophet` è già presente nel `docker-compose.yml` di root, sotto `services:`:

```yaml
  prophet:
    build: ./prophet
    container_name: prophet
    profiles: ["jobs"]
    environment:
      BACKEND_URL: http://backend:3000
    depends_on:
      - backend
    volumes:
      - ./prophet/output:/app/output
```

`profiles: ["jobs"]` è la parte che conta: un servizio con un profilo non di default **non parte** con `docker compose up -d` (confermato: `iot-energy-docker.service`, che fa `up -d`, non lo avvia), ma resta lanciabile esplicitamente con `docker compose --profile jobs run --rm prophet`. È il meccanismo che permette al container di esistere solo per la durata dell'esecuzione, invece di restare acceso 24/7 per un job che gira una volta al giorno.

Il volume `./prophet/output:/app/output` serve solo a `genera_grafico.py` (vedi sopra), ma è dichiarato una volta sola per l'intero servizio. La cartella `prophet/output/` deve esistere sull'host prima del primo utilizzo:
```bash
mkdir -p prophet/output
```
Docker non la crea sempre da sola a seconda della configurazione.

---

## English

### Description

Batch job that produces 7-day consumption forecasts for each plug using Prophet, rigorously evaluated via cross-validation. Beyond the forecast itself, it computes saving suggestions based on the user's power threshold and detects anomalous consumption. It writes results to the backend via `POST /api/previsioni/:presaId` (see "Contract with the backend" below) and reports failures via `POST /api/logs`. **This is not an always-on service**: it's a containerized batch job, run once a day by a dedicated systemd timer, and it does not start with the default Docker stack. Verified running in real production on the Raspberry Pi, not just in development. See [`systemd/README.md`](../systemd/README.md) for how it's scheduled.

### Requirements

- Python 3.11
- `prophet` and its dependency `cmdstanpy` require a **C++ build toolchain** (`build-essential`, `g++`) **only on architectures without a precompiled wheel**: on **ARM64 (Raspberry Pi)** there is no precompiled wheel on PyPI for the version used, verified both by research and empirically (first build on the real Pi: **~209 seconds**, compiling the Stan binary from source). On **x86_64** the wheel already includes a precompiled Stan binary, no compilation in that case. This is handled automatically in the `Dockerfile` regardless of architecture; only relevant if running the code outside Docker on a Raspberry Pi.
- `matplotlib` (used only by `genera_grafico.py`, see below) does have a precompiled wheel for Linux ARM64: unlike `prophet`/`cmdstanpy`, it carries no risk of a slow build from source.
- Network access to the backend (`BACKEND_URL`), both to read the consumption history and to write forecasts and any error reports.

Production Python libraries (`requirements.txt`, exact versions):

```
prophet==1.3.0
pandas==2.2.3
numpy==1.26.4
requests==2.32.3
python-dotenv==1.2.2
PyYAML==6.0.2
scikit-learn==1.9.0
matplotlib==3.11.1
```

For the test environment, see the "Testing" section below.

### Setup

```bash
cd prophet
cp config/.env.example config/.env
```

The only required variable in `config/.env`:

| Variable | Purpose |
|---|---|
| `BACKEND_URL` | Base URL of the backend: used to read the consumption history, write the produced forecasts, and report any errors |

Other behavioral constants are fixed in `src/config.py`, not exposed as environment variables:

| Constant | Value | Meaning |
|---|---|---|
| `TIMEZONE` | `Europe/Rome` | reference timezone, not configurable via env |
| `ORIZZONTE_ORE` | 168 | forecast horizon (7 days): a single `predict()` covers both the "next 24h" case and the whole week for the frontend |
| `STORICO_RICHIESTO_GIORNI` | 42 | how much history is requested from the backend for daily training, a multiple of the minimum history for margin |
| `STORICO_MINIMO_GIORNI` | 14 | threshold below which Prophet itself warns it doesn't have enough data for weekly seasonality |

### `config/interruzioni.yaml` format

Lets you explicitly declare periods where the data needs different handling than usual. Two categories, not interchangeable:

- `assenza_vera` (true absence): no reliable data available (e.g. plug physically unplugged). The hourly grid points in that interval become `NaN` and are excluded from training.
- `evento_speciale` (special event): the plug stayed connected, the data is real but anomalous (e.g. a vacation: near-zero but genuine consumption). It stays in training, explicitly modeled as a Prophet "holiday", and is excluded only from the cutoffs used to compute standard accuracy metrics, otherwise it would inflate the error.

Fields: `presa` (the `presaId` of a single plug, or `"tutte"` for an event affecting the whole system, e.g. a blackout); `da`/`a` (calendar dates `YYYY-MM-DD`, local Europe/Rome time, both inclusive).

Real example in the repository:
```yaml
interruzioni:
  - nome: "Vacanza agosto 2026"
    presa: "presa1"
    tipo: evento_speciale
    da: "2026-08-01"
    a: "2026-08-08"
```

### Internal structure

```
prophet/
├── Dockerfile
├── requirements.txt
├── requirements-dev.txt
│   # pytest only, for the test suite, see Testing
├── pytest.ini
│   # pythonpath = src tests; testpaths = tests; "slow" marker for tests that need real Prophet/cmdstanpy
├── config/
│   ├── .env
│   │   # not tracked, real credentials/URL
│   ├── .env.example
│   ├── interruzioni.yaml
│   │   # assenza_vera / evento_speciale periods, see above
├── src/
│   ├── __init__.py
│   ├── config.py
│   │   # loads config/.env, defines BACKEND_URL, TIMEZONE, ORIZZONTE_ORE and the history thresholds
│   ├── main.py
│   │   # production entrypoint: for each plug, reconstructs the series, trains Prophet,
│   │   # generates the 168h forecast and publishes it to the backend
│   ├── data/
│   │   ├── __init__.py
│   │   ├── interruzioni.py
│   │   │   # loads config/interruzioni.yaml and applies it to the reconstructed series
│   │   ├── log_client.py
│   │   │   # reports a failure to the backend (POST /api/logs)
│   │   ├── reconstruction.py
│   │   │   # reconstructs a regular hourly grid from the irregular optimized events
│   │   ├── rest_client.py
│   │   │   # REST client to the backend, the only point of access to the data, no direct MongoDB access
│   ├── models/
│   │   ├── __init__.py
│   │   ├── anomaly_detection.py
│   │   │   # Isolation Forest per plug, contextual features (hour of day, day of week, power)
│   │   ├── prophet_model.py
│   │   │   # Prophet model training, one model per plug
│   ├── forecast/
│   │   ├── __init__.py
│   │   ├── predict.py
│   │   │   # generates the 168h forecast, building the future horizon already tz-aware
│   │   ├── rest_publisher.py
│   │   │   # publishes the generated forecast to the backend's REST endpoint
│   │   ├── suggerimenti.py
│   │   │   # saving suggestions from the user threshold plus recent anomalies
│   └── evaluation/
│       ├── __init__.py
│       ├── baseline.py
│       │   # comparison baseline: simple moving average, no seasonality
│       ├── cross_validation.py
│       │   # rolling-origin cross-validation with manually chosen cutoffs
│       ├── metrics.py
│       │   # MAE, RMSE, coverage, MAPE/sMAPE
│       ├── run_evaluation.py
│       │   # run offline/manually, not by the scheduled job, see below
│       ├── plotting.py
│       │   # salva_grafico_confronto() function: reuses the existing training/predict, adds only the plotting part
│       └── genera_grafico.py
│           # manual script to produce a comparison PNG, see below
└── tests/
    ├── conftest.py
    │   # injects the fake Prophet into sys.modules, see Testing
    ├── testutils.py
    │   # ProphetFittizio class shared across tests
    └── unit/
        ├── data/
        │   ├── test_reconstruction.py
        │   ├── test_interruzioni.py
        │   ├── test_config_interruzioni_presa_valida.py
        │   ├── test_rest_client.py
        │   └── test_log_client.py
        ├── models/
        │   ├── test_prophet_model.py
        │   └── test_anomaly_detection.py
        ├── forecast/
        │   ├── test_predict.py
        │   ├── test_suggerimenti.py
        │   └── test_rest_publisher.py
        ├── evaluation/
        │   ├── test_metrics.py
        │   └── test_cross_validation.py
        └── main/
            └── test_main.py
```

### How to run it

**NEVER `docker compose up`**: the service has `profiles: ["jobs"]` in the root `docker-compose.yml`, so it does not start with either the default stack (`docker compose up -d`) or plain `docker compose up`: it must be invoked explicitly. Also confirmed empirically: `docker compose ps` does not list it among the active services after a normal stack startup.

**Scheduled run (production)**: handled by the `iot-prophet-forecast.timer` systemd timer, installation and details in [`systemd/README.md`](../systemd/README.md).

Real commands, tested and working on the Raspberry Pi:
```bash
docker compose build prophet                              # rebuild after code changes
docker compose --profile jobs run --rm prophet             # manual run (equivalent to the scheduled job)
docker compose --profile jobs run --rm prophet \
    python -m evaluation.run_evaluation <presaId> <cutoff1> [cutoff2...]   # cross-validation, see below
```

Cutoffs for cross-validation must be chosen manually, in ISO 8601 format with an explicit offset (e.g. `2026-08-03T00:00:00+02:00`); the result is a CSV on stdout.

**`main.py` vs. `evaluation/run_evaluation.py`**: two distinct entrypoints, not to be confused:

| | `src/main.py` | `src/evaluation/run_evaluation.py` |
|---|---|---|
| When it runs | In production, scheduled by the timer | Offline, manual (`python -m evaluation.run_evaluation`) |
| Purpose | Produces the current forecasts, writes them to the backend | Cross-validation: evaluates model quality (metrics, comparison with baseline) for a plug and one or more cutoffs |
| Side effects | Writes real data to the backend | None: never writes to Mongo/backend, read-only, just computes metrics |

### Chart generation (`genera_grafico.py`)

A third manual script, same pattern as `run_evaluation.py` (not scheduled, not called by `main.py`). It produces a PNG with history, forecast, confidence band, and an overlaid real verification reading, through `evaluation/plotting.py` (the `salva_grafico_confronto()` function, which reuses the existing training/predict and adds only the plotting part with matplotlib, `Agg` backend, no display needed in the container).

**More permissive than `run_evaluation.py`**: it does not apply `cutoff_validi()`, so there's no minimum-history check or check for overlap with declared interruptions. It can therefore produce a chart even with only a partial comparison truth: it should be presented as a qualitative illustration, not a substitute for the numeric evaluation from `run_evaluation.py`, which remains the only reliable source for accuracy metrics (MAE/RMSE/coverage).

Command:
```bash
docker compose --profile jobs run --rm prophet \
  python -m evaluation.genera_grafico <presaId> <cutoff ISO 8601> /app/output/<file-name>.png
```

Verified example with the real Prophet (not a mock): `presa2`, cutoff `2026-08-04T00:00:00+02:00`, resulting in a chart with history, forecast, an 80% confidence band, and an overlaid real verification reading.

Requires the `./prophet/output:/app/output` volume (see "Integration into the root `docker-compose.yml`" below) and the `prophet/output/` folder to already exist on the host: without the mount, the PNG written inside the container disappears when `docker compose run --rm` destroys it at the end, normal `--rm` behavior. The volume is only needed by this script (`main.py` and `run_evaluation.py` don't write files, only REST calls/stdout), but it's declared once for the whole service.

### Contract with the backend

- **`POST /api/previsioni/:presaId`**: no JWT required (same as `/api/prese`/`/api/consumi`). Every call creates a new document in the forecast history (never an in-place update). Main body: `orizzonte.da`/`orizzonte.a`, `valoriPrevisti[]` (`ds`, `yhat`, `yhatLower`, `yhatUpper`); `metriche`/`suggerimenti`/`anomalie` optional.
- **Important constraint**: every date in the body (`orizzonte.da`/`.a`, every `ds`) **must have an explicit timezone** (`Z` or `±HH:MM` offset): the backend rejects a "naive" date (e.g. `"2026-08-11 14:00:00"`, pandas/Prophet's native tz-less format) with a 400. This is directly tied to points 1-3 in "Technical notes" below: the future horizon must be built tz-aware from the start, not re-localized after the fact.
- **`POST /api/logs`** (unprotected): used to report failures (e.g. `evento: "prophet.forecast_fallito"`) without writing fake forecast data. The `origine` field is forced server-side to `'sistema'`.

### Technical notes

Behaviors observed during development and the production rollout, not theoretical: observed on the Pi.

1. **Prophet rejects timezone-aware `ds`** (`ValueError: Column ds has timezone specified`). The timezone is stripped only for the section that goes into Prophet (fit/predict), never upstream, where it's needed for the backend contract (see above).
2. **DST change within the 7-day horizon**: not a rare edge case, it happens with certainty twice a year. Re-localizing Prophet's naive output after the fact isn't reliable in that case (`Cannot infer dst time`); the future horizon is therefore built already tz-aware from the start.
3. **pandas 2.2.3 with an explicit `tz=` on a `date_range` whose `start` is already tz-aware**: can raise `AssertionError: Inferred time zone not equal to passed time zone`, from a mismatch between `pytz` (behind resolving a string like `"Europe/Rome"`) and `zoneinfo.ZoneInfo` (already attached to `start`). For this reason an explicit `tz=` is never passed when `start` is already tz-aware.
4. **Negative `yhat_lower` for low-consumption devices**: Prophet has no physical non-negativity constraint, so `yhat`/`yhat_lower`/`yhat_upper` are brought back to a floor of zero in post-processing.
5. **Anomaly window and `evento_speciale`**: `evento_speciale` days are excluded from the recent window used for anomaly detection before the analysis runs. Without this exclusion, a declared vacation inside that window would make the normal days right after returning show up as "anomalous" (observed on real `presa1` data).

### Testing

**Framework:** pytest. Near-complete coverage of the component, across three levels: behaviors observed in production on the Pi, configuration validation, application logic. `pytest.ini` also sets a `slow` marker for tests that need real Prophet/cmdstanpy, not run in the fast suite (see below).

**Setup**, a dedicated venv inside `prophet/`, separate from the production one:
```bash
cd prophet
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
pip install pandas==2.2.3 numpy==1.26.4 PyYAML==6.0.2 scikit-learn==1.9.0 requests==2.32.3 python-dotenv==1.2.2
```

**`prophet`/`cmdstanpy` are deliberately left out** of this install (even though they're in `requirements.txt`): heavy to compile, not needed for the suite. A fake `Prophet` (`tests/testutils.py`, injected into `sys.modules` by `tests/conftest.py`) replaces it in tests, replicating only the relevant behavior (e.g. rejecting timezone-aware `ds`, like the real Prophet).

**Commands:**
```bash
pytest              # whole suite
pytest -v           # with each test's name
pytest <path>        # a single file
```

**Current result:** 92 tests, all passing.

| File | # tests | What it checks |
|---|---|---|
| `test_reconstruction.py` | 8 | Timestamp deduplication; non-regression test on the grid's bfill/ffill behavior (a grid point always takes the value of the *next* reading, never the previous one); edge case with no future readings → `NaN` |
| `test_interruzioni.py` | 15 | Filter by plug (including `"tutte"`); timezone conversion; `assenza_vera` → NaN at the exact edges, `evento_speciale` doesn't touch `y`; `costruisci_holidays_df` on non-midnight boundaries |
| `test_config_interruzioni_presa_valida.py` | 1 | **Doesn't test application code**: verifies that every `presa` declared in the real `interruzioni.yaml` exists in a fixed list of registered plugs (`presa1`, `presa2`), covering a possible silent configuration error. The list is maintained by hand and must be updated if the real plugs change |
| `test_rest_client.py` | 4 | URL/params for `get_prese`/`get_consumi`, `RestClientError` on a non-ok response |
| `test_log_client.py` | 3 | Shape of the `POST /api/logs` body, resilience if the backend is unreachable |
| `test_prophet_model.py` | 6 | Timezone stripped from `ds` before `fit()`, and from `holidays` |
| `test_anomaly_detection.py` | 5 | Below the minimum threshold → no model trained; on a synthetic pattern with injected anomalies, detection and ranking from the most negative score |
| `test_predict.py` | 7 | Crossing both 2026 DST changes (168 rows, monotonic, no exception) with the same production mechanism (`ZoneInfo`); zero-clip on `yhat`/`yhat_lower`/`yhat_upper` with known negative values |
| `test_suggerimenti.py` | 10 | No suggestion if the threshold is `None` or no day is at risk; singular/plural; peak day; empty anomalies |
| `test_rest_publisher.py` | 5 | Shape of the `POST /api/previsioni/:presaId` body (field names `yhatLower`/`yhatUpper`); `suggerimenti`/`anomalie` included only when populated; `PublisherError` on a non-ok response |
| `test_metrics.py` | 14 | `smape()` on (0,0) pairs doesn't produce NaN/inf; `coverage()` at the exact edges |
| `test_cross_validation.py` | 9 | Only `cutoff_validi()` (pure logic): minimum history, overlap with interruptions of either type (absence or special event), exact edges |
| `test_main.py` | 5 | Insufficient history → `ValueError`; a failure on one plug doesn't block the others (`elabora_presa` is still called on all of them) |

**Explicitly excluded from the fast suite:**
- `evaluation.cross_validation.valuta_cutoff()`/`esegui()` and any test with a real Prophet fit: require compiled `cmdstanpy`, marked `slow`. Only the pure `cutoff_validi()` logic is covered in the fast suite.
- `evaluation/run_evaluation.py`: manual CLI script, not scheduled, a thin wrapper around functions already covered elsewhere, not tested directly.

### Integration into the root `docker-compose.yml`

The `prophet` service is already present in the root `docker-compose.yml`, under `services:`:

```yaml
  prophet:
    build: ./prophet
    container_name: prophet
    profiles: ["jobs"]
    environment:
      BACKEND_URL: http://backend:3000
    depends_on:
      - backend
    volumes:
      - ./prophet/output:/app/output
```

`profiles: ["jobs"]` is what matters: a service with a non-default profile **does not start** with `docker compose up -d` (confirmed: `iot-energy-docker.service`, which runs `up -d`, does not start it), but stays runnable explicitly with `docker compose --profile jobs run --rm prophet`. This is the mechanism that lets the container exist only for the duration of the run, instead of staying up 24/7 for a job that runs once a day.

The `./prophet/output:/app/output` volume is only needed by `genera_grafico.py` (see above), but it's declared once for the whole service. The `prophet/output/` folder must exist on the host before first use:
```bash
mkdir -p prophet/output
```
Docker does not always create it on its own, depending on the configuration.