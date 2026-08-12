from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from forecast.rest_publisher import PublisherError, pubblica_previsione


def _previsione(n_ore=2):
    indice = pd.date_range("2026-08-11T00:00:00", periods=n_ore, freq="h", tz="Europe/Rome")
    return pd.DataFrame(
        {
            "ds": indice,
            "yhat": [45.2, 42.8][:n_ore],
            "yhat_lower": [30.1, 28.4][:n_ore],
            "yhat_upper": [60.3, 57.1][:n_ore],
        }
    )


class TestPubblicaPrevisione:
    @patch("forecast.rest_publisher.requests.post")
    def test_costruisce_orizzonte_da_prima_e_ultima_riga_e_valoriprevisti_con_i_nomi_di_campo_attesi(self, mock_post):
        mock_post.return_value = MagicMock(ok=True)
        previsione = _previsione(2)

        pubblica_previsione("presa1", previsione)

        corpo = mock_post.call_args.kwargs["json"]
        assert corpo["orizzonte"]["da"] == previsione["ds"].iloc[0].isoformat()
        assert corpo["orizzonte"]["a"] == previsione["ds"].iloc[-1].isoformat()
        assert corpo["valoriPrevisti"] == [
            {"ds": previsione["ds"].iloc[0].isoformat(), "yhat": 45.2, "yhatLower": 30.1, "yhatUpper": 60.3},
            {"ds": previsione["ds"].iloc[1].isoformat(), "yhat": 42.8, "yhatLower": 28.4, "yhatUpper": 57.1},
        ]

    @patch("forecast.rest_publisher.requests.post")
    def test_chiama_lendpoint_con_il_presaid_nel_path(self, mock_post):
        mock_post.return_value = MagicMock(ok=True)

        pubblica_previsione("presa1", _previsione())

        args, kwargs = mock_post.call_args
        assert args[0] == "http://backend:3000/api/previsioni/presa1"
        assert kwargs["timeout"] == 15

    @patch("forecast.rest_publisher.requests.post")
    def test_suggerimenti_incluso_solo_se_valorizzato(self, mock_post):
        mock_post.return_value = MagicMock(ok=True)

        pubblica_previsione("presa1", _previsione(), suggerimenti=["Testo suggerimento"])
        assert mock_post.call_args.kwargs["json"]["suggerimenti"] == ["Testo suggerimento"]

        mock_post.reset_mock()
        pubblica_previsione("presa1", _previsione(), suggerimenti=[])
        assert "suggerimenti" not in mock_post.call_args.kwargs["json"]

        mock_post.reset_mock()
        pubblica_previsione("presa1", _previsione(), suggerimenti=None)
        assert "suggerimenti" not in mock_post.call_args.kwargs["json"]

    @patch("forecast.rest_publisher.requests.post")
    def test_anomalie_incluso_solo_se_il_dataframe_non_e_vuoto(self, mock_post):
        mock_post.return_value = MagicMock(ok=True)
        anomalie = pd.DataFrame(
            [{"ds": pd.Timestamp("2026-08-06T14:00:00", tz="Europe/Rome"), "y": 900.0, "punteggio": -0.72}]
        )

        pubblica_previsione("presa1", _previsione(), anomalie_df=anomalie)
        corpo = mock_post.call_args.kwargs["json"]
        assert corpo["anomalie"] == [{"ds": anomalie["ds"].iloc[0].isoformat(), "y": 900.0, "punteggio": -0.72}]

        mock_post.reset_mock()
        anomalie_vuote = pd.DataFrame(columns=["ds", "y", "punteggio"])
        pubblica_previsione("presa1", _previsione(), anomalie_df=anomalie_vuote)
        assert "anomalie" not in mock_post.call_args.kwargs["json"]

        mock_post.reset_mock()
        pubblica_previsione("presa1", _previsione(), anomalie_df=None)
        assert "anomalie" not in mock_post.call_args.kwargs["json"]

    @patch("forecast.rest_publisher.requests.post")
    def test_solleva_publishererror_su_risposta_non_ok(self, mock_post):
        risposta = MagicMock(ok=False, status_code=400, text='{"errore": "valoriPrevisti[0].ds ambiguo"}')
        mock_post.return_value = risposta

        with pytest.raises(PublisherError) as errore:
            pubblica_previsione("presa1", _previsione())

        assert "400" in str(errore.value)
        assert "ambiguo" in str(errore.value)