import os

from dotenv import load_dotenv


# PATHS
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DOTENV_PATH = os.path.join(BASE_DIR, "config", ".env")
load_dotenv(DOTENV_PATH)

INTERRUZIONI_FILE = os.path.join(BASE_DIR, "config", "interruzioni.yaml")


# BACKEND
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:3000")


# TIMEZONE
# Fisso, non configurabile via env.
TIMEZONE = "Europe/Rome"


# ORIZZONTE DI PREVISIONE
# Un'unica predict() a 168h (7 giorni): le prime 24 righe coprono il caso "prossime 24h" nel frontend,
# l'intera settimana il caso "consumerai di piu' nei giorni X".
ORIZZONTE_ORE = 168

# Quanto storico richiedere al backend per il training giornaliero: un multiplo dello storico minimo
# per avere margine, non il minimo esatto.
STORICO_RICHIESTO_GIORNI = 42

# Sotto questa soglia Prophet stesso avvisa: non ha abbastanza dati per imparare la stagionalità settimanale.
STORICO_MINIMO_GIORNI = 14
