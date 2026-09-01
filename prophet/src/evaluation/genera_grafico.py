"""Script da lanciare A MANO per generare una figura di confronto forecast vs dato reale per un singolo cutoff
(materiale per il Cap. 5.3 della tesi). NON schedulato, NON richiamato da main.py, come run_evaluation.py.

Uso:
    docker compose --profile jobs run --rm prophet \\
        python -m evaluation.genera_grafico <presaId> <cutoff> <percorso_output.png>

Esempio:
    docker compose --profile jobs run --rm prophet \\
        python -m evaluation.genera_grafico presa2 2026-08-04T00:00:00+02:00 \\
        /app/output/presa2_cutoff-04-08.png

IMPORTANTE: <percorso_output.png> deve stare sotto /app/output/, che nel docker-compose.yml è montato come volume
verso l'host (prophet/output/ nel repository), altrimenti il file viene scritto dentro il container e sparisce
quando "--rm" lo distrugge al termine."""

import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd

from config import ORIZZONTE_ORE, STORICO_RICHIESTO_GIORNI, TIMEZONE
from data import interruzioni, reconstruction, rest_client
from evaluation import plotting

_TZ = ZoneInfo(TIMEZONE)


def main():
    if len(sys.argv) != 4:
        print("uso: python -m evaluation.genera_grafico <presaId> <cutoff> <percorso_output.png>")
        sys.exit(1)

    presa_id = sys.argv[1]
    cutoff = datetime.fromisoformat(sys.argv[2]).astimezone(_TZ)
    percorso_output = sys.argv[3]

    fine = cutoff + timedelta(hours=ORIZZONTE_ORE)
    inizio = cutoff - timedelta(days=STORICO_RICHIESTO_GIORNI)

    grezzi = rest_client.get_consumi(presa_id, inizio, fine)
    df = pd.DataFrame(grezzi)[["timestamp", "potenza"]]
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True).dt.tz_convert(_TZ)
    df = reconstruction.deduplica(df)
    serie = reconstruction.costruisci_griglia_oraria(df, inizio, fine)

    interr = interruzioni.carica_interruzioni(presa_id)
    serie_training = interruzioni.applica_assenze(serie, interr)
    holidays_df = interruzioni.costruisci_holidays_df(interr)

    plotting.salva_grafico_confronto(
        serie_training, cutoff, holidays_df, ORIZZONTE_ORE, presa_id, percorso_output
    )
    print(f"grafico salvato in {percorso_output}")


if __name__ == "__main__":
    main()