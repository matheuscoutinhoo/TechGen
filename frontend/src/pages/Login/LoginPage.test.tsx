import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { AuthProvider } from '../../contexts/AuthContext';
import { tokenStorage } from '../../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

function renderLogin() {
   return render(
      <MemoryRouter initialEntries={['/login']}>
         <AuthProvider>
            <Routes>
               <Route path="/login" element={<LoginPage />} />
               <Route path="/trails/new" element={<div>nova trilha ok</div>} />
            </Routes>
         </AuthProvider>
      </MemoryRouter>,
   );
}

describe('<LoginPage />', () => {
   beforeEach(() => {
      tokenStorage.clear();
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
   });

   it('autentica com sucesso e navega para /trails/new', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse({
            access_token: 'jwt',
            token_type: 'bearer',
            user: {
               id: 1,
               name: 'Ada',
               email: 'ada@example.com',
               created_at: '2025-01-01T00:00:00Z',
               updated_at: '2025-01-01T00:00:00Z',
            },
         }),
      ) as unknown as typeof fetch;

      renderLogin();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText('Email'), 'ada@example.com');
      await user.type(screen.getByLabelText('Senha'), 'supersecret');
      await user.click(screen.getByRole('button', { name: 'Entrar' }));

      await waitFor(() => expect(screen.getByText('nova trilha ok')).toBeInTheDocument());
      expect(tokenStorage.get()).toBe('jwt');
   });

   it('mostra mensagem de erro vinda do backend em credenciais inválidas', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse(
            { error: { code: 'AUTH_ERROR', message: 'Credenciais inválidas' } },
            401,
         ),
      ) as unknown as typeof fetch;

      renderLogin();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText('Email'), 'ada@example.com');
      await user.type(screen.getByLabelText('Senha'), 'wrongpass1');
      await user.click(screen.getByRole('button', { name: 'Entrar' }));

      await waitFor(() =>
         expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument(),
      );
      expect(tokenStorage.get()).toBeNull();
   });
});
