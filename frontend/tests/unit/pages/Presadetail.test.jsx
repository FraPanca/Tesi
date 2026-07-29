import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../../src/hooks/usePrese', () => ({ default: vi.fn() }));
vi.mock('../../../src/hooks/useReadingsHistory', () => ({ default: vi.fn() }));
vi.mock('../../../src/hooks/useNow', () => ({ default: vi.fn() }));
vi.mock('../../../src/components/ConsumptionChart', () => ({ default: () => <div data-testid="chart" /> }));

import usePrese from '../../../src/hooks/usePrese';
import useReadingsHistory from '../../../src/hooks/useReadingsHistory';
import useNow from '../../../src/hooks/useNow';
import PresaDetail from '../../../src/pages/PresaDetail';


const PRESA = { presaId: 'presa1', nome: 'Frigo', stato: 'off', ip: '192.168.1.10' };


function ultimoDa() {
  const chiamate = useReadingsHistory.mock.calls;
  return chiamate[chiamate.length - 1][1].da;
}

function renderPresaDetail() {
  return render(
    <MemoryRouter initialEntries={['/prese/presa1']}>
      <Routes>
        <Route path="/prese/:presaId" element={<PresaDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PresaDetail — finestra temporale "24 ore" (stessa logica di Dashboard, file separato)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePrese.mockReturnValue({
      prese: [PRESA],
      loading: false,
      aggiornaPresa: vi.fn(),
      rimuoviPresa: vi.fn(),
      inviaComando: vi.fn(),
    });
    useReadingsHistory.mockReturnValue({ letture: [], loading: false });
  });

  test('con periodo di default ("7 giorni"), "da" non cambia se "now" avanza', () => {
    useNow.mockReturnValue(new Date('2026-07-20T10:00:00.000Z'));
    const { rerender } = renderPresaDetail();
    const daIniziale = ultimoDa();

    useNow.mockReturnValue(new Date('2026-07-20T10:05:00.000Z'));
    rerender(
      <MemoryRouter initialEntries={['/prese/presa1']}>
        <Routes>
          <Route path="/prese/:presaId" element={<PresaDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(ultimoDa()).toBe(daIniziale);
  });

  test('con periodo "24 ore", "da" si aggiorna quando "now" avanza', async () => {
    const user = userEvent.setup();
    useNow.mockReturnValue(new Date('2026-07-20T10:00:00.000Z'));
    renderPresaDetail();
    await user.click(screen.getByRole('button', { name: '24 ore' }));
    const daIniziale = ultimoDa();

    useNow.mockReturnValue(new Date('2026-07-20T11:00:00.000Z'));
    await user.click(screen.getByRole('button', { name: '24 ore' })); // click "neutro": forza un render, periodo invariato

    expect(ultimoDa()).not.toBe(daIniziale);
  });
});