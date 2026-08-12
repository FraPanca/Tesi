from datetime import timedelta
from unittest.mock import patch

import pytest

import main


def _get_consumi_con_copertura_limitata(giorni_copertura):
    """Fabbrica un get_consumi() fittizio che ritorna una sola lettura, posizionata 'giorni_copertura'
    giorni dopo l'inizio della finestra richiesta: con merge_asof(direction='forward') tutti i punti
    della griglia PRIMA di quella lettura vengono riempiti con lo stesso valore, quelli dopo restano
    NaN -> copertura utile finale ≈ giorni_copertura, indipendentemente da quando gira il test."""

    def _get_consumi(presa_id, inizio, fine):
        momento = inizio + timedelta(days=giorni_copertura)
        return [{"timestamp": momento.isoformat(), "potenza": 42.0}]

    return _get_consumi


class TestElaboraPresaStoricoInsufficiente:
    @patch("data.interruzioni.carica_interruzioni", return_value=[])
    @patch("data.rest_client.get_consumi")
    def test_solleva_valueerror_se_la_copertura_utile_dopo_le_esclusioni_e_sotto_la_soglia(
        self, mock_get_consumi, mock_carica_interruzioni
    ):
        mock_get_consumi.side_effect = _get_consumi_con_copertura_limitata(giorni_copertura=5)  # < 14 richiesti

        with pytest.raises(ValueError, match="storico utile insufficiente"):
            main.elabora_presa({"presaId": "presa1"}, "presa1")

    @patch("data.rest_client.get_consumi", return_value=[])
    def test_solleva_valueerror_se_non_ci_sono_dati_grezzi_per_il_periodo(self, mock_get_consumi):
        with pytest.raises(ValueError, match="nessun dato disponibile"):
            main.elabora_presa({"presaId": "presa1"}, "presa1")


class TestMainIsolamentoFallimenti:
    @patch("main.log_client.segnala_errore")
    @patch("main.elabora_presa")
    @patch("main.rest_client.get_prese")
    def test_un_fallimento_su_una_presa_non_blocca_lelaborazione_delle_altre(
        self, mock_get_prese, mock_elabora_presa, mock_segnala_errore
    ):
        mock_get_prese.return_value = [{"presaId": "presa1"}, {"presaId": "presa2"}]
        mock_elabora_presa.side_effect = [ValueError("storico utile insufficiente (< 14 giorni)"), None]

        main.main()

        assert mock_elabora_presa.call_count == 2  # ENTRAMBE le prese sono state tentate

    @patch("main.log_client.segnala_errore")
    @patch("main.elabora_presa")
    @patch("main.rest_client.get_prese")
    def test_un_fallimento_viene_segnalato_al_backend_con_presaid_corretto_nei_metadati(
        self, mock_get_prese, mock_elabora_presa, mock_segnala_errore
    ):
        mock_get_prese.return_value = [{"presaId": "presa1"}, {"presaId": "presa2"}]
        mock_elabora_presa.side_effect = [ValueError("storico insufficiente"), None]

        main.main()

        mock_segnala_errore.assert_called_once()
        _, kwargs = mock_segnala_errore.call_args
        assert kwargs["evento"] == "prophet.forecast_fallito"
        assert kwargs["metadati"] == {"presaId": "presa1"}

    @patch("main.rest_client.get_prese", return_value=[])
    def test_nessuna_presa_registrata_non_solleva_eccezioni(self, mock_get_prese):
        main.main()  # non deve sollevare nulla