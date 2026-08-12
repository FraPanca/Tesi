"""Utility condivise dalla suite di test, importabili come modulo di primo livello grazie a
`pythonpath = src tests` in pytest.ini."""


class ProphetFittizio:
    """Sostituto di prophet.Prophet. Registra gli argomenti di fit() invece di addestrare un modello
    vero, e replica il comportamento del Prophet reale che ci interessa per i test: solleva
    ValueError se 'ds' è timezone-aware (fit) o se 'holidays' contiene un 'ds' timezone-aware."""

    ultima_istanza = None

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.serie_fit = None
        ProphetFittizio.ultima_istanza = self

    def _valida_naive(self, df, nome):
        if df is None:
            return
        tz = getattr(df["ds"].dtype, "tz", None)
        if tz is not None:
            raise ValueError(f"Prophet non accetta '{nome}.ds' timezone-aware (simulato)")

    def fit(self, serie):
        self._valida_naive(serie, "serie")
        self._valida_naive(self.kwargs.get("holidays"), "holidays")
        self.serie_fit = serie
        return self

    def predict(self, futuro):
        raise NotImplementedError(
            "ProphetFittizio.predict non configurato: nei test su forecast.predict si passa "
            "direttamente un modello fittizio con un .predict() dedicato, non si arriva qui."
        )