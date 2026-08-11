"""Client REST verso il backend: unico punto di accesso ai dati. Nessun accesso diretto a MongoDB.

Nessuna autenticazione: /api/prese e /api/consumi non sono protetti da JWT."""

import requests

from config import BACKEND_URL


class RestClientError(Exception):
    """Sollevata per qualunque errore di comunicazione con il backend (rete, status >= 400)."""


def get_prese():
    """Lista delle prese attualmente registrate (scoperta dinamica: mai un elenco hardcoded,
    vedi decisione in chat "Prophet pt2" - il sistema prevede aggiunta/rimozione prese da UI)."""
    risposta = requests.get(f"{BACKEND_URL}/api/prese", timeout=10)
    _solleva_se_errore(risposta)
    return risposta.json()


def get_consumi(presa_id, da, a):
    """Dati grezzi 'optimized' per una presa nell'intervallo [da, a] (datetime tz-aware).
    Nessun limite di paginazione lato backend (vedi consumoRepository.trovaPerPresaERange)."""
    parametri = {"da": da.isoformat(), "a": a.isoformat()}
    risposta = requests.get(f"{BACKEND_URL}/api/consumi/{presa_id}", params=parametri, timeout=30)
    _solleva_se_errore(risposta)
    return risposta.json()


def _solleva_se_errore(risposta):
    if not risposta.ok:
        raise RestClientError(
            f"{risposta.request.method} {risposta.url} -> {risposta.status_code}: {risposta.text}"
        )
