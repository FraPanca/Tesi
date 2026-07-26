import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../src/hooks/useRecentReadings', () => ({ default: vi.fn() }));


import useRecentReadings from '../../../src/hooks/useRecentReadings';
import PresaCard from '../../../src/components/PresaCard';


function renderPresaCard(props) {
  return render(
    <MemoryRouter>
      <PresaCard {...props} />
    </MemoryRouter>,
  );
}

const presaBase = { presaId: 'presa1', nome: 'Frigo', stato: 'off', sogliaPotenza: null };


describe('PresaCard', () => {
  beforeEach(() => {
    useRecentReadings.mockReturnValue({ letture: [] });
  });

  test('mostra il nome della presa e "––.–" se non ci sono ancora letture', () => {
    renderPresaCard({ presa: presaBase, onComando: vi.fn(), onRimuovi: vi.fn() });

    expect(screen.getByText('Frigo')).toBeInTheDocument();
    expect(screen.getByText('––.–')).toBeInTheDocument();
  });

  test("mostra l'ultima potenza (la lettura più recente, indice 0) con una cifra decimale", () => {
    useRecentReadings.mockReturnValue({ letture: [{ potenza: 42.567 }, { potenza: 10 }] });

    renderPresaCard({ presa: presaBase, onComando: vi.fn(), onRimuovi: vi.fn() });

    expect(screen.getByText('42.6')).toBeInTheDocument();
  });

  test('mostra la soglia solo se impostata', () => {
    const { rerender } = renderPresaCard({
      presa: { ...presaBase, sogliaPotenza: 150 },
      onComando: vi.fn(),
      onRimuovi: vi.fn(),
    });
    expect(screen.getByText(/Spegnimento automatico oltre 150 W/)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <PresaCard presa={presaBase} onComando={vi.fn()} onRimuovi={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Spegnimento automatico/)).not.toBeInTheDocument();
  });

  test('con presa spenta: il bottone ON è abilitato, OFF è disabilitato', () => {
    renderPresaCard({ presa: { ...presaBase, stato: 'off' }, onComando: vi.fn(), onRimuovi: vi.fn() });

    expect(screen.getByRole('button', { name: 'ON' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'OFF' })).toBeDisabled();
  });

  test('con presa accesa: il bottone OFF è abilitato, ON è disabilitato', () => {
    renderPresaCard({ presa: { ...presaBase, stato: 'on' }, onComando: vi.fn(), onRimuovi: vi.fn() });

    expect(screen.getByRole('button', { name: 'OFF' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'ON' })).toBeDisabled();
  });

  test('cliccando ON viene chiamato onComando con (presaId, "on")', async () => {
    const user = userEvent.setup();
    const onComando = vi.fn().mockResolvedValue();
    renderPresaCard({ presa: { ...presaBase, stato: 'off' }, onComando, onRimuovi: vi.fn() });

    await user.click(screen.getByRole('button', { name: 'ON' }));

    expect(onComando).toHaveBeenCalledWith('presa1', 'on');
  });

  test('mentre il comando è in corso, mostra il messaggio di invio e poi lo rimuove', async () => {
    const user = userEvent.setup();
    let risolviComando;
    const onComando = vi.fn(() => new Promise((resolve) => { risolviComando = resolve; }));
    renderPresaCard({ presa: { ...presaBase, stato: 'off' }, onComando, onRimuovi: vi.fn() });

    await user.click(screen.getByRole('button', { name: 'ON' }));
    expect(screen.getByText(/Invio comando/)).toBeInTheDocument();

    risolviComando();
    await screen.findByRole('button', { name: 'ON' }); // attende il re-render dopo la risoluzione
    expect(screen.queryByText(/Invio comando/)).not.toBeInTheDocument();
  });

  test('se onComando fallisce, mostra il messaggio di errore', async () => {
    const user = userEvent.setup();
    const onComando = vi.fn().mockRejectedValue(new Error('Presa non raggiungibile'));
    renderPresaCard({ presa: { ...presaBase, stato: 'off' }, onComando, onRimuovi: vi.fn() });

    await user.click(screen.getByRole('button', { name: 'ON' }));

    expect(await screen.findByText('Presa non raggiungibile')).toBeInTheDocument();
  });

  test('cliccando "✕" viene chiamato onRimuovi con il presaId', async () => {
    const user = userEvent.setup();
    const onRimuovi = vi.fn();
    renderPresaCard({ presa: presaBase, onComando: vi.fn(), onRimuovi });

    await user.click(screen.getByRole('button', { name: 'Rimuovi Frigo' }));

    expect(onRimuovi).toHaveBeenCalledWith('presa1');
  });
});