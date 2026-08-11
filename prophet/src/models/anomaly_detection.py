"""Rilevamento di consumi anomali con Isolation Forest, un modello per presa.
Le feature sono contestuali (ora del giorno, giorno della settimana, potenza), non solo il valore grezzo:
l'obiettivo e' individuare punti "fuori pattern per quel momento", non semplicemente i valori piu' alti in
assoluto (il microonde a piena potenza alle 13:00 è normale, alle 4 di notte no, pur essendo lo stesso valore
di potenza)."""

from sklearn.ensemble import IsolationForest

SOGLIA_PUNTI_MINIMI = 50  # regola empirica, non una soglia rigorosamente derivata.


def rileva_anomalie(serie, contaminazione=0.02):
    # Ritorna il sottoinsieme di 'serie' marcato come anomalo, con una colonna 'punteggio' (più negativo =
    # più anomalo, convenzione di IsolationForest), ordinato dal più anomalo al meno anomalo.
    if len(serie) < SOGLIA_PUNTI_MINIMI:
        return serie.iloc[0:0].assign(punteggio=[])

    caratteristiche = serie.assign(
        ora=serie["ds"].dt.hour,
        giorno_settimana=serie["ds"].dt.dayofweek,
    )[["ora", "giorno_settimana", "y"]]

    modello = IsolationForest(contamination=contaminazione, random_state=42)
    etichette = modello.fit_predict(caratteristiche)  # -1 = anomalia, 1 = normale
    punteggi = modello.score_samples(caratteristiche)

    risultato = serie.copy()
    risultato["punteggio"] = punteggi
    return risultato[etichette == -1].sort_values("punteggio")  # più anomalo prima (punteggio più negativo)
