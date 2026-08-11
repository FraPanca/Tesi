"""Pubblica la previsione generata verso l'endpoint REST del backend."""

import requests

from config import BACKEND_URL


class PublisherError(Exception):
    pass


def pubblica_previsione(presa_id, previsione_df, suggerimenti=None, anomalie_df=None):
    valori_previsti = [
        {
            "ds": riga.ds.isoformat(),
            "yhat": riga.yhat,
            "yhatLower": riga.yhat_lower,
            "yhatUpper": riga.yhat_upper,
        }
        for riga in previsione_df.itertuples()
    ]

    corpo = {
        "orizzonte": {
            "da": previsione_df["ds"].iloc[0].isoformat(),
            "a": previsione_df["ds"].iloc[-1].isoformat(),
        },
        "valoriPrevisti": valori_previsti,
    }

    if suggerimenti:
        corpo["suggerimenti"] = suggerimenti  # proposto: array di stringhe

    if anomalie_df is not None and not anomalie_df.empty:
        corpo["anomalie"] = [  # proposto: array di {ds, y, punteggio}
            {"ds": riga.ds.isoformat(), "y": riga.y, "punteggio": riga.punteggio}
            for riga in anomalie_df.itertuples()
        ]

    risposta = requests.post(f"{BACKEND_URL}/api/previsioni/{presa_id}", json=corpo, timeout=15)
    if not risposta.ok:
        raise PublisherError(
            f"POST /api/previsioni/{presa_id} -> {risposta.status_code}: {risposta.text}"
        )
