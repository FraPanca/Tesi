from unittest.mock import MagicMock, patch

import pytest

from data.rest_client import RestClientError, get_consumi, get_prese


def _risposta(status_code=200, json_body=None, text="", url="http://backend:3000/api/prese", method="GET"):
    risposta = MagicMock()
    risposta.status_code = status_code
    risposta.ok = 200 <= status_code < 300
    risposta.json.return_value = json_body
    risposta.text = text
    risposta.url = url
    risposta.request.method = method
    return risposta


class TestGetPrese:
    @patch("data.rest_client.requests.get")
    def test_chiama_lendpoint_giusto_e_ritorna_il_json(self, mock_get):
        mock_get.return_value = _risposta(json_body=[{"presaId": "presa1"}])

        risultato = get_prese()

        mock_get.assert_called_once_with("http://backend:3000/api/prese", timeout=10)
        assert risultato == [{"presaId": "presa1"}]

    @patch("data.rest_client.requests.get")
    def test_solleva_restclienterror_su_risposta_non_ok(self, mock_get):
        mock_get.return_value = _risposta(status_code=500, text="errore interno")

        with pytest.raises(RestClientError) as errore:
            get_prese()

        assert "500" in str(errore.value)
        assert "errore interno" in str(errore.value)


class TestGetConsumi:
    @patch("data.rest_client.requests.get")
    def test_passa_presa_id_nel_path_e_da_a_come_parametri_isoformat(self, mock_get, ):
        import pandas as pd

        mock_get.return_value = _risposta(json_body=[])
        da = pd.Timestamp("2026-08-01T00:00:00", tz="Europe/Rome")
        a = pd.Timestamp("2026-08-08T00:00:00", tz="Europe/Rome")

        get_consumi("presa1", da, a)

        mock_get.assert_called_once_with(
            "http://backend:3000/api/consumi/presa1",
            params={"da": da.isoformat(), "a": a.isoformat()},
            timeout=30,
        )

    @patch("data.rest_client.requests.get")
    def test_solleva_restclienterror_su_risposta_non_ok(self, mock_get):
        import pandas as pd

        mock_get.return_value = _risposta(status_code=404, text="non trovato", method="GET")

        with pytest.raises(RestClientError):
            get_consumi("presa1", pd.Timestamp("2026-08-01", tz="Europe/Rome"), pd.Timestamp("2026-08-02", tz="Europe/Rome"))