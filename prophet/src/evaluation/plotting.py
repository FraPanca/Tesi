"""Genera una figura di confronto forecast vs dato reale per un singolo cutoff - materiale per il Cap. 5.3
della tesi (accuratezza delle previsioni, intervalli di confidenza).

Riusa gli stessi moduli di training/predict del resto della pipeline (models.prophet_model, forecast.predict);
qui si aggiunge solo la parte grafica, nessuna logica di fit duplicata."""

from datetime import timedelta

import matplotlib

matplotlib.use("Agg")  # nessun display disponibile nel container: solo salvataggio su file
import matplotlib.pyplot as plt

from forecast import predict as forecast_predict
from models import prophet_model

GIORNI_STORICO_MOSTRATI_DEFAULT = 5


def salva_grafico_confronto(
    serie, cutoff, holidays_df, orizzonte_ore, presa_id, percorso_output,
    giorni_storico_mostrati=GIORNI_STORICO_MOSTRATI_DEFAULT,
):
    train = serie[serie["ds"] < cutoff].dropna(subset=["y"])
    reale_futuro = serie[
        (serie["ds"] >= cutoff) & (serie["ds"] < cutoff + timedelta(hours=orizzonte_ore))
    ].dropna(subset=["y"])
    storico_recente = train[train["ds"] >= cutoff - timedelta(days=giorni_storico_mostrati)]

    modello = prophet_model.addestra(train, holidays_df)
    previsione = forecast_predict.genera_previsione(modello, train["ds"].max())

    fig, ax = plt.subplots(figsize=(10, 5))

    ax.plot(
        storico_recente["ds"], storico_recente["y"],
        color="#333333", linewidth=1, label="Dato reale (storico)",
    )
    if not reale_futuro.empty:
        ax.plot(
            reale_futuro["ds"], reale_futuro["y"],
            color="#1a7a1a", linewidth=1.2, label="Dato reale (verita' di confronto)",
        )

    ax.plot(
        previsione["ds"], previsione["yhat"],
        color="#1f5fa8", linewidth=1.5, label="Previsione Prophet",
    )
    ax.fill_between(
        previsione["ds"], previsione["yhat_lower"], previsione["yhat_upper"],
        color="#1f5fa8", alpha=0.2, label="Intervallo di confidenza 80%",
    )

    ax.axvline(cutoff, color="#999999", linestyle="--", linewidth=1)

    ax.set_xlabel("Data e ora")
    ax.set_ylabel("Potenza (W)")
    ax.set_title(f"{presa_id} - previsione dal cutoff {cutoff.strftime('%d/%m/%Y %H:%M')}")
    ax.legend(loc="upper left", fontsize=8)
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(percorso_output, dpi=150, bbox_inches="tight")
    plt.close(fig)