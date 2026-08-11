"""Caricamento delle interruzioni dichiarate esplicitamente (config/interruzioni.yaml) e loro applicazione
alla serie ricostruita."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd
import yaml

from config import INTERRUZIONI_FILE, TIMEZONE

_TZ = ZoneInfo(TIMEZONE)


def carica_interruzioni(presa_id):
    # Ritorna la lista delle interruzioni dichiarate che riguardano questa presa (incluse quelle con presa: "tutte").
    
    # Ogni voce: nome, tipo, da (00:00 del primo giorno), a (00:00 del giorno SUCCESSIVO all'ultimo).
    with open(INTERRUZIONI_FILE, encoding="utf-8") as f:
        contenuto = yaml.safe_load(f) or {}
 
    interruzioni = []
    for voce in contenuto.get("interruzioni", []):
        if voce["presa"] not in (presa_id, "tutte"):
            continue
        interruzioni.append(
            {
                "nome": voce["nome"],
                "tipo": voce["tipo"],
                "da": _inizio_giorno(voce["da"]),
                "a": _inizio_giorno(voce["a"], giorno_dopo=True),
            }
        )
    return interruzioni


def applica_assenze(serie, interruzioni):
    # Imposta a NaN i punti della serie ricostruita che cadono in un'interruzione di tipo 'assenza_vera'.
    # Non tocca gli 'evento_speciale': quei dati sono reali e restano nel training.
    serie = serie.copy()
    for interruzione in interruzioni:
        if interruzione["tipo"] != "assenza_vera":
            continue
        maschera = (serie["ds"] >= interruzione["da"]) & (serie["ds"] < interruzione["a"])
        serie.loc[maschera, "y"] = None
    return serie


def escludi_eventi_speciali(serie, interruzioni):
    # Rimuove i punti che cadono in un'interruzione di tipo 'evento_speciale'. A differenza del training,
    #dove l'evento_speciale resta di proposito nei dati, qui serve per finestre che non devono essere sporcate
    # da un evento già noto: senza questo filtro, un periodo come una vacanza può far apparire come "anomali" i
    # giorni successivi al rientro, semplicemente perché la finestra recente è in maggioranza fatta di giorni a
    # consumo quasi nullo.
    maschera_esclusione = pd.Series(False, index=serie.index)
    for interruzione in interruzioni:
        if interruzione["tipo"] != "evento_speciale":
            continue
        maschera_esclusione |= (serie["ds"] >= interruzione["da"]) & (serie["ds"] < interruzione["a"])
    return serie[~maschera_esclusione]


def costruisci_holidays_df(interruzioni):
    """Tabella 'holidays' nel formato richiesto da Prophet (colonne 'holiday', 'ds'), una riga per ogni 
    data di calendario coperta da un 'evento_speciale'. L'effetto holiday di Prophet si applica per data
    di calendario, non per timestamp esatto."""
    righe = []
    for interruzione in interruzioni:
        if interruzione["tipo"] != "evento_speciale":
            continue
        for data in pd.date_range(interruzione["da"], interruzione["a"], freq="D", inclusive="left"):
            righe.append({"holiday": interruzione["nome"], "ds": data.normalize()})
 
    if not righe:
        return None  # Prophet accetta holidays=None se per questa presa non ce ne sono
    return pd.DataFrame(righe)


def _inizio_giorno(data_iso, giorno_dopo=False):
    d = datetime.strptime(data_iso, "%Y-%m-%d").replace(tzinfo=_TZ)
    return d + timedelta(days=1) if giorno_dopo else d
