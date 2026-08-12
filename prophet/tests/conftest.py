"""Fixture condivise da tutta la suite.

`prophet` (il pacchetto, con cmdstanpy) non è installato in questo ambiente di test: è pesante da
compilare e i test unitari non hanno bisogno di un fit reale, solo di verificare COME
`models.prophet_model.addestra()` costruisce gli argomenti passati a `Prophet(...)`. Iniettiamo un
sostituto leggero (testutils.ProphetFittizio) in `sys.modules['prophet']` a livello di modulo (non
dentro una fixture): il modulo sotto test lo importa con `from prophet import Prophet` durante la
COLLEZIONE dei test, prima che qualunque fixture possa essere eseguita.
"""

import sys
from types import ModuleType

import pandas as pd
import pytest

from testutils import ProphetFittizio

_modulo_fittizio = ModuleType("prophet")
_modulo_fittizio.Prophet = ProphetFittizio
sys.modules.setdefault("prophet", _modulo_fittizio)


@pytest.fixture(autouse=True)
def reset_prophet_fittizio():
    ProphetFittizio.ultima_istanza = None
    yield


@pytest.fixture
def serie_oraria_tzaware():
    """Fabbrica: N ore di serie {ds, y} tz-aware (Europe/Rome) a partire da un istante dato."""

    def _crea(inizio_iso, ore, valore=10.0):
        indice = pd.date_range(inizio_iso, periods=ore, freq="h", tz="Europe/Rome")
        return pd.DataFrame({"ds": indice, "y": [valore] * ore})

    return _crea