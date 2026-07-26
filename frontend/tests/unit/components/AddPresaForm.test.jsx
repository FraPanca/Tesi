import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddPresaForm from '../../../src/components/AddPresaForm';


async function compilaEInvia(user, { presaId = 'presa3', nome = 'Lavatrice', ip = '192.168.1.30', sogliaPotenza } = {}) {
  await user.type(screen.getByLabelText(/Identificativo/), presaId);
  await user.type(screen.getByLabelText('Nome'), nome);
  await user.type(screen.getByLabelText(/Indirizzo IP/), ip);
  if (sogliaPotenza !== undefined) {
    await user.type(screen.getByLabelText(/Soglia potenza/), String(sogliaPotenza));
  }
  await user.click(screen.getByRole('button', { name: /^Aggiungi$/ }));
}


describe('AddPresaForm', () => {
  test('invia i campi ripuliti (trim) e sogliaPotenza convertita a Number', async () => {
    const user = userEvent.setup();
    const onCrea = vi.fn().mockResolvedValue();
    const onChiudi = vi.fn();
    render(<AddPresaForm onCrea={onCrea} onChiudi={onChiudi} />);

    await user.type(screen.getByLabelText(/Identificativo/), '  presa3  ');
    await user.type(screen.getByLabelText('Nome'), '  Lavatrice  ');
    await user.type(screen.getByLabelText(/Indirizzo IP/), '  192.168.1.30  ');
    await user.type(screen.getByLabelText(/Soglia potenza/), '200');
    await user.click(screen.getByRole('button', { name: /^Aggiungi$/ }));

    expect(onCrea).toHaveBeenCalledWith({
      presaId: 'presa3',
      nome: 'Lavatrice',
      ip: '192.168.1.30',
      sogliaPotenza: 200,
    });
  });

  test('con soglia potenza vuota, invia sogliaPotenza: null (non 0 né NaN)', async () => {
    const user = userEvent.setup();
    const onCrea = vi.fn().mockResolvedValue();
    render(<AddPresaForm onCrea={onCrea} onChiudi={vi.fn()} />);

    await compilaEInvia(user);

    expect(onCrea).toHaveBeenCalledWith(expect.objectContaining({ sogliaPotenza: null }));
  });

  test('chiude il form dopo una creazione riuscita', async () => {
    const user = userEvent.setup();
    const onChiudi = vi.fn();
    render(<AddPresaForm onCrea={vi.fn().mockResolvedValue()} onChiudi={onChiudi} />);

    await compilaEInvia(user);

    expect(onChiudi).toHaveBeenCalledTimes(1);
  });

  test('se onCrea fallisce, mostra il messaggio di errore e NON chiude il form', async () => {
    const user = userEvent.setup();
    const onChiudi = vi.fn();
    const onCrea = vi.fn().mockRejectedValue(new Error('presaId già registrato'));
    render(<AddPresaForm onCrea={onCrea} onChiudi={onChiudi} />);

    await compilaEInvia(user);

    expect(await screen.findByText('presaId già registrato')).toBeInTheDocument();
    expect(onChiudi).not.toHaveBeenCalled();
  });

  test('cliccando "Annulla" chiama onChiudi senza chiamare onCrea', async () => {
    const user = userEvent.setup();
    const onCrea = vi.fn();
    const onChiudi = vi.fn();
    render(<AddPresaForm onCrea={onCrea} onChiudi={onChiudi} />);

    await user.click(screen.getByRole('button', { name: 'Annulla' }));

    expect(onChiudi).toHaveBeenCalledTimes(1);
    expect(onCrea).not.toHaveBeenCalled();
  });

  test('durante l\'invio i bottoni sono disabilitati e il testo cambia in "Aggiunta…"', async () => {
    const user = userEvent.setup();
    let risolvi;
    const onCrea = vi.fn(() => new Promise((resolve) => { risolvi = resolve; }));
    render(<AddPresaForm onCrea={onCrea} onChiudi={vi.fn()} />);

    await user.type(screen.getByLabelText(/Identificativo/), 'presa3');
    await user.type(screen.getByLabelText('Nome'), 'Lavatrice');
    await user.type(screen.getByLabelText(/Indirizzo IP/), '192.168.1.30');
    await user.click(screen.getByRole('button', { name: /^Aggiungi$/ }));

    expect(screen.getByRole('button', { name: 'Aggiunta…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeDisabled();

    risolvi();
  });
});