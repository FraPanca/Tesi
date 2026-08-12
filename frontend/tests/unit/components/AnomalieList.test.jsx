import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnomalieList from '../../../src/components/AnomalieList';


describe('AnomalieList', () => {
  test('ordina le anomalie per data DECRESCENTE (più recenti prime), indipendentemente dall\'ordine ricevuto', () => {
    const anomalie = [
      { ds: '2026-08-06T00:00:00.000Z', y: 900, punteggio: -0.72 },
      { ds: '2026-08-09T03:00:00.000Z', y: 780.5, punteggio: -0.41 },
      { ds: '2026-08-07T12:00:00.000Z', y: 850, punteggio: -0.55 },
    ];

    render(<AnomalieList anomalie={anomalie} />);

    const voci = screen.getAllByRole('listitem').map((li) => li.textContent);
    // La prima voce mostrata deve corrispondere alla data più recente (9 agosto), l'ultima alla più vecchia (6 agosto).
    expect(voci[0]).toContain('780.5');
    expect(voci[1]).toContain('850.0');
    expect(voci[2]).toContain('900.0');
  });

  test('mostra valore in W (una cifra decimale) e punteggio (due cifre decimali)', () => {
    render(<AnomalieList anomalie={[{ ds: '2026-08-06T00:00:00.000Z', y: 900, punteggio: -0.723456 }]} />);

    expect(screen.getByText('900.0 W')).toBeInTheDocument();
    expect(screen.getByText('-0.72')).toBeInTheDocument();
  });

  test('con un array vuoto, non mostra nessuna voce', () => {
    render(<AnomalieList anomalie={[]} />);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});