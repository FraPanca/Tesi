import math

from evaluation import metrics


class TestMae:
    def test_valore_noto(self):
        assert metrics.mae([10, 20, 30], [12, 18, 33]) == pytest_approx(2.333333)

    def test_zero_su_previsione_perfetta(self):
        assert metrics.mae([1, 2, 3], [1, 2, 3]) == 0.0


class TestRmse:
    def test_valore_noto(self):
        # errori: -1, 1 -> RMSE = sqrt((1+1)/2) = 1
        assert metrics.rmse([10, 20], [11, 19]) == 1.0

    def test_zero_su_previsione_perfetta(self):
        assert metrics.rmse([1, 2, 3], [1, 2, 3]) == 0.0

    def test_penalizza_di_piu_gli_errori_grandi_rispetto_a_mae(self):
        y_vero = [0, 0, 0, 0]
        y_previsto = [1, 1, 1, 10]  # un solo errore grande
        assert metrics.rmse(y_vero, y_previsto) > metrics.mae(y_vero, y_previsto)


class TestSmape:
    def test_coppia_zero_zero_non_produce_nan_ne_inf(self):
        risultato = metrics.smape([0, 10], [0, 12])

        assert not math.isnan(risultato)
        assert not math.isinf(risultato)

    def test_tutte_le_coppie_zero_zero_ritorna_zero_non_nan(self):
        risultato = metrics.smape([0, 0, 0], [0, 0, 0])

        assert risultato == 0.0

    def test_valore_noto(self):
        # sMAPE(10, 20) = 2*|10|/(10+20) * 100 = 66.666...
        risultato = metrics.smape([10], [20])
        assert risultato == pytest_approx(66.6666666)

    def test_previsione_perfetta_ritorna_zero(self):
        assert metrics.smape([5, 10, 15], [5, 10, 15]) == 0.0


class TestCoverage:
    def test_frazione_corretta_di_punti_dentro_lintervallo(self):
        y_vero = [1, 5, 9]
        y_lower = [0, 0, 0]
        y_upper = [2, 2, 10]  # solo il primo e il terzo sono "dentro" (5 non lo è)

        assert metrics.coverage(y_vero, y_lower, y_upper) == pytest_approx(2 / 3)

    def test_bordo_esatto_y_uguale_a_y_lower_conta_come_dentro(self):
        assert metrics.coverage([5], [5], [10]) == 1.0

    def test_bordo_esatto_y_uguale_a_y_upper_conta_come_dentro(self):
        assert metrics.coverage([10], [5], [10]) == 1.0

    def test_tutti_dentro_ritorna_1(self):
        assert metrics.coverage([5, 5, 5], [0, 0, 0], [10, 10, 10]) == 1.0

    def test_tutti_fuori_ritorna_0(self):
        assert metrics.coverage([100, 100], [0, 0], [10, 10]) == 0.0


def pytest_approx(valore, rel=1e-6):
    """Piccolo helper locale per evitare di importare pytest solo per approx() in ogni test."""
    import pytest

    return pytest.approx(valore, rel=rel)