"""Script da lanciare manualmente per generare i risultati CV multi-fold. NON schedulato e NON richiamato da main.py

Uso:
    docker compose --profile jobs run --rm prophet \\
        python -m evaluation.run_evaluation <presaId> <cutoff1> [cutoff2 ...]

I cutoff vanno scelti manualmente, in formato ISO 8601 con offset esplicito, es. 2026-08-03T00:00:00+02:00.

Il risultato e' un CSV su stdout."""

import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd

from config import ORIZZONTE_ORE, STORICO_RICHIESTO_GIORNI, TIMEZONE
from data import interruzioni, reconstruction, rest_client
from evaluation import cross_validation

_TZ = ZoneInfo(TIMEZONE)


def main():
    if len(sys.argv) < 3:
        print("uso: python -m evaluation.run_evaluation <presaId> <cutoff1> [cutoff2 ...]")
        sys.exit(1)

    presa_id = sys.argv[1]
    cutoff_candidati = [datetime.fromisoformat(c).astimezone(_TZ) for c in sys.argv[2:]]

    fine = max(cutoff_candidati) + timedelta(hours=ORIZZONTE_ORE)
    inizio = min(cutoff_candidati) - timedelta(days=STORICO_RICHIESTO_GIORNI)

    grezzi = rest_client.get_consumi(presa_id, inizio, fine)
    df = pd.DataFrame(grezzi)[["timestamp", "potenza"]]
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True).dt.tz_convert(_TZ)
    df = reconstruction.deduplica(df)
    serie = reconstruction.costruisci_griglia_oraria(df, inizio, fine)

    interr = interruzioni.carica_interruzioni(presa_id)
    serie_training = interruzioni.applica_assenze(serie, interr)
    holidays_df = interruzioni.costruisci_holidays_df(interr)

    risultati = cross_validation.esegui(
        serie_training, cutoff_candidati, interr, holidays_df, ORIZZONTE_ORE
    )
    print(risultati.to_csv(index=False))


if __name__ == "__main__":
    main()
