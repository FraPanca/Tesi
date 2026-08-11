"""Metriche di valutazione per il confronto Prophet vs baseline. MAE e RMSE sono le metriche principali (facili da spiegare
e interpretare); coverage è specifica di Prophet: intervalli di confidenza nativi, la baseline non ne produce; MAPE/sMAPE
solo come nota secondaria, con il seguente limite: 'esplodono' con valori vicini allo zero, rilevante per dati di potenza."""

import numpy as np


def mae(y_vero, y_previsto):
    return float(np.mean(np.abs(np.asarray(y_vero) - np.asarray(y_previsto))))


def rmse(y_vero, y_previsto):
    return float(np.sqrt(np.mean((np.asarray(y_vero) - np.asarray(y_previsto)) ** 2)))


def coverage(y_vero, y_lower, y_upper):
    y_vero = np.asarray(y_vero)
    dentro = (y_vero >= np.asarray(y_lower)) & (y_vero <= np.asarray(y_upper))
    return float(np.mean(dentro))


def smape(y_vero, y_previsto):
    y_vero = np.asarray(y_vero, dtype=float)
    y_previsto = np.asarray(y_previsto, dtype=float)
    denominatore = np.abs(y_vero) + np.abs(y_previsto)
    with np.errstate(divide="ignore", invalid="ignore"):
        termini = np.where(denominatore == 0, 0.0, 2 * np.abs(y_previsto - y_vero) / denominatore)
    return float(np.mean(termini)) * 100
