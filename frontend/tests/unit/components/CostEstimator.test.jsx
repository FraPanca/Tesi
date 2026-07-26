import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CostEstimator from '../../../src/components/CostEstimator';

// Due letture di potenza costante 100W per 1 ora esatta -> 100 Wh -> 0.10 kWh.
const LETTURE_100W_1H = [
  { timestamp: '2026-07-20T10:00:00.000Z', potenza: 100 },
  { timestamp: '2026-07-20T11:00:00.000Z', potenza: 100 },
];


describe('CostEstimator', () => {
  test('con meno di 2 letture mostra 0.00 kWh (energia non calcolabile)', () => {
    render(<CostEstimator letture={[{ timestamp: '2026-07-20T10:00:00.000Z', potenza: 100 }]} />);

    expect(screen.getByText(/0\.00 kWh/)).toBeInTheDocument();
  });

  test('integra correttamente due letture costanti (100W per 1h = 0.10 kWh)', () => {
    render(<CostEstimator letture={LETTURE_100W_1H} />);

    expect(screen.getByText(/0\.10 kWh/)).toBeInTheDocument();
  });

  test('con potenza variabile, usa la media trapezoidale tra le due letture', () => {
    // 100W -> 200W in 1h: media 150W per 1h = 0.15 kWh.
    render(
      <CostEstimator
        letture={[
          { timestamp: '2026-07-20T10:00:00.000Z', potenza: 100 },
          { timestamp: '2026-07-20T11:00:00.000Z', potenza: 200 },
        ]}
      />,
    );

    expect(screen.getByText(/0\.15 kWh/)).toBeInTheDocument();
  });

  test('ignora una coppia di letture con timestamp fuori ordine (deltaOre <= 0)', () => {
    render(
      <CostEstimator
        letture={[
          { timestamp: '2026-07-20T11:00:00.000Z', potenza: 100 },
          { timestamp: '2026-07-20T10:00:00.000Z', potenza: 100 }, // precedente al primo: ignorata
        ]}
      />,
    );

    expect(screen.getByText(/0\.00 kWh/)).toBeInTheDocument();
  });

  test('senza tariffa inserita, non mostra nessun costo stimato', () => {
    render(<CostEstimator letture={LETTURE_100W_1H} />);

    expect(screen.queryByText(/Costo stimato/)).not.toBeInTheDocument();
  });

  test('calcola il costo moltiplicando energia stimata per la tariffa inserita', async () => {
    const user = userEvent.setup();
    render(<CostEstimator letture={LETTURE_100W_1H} />);

    await user.type(screen.getByLabelText(/Tariffa/), '2');

    // 0.10 kWh * 2 €/kWh = 0.20 €
    expect(screen.getByText(/€ 0\.20/)).toBeInTheDocument();
  });

  test('accetta la virgola come separatore decimale nella tariffa (convenzione italiana)', async () => {
    const user = userEvent.setup();
    render(<CostEstimator letture={LETTURE_100W_1H} />);

    await user.type(screen.getByLabelText(/Tariffa/), '0,25');

    // 0.10 kWh * 0.25 €/kWh = 0.025 -> arrotondato a 0.03 €
    expect(screen.getByText(/€ 0\.03/)).toBeInTheDocument();
  });
});