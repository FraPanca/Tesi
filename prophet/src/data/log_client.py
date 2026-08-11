"""Segnala un fallimento di produzione al backend (POST /api/logs, con origine forzata a 'sistema' lato server)
così da essere visibile nel pannello admin. Se il fallimento riguarda una singola presa, quel giorno semplicemente
non viene scritta nessuna Previsione: l'assenza (o la staleness) è già il segnale corretto per l'utente del frontend."""

import requests

from config import BACKEND_URL


def segnala_errore(evento, messaggio, metadati=None):
    corpo = {
        "livello": "error",
        "evento": evento,
        "messaggio": messaggio,
        "metadati": metadati or {},
    }
    try:
        requests.post(f"{BACKEND_URL}/api/logs", json=corpo, timeout=10)
    except requests.RequestException:
        # Se anche la segnalazione dell'errore fallisce (es. backend irraggiungibile): journalctl/docker logs cattura comunque questo stdout.
        print(f"[prophet] impossibile segnalare l'errore al backend: {evento} - {messaggio}")
