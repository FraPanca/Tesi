# Python 3.11: versione stabile compatibile con prophet 1.3.0 e le sue dipendenze (cmdstanpy, numpy, pandas).
# Immagine "slim", non "alpine": cmdstanpy si aspetta glibc, non musl.
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Installa cmdstan in fase di BUILD dell'immagine, non al primo avvio del container: altrimenti il primo
# "docker compose run" giornaliero pagherebbe il costo della compilazione invece del semplice avvio dello script.
RUN python -c "\
import pandas as pd; \
from prophet import Prophet; \
df = pd.DataFrame({'ds': pd.date_range('2026-01-01', periods=48, freq='h'), 'y': [1.0]*48}); \
Prophet().fit(df); \
print('warm-up Prophet/Stan completato')"
 
COPY src ./src
COPY config ./config

# Nessun EXPOSE: questo container non e' un server sempre acceso, e' un job batch lanciato una volta al giorno da systemd.
CMD ["python", "src/main.py"]
