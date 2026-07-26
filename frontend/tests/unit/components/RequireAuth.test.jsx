import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../../src/context/AuthContext', () => ({ useAuth: vi.fn() }));


import { useAuth } from '../../../src/context/AuthContext';
import RequireAuth from '../../../src/components/RequireAuth';


function renderConRoute(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Pagina di login</div>} />
        <Route
          path="/protetta"
          element={
            <RequireAuth>
              <div>Contenuto protetto</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}


describe('RequireAuth', () => {
  test('se autenticato, mostra i children', () => {
    useAuth.mockReturnValue({ isAuthenticated: true });

    renderConRoute('/protetta');

    expect(screen.getByText('Contenuto protetto')).toBeInTheDocument();
  });

  test('se NON autenticato, reindirizza a /login', () => {
    useAuth.mockReturnValue({ isAuthenticated: false });

    renderConRoute('/protetta');

    expect(screen.getByText('Pagina di login')).toBeInTheDocument();
    expect(screen.queryByText('Contenuto protetto')).not.toBeInTheDocument();
  });
});