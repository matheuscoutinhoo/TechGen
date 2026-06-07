import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';
import { AuthProvider } from '../../../contexts/AuthContext';
import { tokenStorage } from '../../../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

function renderHeader() {
   return render(
      <MemoryRouter>
         <AuthProvider>
            <Header />
         </AuthProvider>
      </MemoryRouter>,
   );
}

describe('<Header />', () => {
   beforeEach(() => {
      tokenStorage.clear();
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
   });

   it('em estado guest mostra links de Entrar e Criar conta', async () => {
      renderHeader();
      await waitFor(() => expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument();
   });

   it('quando autenticado mostra navegação principal e botão Sair', async () => {
      tokenStorage.set('jwt');
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse({
            id: 1,
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
         }),
      ) as unknown as typeof fetch;

      renderHeader();
      await waitFor(() =>
         expect(screen.getByRole('link', { name: 'Trilhas' })).toBeInTheDocument(),
      );
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Sair' }));

      await waitFor(() => expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument());
      expect(tokenStorage.get()).toBeNull();
   });
});
