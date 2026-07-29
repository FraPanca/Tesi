import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-chartjs-2', () => ({
  Line: (props) => <div data-testid="line-chart" data-props={JSON.stringify(props)} />,
}));
vi.mock('../../../src/hooks/useNow', () => ({ default: vi.fn() }));

import useNow from '../../../src/hooks/useNow';
import ConsumptionChart from '../../../src/components/ConsumptionChart';


const ORA_FISSA = new Date('2026-07-20T12:00:00.000Z');


function leggiProps() {
  return JSON.parse(screen.getByTestId('line-chart').dataset.props);
}


describe('ConsumptionChart', () => {
  beforeEach(() => {
    useNow.mockReturnValue(ORA_FISSA);
  });

  test('ordina i punti per timestamp indipendentemente dall\'ordine delle letture ricevute', () => {
    const letture = [
      { timestamp: '2026-07-20T10:00:00.000Z', potenza: 30 },
      { timestamp: '2026-07-20T08:00:00.000Z', potenza: 10 }, // fuori ordine rispetto all'array
      { timestamp: '2026-07-20T09:00:00.000Z', potenza: 20 },
    ];
    render(<ConsumptionChart letture={letture} loading={false} />);

    const { data } = leggiProps();
    const xOrdinati = data.datasets[0].data.map((p) => new Date(p.x).getTime());

    expect(xOrdinati).toEqual([...xOrdinati].sort((a, b) => a - b));
    expect(data.datasets[0].data[0].y).toBe(10); // la lettura delle 08:00, non quella in prima posizione nell'array
  });

  test('aggiunge un punto sintetico finale (now, ultimo valore) quando "now" è successivo all\'ultima lettura', () => {
    render(
      <ConsumptionChart
        letture={[{ timestamp: '2026-07-20T10:00:00.000Z', potenza: 42 }]}
        loading={false}
      />,
    );

    const { data } = leggiProps();
    const punti = data.datasets[0].data;

    expect(punti).toHaveLength(2);
    expect(new Date(punti[1].x).getTime()).toBe(ORA_FISSA.getTime());
    expect(punti[1].y).toBe(42); // stesso valore dell'ultima lettura reale, non un dato nuovo
  });

  test('NON aggiunge il punto sintetico se "now" coincide con l\'ultima lettura (nessun duplicato)', () => {
    render(
      <ConsumptionChart
        letture={[{ timestamp: ORA_FISSA.toISOString(), potenza: 42 }]}
        loading={false}
      />,
    );

    const { data } = leggiProps();
    expect(data.datasets[0].data).toHaveLength(1);
  });

  const unaLettura = [{ timestamp: '2026-07-20T10:00:00.000Z', potenza: 1 }];

  test('con periodo "24h", minUnit dell\'asse temporale è "hour"', () => {
    render(<ConsumptionChart letture={unaLettura} loading={false} periodo="24h" />);

    const { options } = leggiProps();
    expect(options.scales.x.time.minUnit).toBe('hour');
  });

  test.each(['7g', '30g', 'tutto'])('con periodo "%s", minUnit dell\'asse temporale è "day"', (periodo) => {
    render(<ConsumptionChart letture={unaLettura} loading={false} periodo={periodo} />);

    const { options } = leggiProps();
    expect(options.scales.x.time.minUnit).toBe('day');
  });

  test('senza la prop periodo (default), minUnit risolve a "day"', () => {
    render(<ConsumptionChart letture={unaLettura} loading={false} />);

    const { options } = leggiProps();
    expect(options.scales.x.time.minUnit).toBe('day');
  });

  test('il dataset usa sempre cubicInterpolationMode: "monotone" (non "tension")', () => {
    render(<ConsumptionChart letture={[{ timestamp: '2026-07-20T10:00:00.000Z', potenza: 1 }]} loading={false} />);

    const { data } = leggiProps();
    expect(data.datasets[0].cubicInterpolationMode).toBe('monotone');
    expect(data.datasets[0]).not.toHaveProperty('tension');
  });

  test('cambiare tab (W/V/A) aggiorna la chiave letta e il colore, senza alterare l\'ordinamento dei punti', async () => {
    const user = userEvent.setup();
    const letture = [
      { timestamp: '2026-07-20T09:00:00.000Z', potenza: 10, tensione: 229, corrente: 0.04 },
      { timestamp: '2026-07-20T10:00:00.000Z', potenza: 20, tensione: 230, corrente: 0.09 },
    ];
    render(<ConsumptionChart letture={letture} loading={false} />);

    let { data } = leggiProps();
    expect(data.datasets[0].data.map((p) => p.y)).toEqual([10, 20, 20]); // potenza di default

    await user.click(screen.getByRole('tab', { name: 'V' }));

    ({ data } = leggiProps());
    expect(data.datasets[0].data.map((p) => p.y)).toEqual([229, 230, 230]);
    expect(data.datasets[0].borderColor).toBe('#5c7a2e');
  });

  test('mostra il messaggio di caricamento e non renderizza il grafico mentre loading è true', () => {
    render(<ConsumptionChart letture={[]} loading={true} />);

    expect(screen.getByText('Caricamento…')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  test('mostra il messaggio "nessun dato" quando letture è vuoto e loading è false', () => {
    render(<ConsumptionChart letture={[]} loading={false} />);

    expect(screen.getByText('Nessun dato per il periodo selezionato.')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });
});