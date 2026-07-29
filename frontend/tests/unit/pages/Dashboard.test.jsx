import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../src/hooks/usePrese', () => ({ default: vi.fn() }));
vi.mock('../../../src/hooks/useReadingsHistory', () => ({ default: vi.fn() }));
vi.mock('../../../src/hooks/useNow', () => ({ default: vi.fn() }));
vi.mock('../../../src/components/ConsumptionChart', () => ({ default: () => <div data-testid="chart" /> }));
vi.mock('../../../src/components/PresaCard', () => ({ default: () => <div /> }));
vi.mock('../../../src/components/AddPresaForm', () => ({ default: () => <div /> }));
vi.mock('../../../src/components/CostEstimator', () => ({ default: () => <div /> }));

import usePrese from '../../../src/hooks/usePrese';
import useReadingsHistory from '../../../src/hooks/useReadingsHistory';
import useNow from '../../../src/hooks/useNow';
import Dashboard from '../../../src/pages/Dashboard';


const PRESA = { presaId: 'presa1', nome: 'Frigo', stato: 'off' };


function ultimoDa() {
  const chiamate = useReadingsHistory.mock.calls;
  return chiamate[chiamate.length - 1][1].da;
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe('Dashboard — finestra temporale "24 ore"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePrese.mockReturnValue({
      prese: [PRESA],
      loading: false,
      error: null,
      creaPresa: vi.fn(),
      rimuoviPresa: vi.fn(),
      inviaComando: vi.fn(),
    });
    useReadingsHistory.mockReturnValue({ letture: [], loading: false });
  });

  test('con periodo di default ("7 giorni"), "da" non cambia se "now" avanza (periodo invariato)', () => {
    useNow.mockReturnValue(new Date('2026-07-20T10:00:00.000Z'));
    const { rerender } = renderDashboard();
    const daIniziale = ultimoDa();

    useNow.mockReturnValue(new Date('2026-07-20T10:05:00.000Z')); // "now" avanza, periodo resta "7g"
    rerender(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(ultimoDa()).toBe(daIniziale);
  });

  test('con periodo "24 ore", "da" si aggiorna quando "now" avanza', async () => {
    const user = userEvent.setup();
    useNow.mockReturnValue(new Date('2026-07-20T10:00:00.000Z'));
    renderDashboard();
    await user.click(screen.getByRole('button', { name: '24 ore' }));
    const daIniziale = ultimoDa();

    useNow.mockReturnValue(new Date('2026-07-20T11:00:00.000Z'));
    await user.click(screen.getByRole('button', { name: '24 ore' }));

    const daNuovo = ultimoDa();
    expect(daNuovo).not.toBe(daIniziale);
    expect(daNuovo).toBe(new Date(new Date('2026-07-20T11:00:00.000Z').getTime() - 24 * 60 * 60 * 1000).toISOString());
  });

  test('REGRESSIONE: con periodo "24 ore", "da" NON cambia tra due render se "now" non è avanzato (evita il loop di refetch)', () => {
    useNow.mockReturnValue(new Date('2026-07-20T10:00:00.000Z'));
    const { rerender } = renderDashboard();

    rerender(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    const da1 = ultimoDa();

    rerender(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    const da2 = ultimoDa();

    expect(da2).toBe(da1);
  });

  test('cambiando periodo da "24 ore" a "7 giorni", "da" torna ad essere quello fisso (non più legato a "now")', async () => {
    const user = userEvent.setup();
    useNow.mockReturnValue(new Date('2026-07-20T10:00:00.000Z'));
    renderDashboard();

    await user.click(screen.getByRole('button', { name: '24 ore' }));
    const daFinestra24h = ultimoDa();

    await user.click(screen.getByRole('button', { name: '7 giorni' }));
    const daSetteGiorni = ultimoDa();

    expect(daSetteGiorni).not.toBe(daFinestra24h);
  });
});