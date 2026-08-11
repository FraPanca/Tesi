"""Baseline di confronto: media mobile semplice. Nessuna stagionalita', nessun intervallo di confidenza. Valutata sugli
stessi cutoff e le stesse metriche di Prophet (vedi evaluation/cross_validation.py), per un confronto 'onesto'."""

FINESTRA_ORE_DEFAULT = 7 * 24  # una settimana di storico.


def previsione_media_mobile(storico, lunghezza_orizzonte, finestra_ore=FINESTRA_ORE_DEFAULT):
    # Storico: Series di y ordinata temporalmente, NaN gia' esclusi.
    # Ritorna un valore costante (media della finestra) ripetuto per tutto l'orizzonte."""
    finestra = storico[-finestra_ore:] if len(storico) > finestra_ore else storico
    media = float(finestra.mean())
    return [media] * lunghezza_orizzonte
