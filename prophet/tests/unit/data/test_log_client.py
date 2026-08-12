from unittest.mock import MagicMock, patch

import requests

from data.log_client import segnala_errore


class TestSegnalaErrore:
    @patch("data.log_client.requests.post")
    def test_costruisce_il_body_atteso_da_post_api_logs(self, mock_post):
        mock_post.return_value = MagicMock(ok=True)

        segnala_errore(
            evento="prophet.forecast_fallito",
            messaggio="storico insufficiente",
            metadati={"presaId": "presa1"},
        )

        mock_post.assert_called_once_with(
            "http://backend:3000/api/logs",
            json={
                "livello": "error",
                "evento": "prophet.forecast_fallito",
                "messaggio": "storico insufficiente",
                "metadati": {"presaId": "presa1"},
            },
            timeout=10,
        )

    @patch("data.log_client.requests.post")
    def test_metadati_di_default_e_dizionario_vuoto_non_none(self, mock_post):
        mock_post.return_value = MagicMock(ok=True)

        segnala_errore(evento="x", messaggio="y")

        assert mock_post.call_args.kwargs["json"]["metadati"] == {}

    @patch("data.log_client.requests.post")
    def test_non_solleva_eccezioni_se_il_backend_e_irraggiungibile(self, mock_post):
        mock_post.side_effect = requests.ConnectionError("backend giù")

        # Non deve propagare l'eccezione: se anche la segnalazione dell'errore fallisce, non deve
        # far crashare il resto di main.py (che sta già gestendo un altro errore).
        segnala_errore(evento="x", messaggio="y")