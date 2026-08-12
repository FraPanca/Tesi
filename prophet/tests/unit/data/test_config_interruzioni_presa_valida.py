"""Non testa una funzione applicativa esistente: previene un errore di CONFIGURAZIONE silenzioso, osservato realmente in produzione."""

import yaml

from config import INTERRUZIONI_FILE

# Prese realmente registrate nel sistema al momento in cui questo test è stato scritto (presa1 = Camera
# da Letto, presa2 = Cucina, verificato in produzione sul Raspberry Pi). Elenco di controllo mantenuto a
# mano: se il sistema reale cambia (nuova presa aggiunta/rimossa dall'UI), va aggiornato insieme a questo
# test — non è recuperato da una chiamata dal vivo a GET /api/prese, che richiederebbe il backend attivo.
PRESE_REGISTRATE_FIXTURE = {"presa1", "presa2"}


def test_ogni_presa_dichiarata_in_interruzioni_yaml_e_registrata_nel_sistema():
    with open(INTERRUZIONI_FILE, encoding="utf-8") as f:
        contenuto = yaml.safe_load(f) or {}

    dichiarate = {voce["presa"] for voce in contenuto.get("interruzioni", []) if voce["presa"] != "tutte"}

    non_registrate = dichiarate - PRESE_REGISTRATE_FIXTURE
    assert not non_registrate, (
        f"interruzioni.yaml dichiara 'presa' non tra quelle registrate nel sistema: {non_registrate}. "
        "Probabile errore di battitura nel presaId (es. un nome descrittivo invece dell'id reale): "
        "l'interruzione verrebbe ignorata silenziosamente, senza errori né crash."
    )