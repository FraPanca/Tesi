import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-chartjs-2', () => ({
  Line: (props) => <div data-testid="line-chart" data-props={JSON.stringify(props)} />,
}));

import ForecastChart from '../../../src/components/ForecastChart';


const VALORI = [
  { ds: '2026-08-11T00:00:00.000Z', yhat: 45.2, yhatLower: 30.1, yhatUpper: 60.3 },
  { ds: '2026-08-11T01:00:00.000Z', yhat: 42.8, yhatLower: 28.4, yhatUpper: 57.1 },
];


function leggiProps() {
  return JSON.parse(screen.getByTestId('line-chart').dataset.props);
}

describe('ForecastChart', () => {
  test('costruisce i tre dataset nell\'ordine giusto: limite superiore, limite inferiore, previsione', () => {
    render(<ForecastChart valoriPrevisti={VALORI} />);

    const { data } = leggiProps();
    expect(data.datasets).toHaveLength(3);
    expect(data.datasets.map((d) => d.label)).toEqual(['Limite superiore', 'Limite inferiore', 'Previsione']);
  });

  test('il limite superiore non ha fill; il limite inferiore ha fill: "-1" per colorare la banda fino al dataset precedente', () => {
    render(<ForecastChart valoriPrevisti={VALORI} />);

    const { data } = leggiProps();
    const [limiteSuperiore, limiteInferiore] = data.datasets;

    expect(limiteSuperiore.fill).toBe(false);
    expect(limiteInferiore.fill).toBe('-1');
    expect(limiteInferiore.backgroundColor).toBeTruthy();
  });

  test('ogni dataset usa il campo corretto (yhatUpper/yhatLower/yhat) per ciascun punto', () => {
    render(<ForecastChart valoriPrevisti={VALORI} />);

    const { data } = leggiProps();
    const [limiteSuperiore, limiteInferiore, previsione] = data.datasets;

    expect(limiteSuperiore.data.map((p) => p.y)).toEqual([60.3, 57.1]);
    expect(limiteInferiore.data.map((p) => p.y)).toEqual([30.1, 28.4]);
    expect(previsione.data.map((p) => p.y)).toEqual([45.2, 42.8]);
  });

  test('asse temporale a "hour" (i punti sono orari, non giornalieri come ConsumptionChart)', () => {
    render(<ForecastChart valoriPrevisti={VALORI} />);

    const { options } = leggiProps();
    expect(options.scales.x.time.minUnit).toBe('hour');
  });
});