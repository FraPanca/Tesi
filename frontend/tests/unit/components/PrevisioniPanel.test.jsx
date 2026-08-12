import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../src/hooks/usePrevisione', () => ({ default: vi.fn() }));
vi.mock('../../../src/components/ForecastChart', () => ({
  default: (props) => <div data-testid="forecast-chart" data-count={props.valoriPrevisti.length} />,
}));
vi.mock('../../../src/components/AnomalieList', () => ({
  default: (props) => <div data-testid="anomalie-list" data-count={props.anomalie.length} />,
}));

import usePrevisione from '../../../src/hooks/usePrevisione';
import PrevisioniPanel from '../../../src/components/PrevisioniPanel';


function punto(ds, yhat) {
  return { ds, yhat };
}

function testoPicco(container) {
  return container.querySelector('.previsioni-panel__picco')?.textContent;
}

describe('PrevisioniPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('stato "loading" mostra il messaggio di caricamento', () => {
    usePrevisione.mockReturnValue({ previsione: null, stato: 'loading', error: null });
    render(<PrevisioniPanel presaId="presa1" />);

    expect(screen.getByText('Caricamento…')).toBeInTheDocument();
  });

  test('stato "errore" mostra il messaggio d\'errore', () => {
    usePrevisione.mockReturnValue({ previsione: null, stato: 'errore', error: 'Errore interno' });
    render(<PrevisioniPanel presaId="presa1" />);

    expect(screen.getByText(/Errore interno/)).toBeInTheDocument();
  });

  test('stato "assente" mostra il messaggio di nessuna previsione disponibile', () => {
    usePrevisione.mockReturnValue({ previsione: null, stato: 'assente', error: null });
    render(<PrevisioniPanel presaId="presa1" />);

    expect(screen.getByText('Nessuna previsione disponibile per questa presa.')).toBeInTheDocument();
  });

  test('passa a ForecastChart solo le prime 24 ore, anche con più punti disponibili', () => {
    const valoriPrevisti = Array.from({ length: 168 }, (_, i) =>
      punto(new Date(Date.UTC(2026, 7, 11, i)).toISOString(), 10)
    );
    usePrevisione.mockReturnValue({
      previsione: { valoriPrevisti, suggerimenti: [], anomalie: [] },
      stato: 'disponibile',
      error: null,
    });

    render(<PrevisioniPanel presaId="presa1" />);

    expect(screen.getByTestId('forecast-chart').dataset.count).toBe('24');
  });

  test('REGRESSIONE bug fuso orario: due punti sullo stesso giorno Europe/Rome ma giorni UTC diversi vengono aggregati INSIEME', () => {
    // 23:30 UTC del 10 agosto è già 01:30 CEST dell'11 agosto: un raggruppamento per data UTC li separerebbe
    // in due giorni diversi (10 e 11 agosto), producendo due medie da 1 punto (100 e 200) invece di una sola
    // media da 2 punti (150). Se il bug fosse reintrodotto, il picco mostrato sarebbe 200, non 150.
    const valoriPrevisti = [
      punto('2026-08-10T23:30:00.000Z', 100), // Europe/Rome: 11 agosto, 01:30
      punto('2026-08-11T10:00:00.000Z', 200), // Europe/Rome: 11 agosto, 12:00
    ];
    usePrevisione.mockReturnValue({
      previsione: { valoriPrevisti, suggerimenti: [], anomalie: [] },
      stato: 'disponibile',
      error: null,
    });

    const { container } = render(<PrevisioniPanel presaId="presa1" />);

    expect(testoPicco(container)).toMatch(/~150 W medi orari/);
  });

  test('usa la MEDIA oraria, non la somma: un giorno da 3 punti ad alto valore batte un giorno da 24 punti a valore medio-basso', () => {
    // Giorno A (11 agosto, Europe/Rome): 3 punti a 500W -> media 500. Somma 1500.
    const giornoA = [
      punto('2026-08-11T08:00:00.000Z', 500),
      punto('2026-08-11T09:00:00.000Z', 500),
      punto('2026-08-11T10:00:00.000Z', 500),
    ];
    // Giorno B (12 agosto, Europe/Rome): 24 punti orari a 100W -> media 100. Somma 2400 (> 1500: con la
    // somma "vincerebbe" scorrettamente il giorno B nonostante la media molto più bassa).
    const giornoB = Array.from({ length: 24 }, (_, i) =>
      punto(new Date(Date.parse('2026-08-11T22:00:00.000Z') + i * 60 * 60 * 1000).toISOString(), 100)
    );
    usePrevisione.mockReturnValue({
      previsione: { valoriPrevisti: [...giornoA, ...giornoB], suggerimenti: [], anomalie: [] },
      stato: 'disponibile',
      error: null,
    });

    const { container } = render(<PrevisioniPanel presaId="presa1" />);

    expect(testoPicco(container)).toMatch(/11 agosto/);
    expect(testoPicco(container)).toMatch(/~500 W medi orari/);
  });

  test('mostra i suggerimenti quando presenti e non vuoti', () => {
    usePrevisione.mockReturnValue({
      previsione: {
        valoriPrevisti: [punto('2026-08-11T00:00:00.000Z', 1)],
        suggerimenti: ['Il consumo medio previsto supera la soglia in 1 giorno.'],
        anomalie: [],
      },
      stato: 'disponibile',
      error: null,
    });

    render(<PrevisioniPanel presaId="presa1" />);

    expect(screen.getByText('Il consumo medio previsto supera la soglia in 1 giorno.')).toBeInTheDocument();
  });

  test('NON mostra la sezione suggerimenti se l\'array è vuoto o assente', () => {
    usePrevisione.mockReturnValue({
      previsione: { valoriPrevisti: [punto('2026-08-11T00:00:00.000Z', 1)], suggerimenti: [], anomalie: [] },
      stato: 'disponibile',
      error: null,
    });

    render(<PrevisioniPanel presaId="presa1" />);

    expect(screen.queryByText('Suggerimenti')).not.toBeInTheDocument();
  });

  test('mostra AnomalieList solo quando anomalie ha almeno un elemento', () => {
    usePrevisione.mockReturnValue({
      previsione: {
        valoriPrevisti: [punto('2026-08-11T00:00:00.000Z', 1)],
        suggerimenti: [],
        anomalie: [{ ds: '2026-08-06T00:00:00Z', y: 900, punteggio: -0.72 }],
      },
      stato: 'disponibile',
      error: null,
    });

    render(<PrevisioniPanel presaId="presa1" />);

    expect(screen.getByTestId('anomalie-list').dataset.count).toBe('1');
  });

  test('NON mostra la sezione anomalie se l\'array è vuoto', () => {
    usePrevisione.mockReturnValue({
      previsione: { valoriPrevisti: [punto('2026-08-11T00:00:00.000Z', 1)], suggerimenti: [], anomalie: [] },
      stato: 'disponibile',
      error: null,
    });

    render(<PrevisioniPanel presaId="presa1" />);

    expect(screen.queryByTestId('anomalie-list')).not.toBeInTheDocument();
  });
});