import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import { tokenStorage } from '../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

function TestConsumer() {
   const { user, isAuthenticated, isInitializing, login, logout } = useAuth();
   return (
      <div>
         <span data-testid="status">
            {isInitializing
               ? 'initializing'
               : isAuthenticated
                  ? `authed:${user?.email}`
                  : 'guest'}
         </span>
         <button
            type="button"
            onClick={() =>
               void login({ email: 'ada@example.com', password: 'supersecret' })
            }
         >
            login
         </button>
         <button type="button" onClick={logout}>
            logout
         </button>
      </div>
   );
}

describe('AuthContext', () => {
   beforeEach(() => {
      tokenStorage.clear();
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
   });

   it('inicia como guest quando não há token', async () => {
      render(
         <AuthProvider>
            <TestConsumer />
         </AuthProvider>,
      );
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('guest'));
   });

   it('faz login, persiste token e expõe usuário autenticado', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
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
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      render(
         <AuthProvider>
            <TestConsumer />
         </AuthProvider>,
      );
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('guest'));

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'login' }));

      await waitFor(() =>
         expect(screen.getByTestId('status')).toHaveTextContent('authed:ada@example.com'),
      );
      expect(tokenStorage.get()).toBe('jwt');
   });

   it('logout limpa token e usuário', async () => {
      tokenStorage.set('jwt');
      const mockFetch = vi.fn().mockResolvedValue(
         jsonResponse({
            id: 1,
            name: 'Ada',
            email: 'ada@example.com',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
         }),
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      render(
         <AuthProvider>
            <TestConsumer />
         </AuthProvider>,
      );
      await waitFor(() =>
         expect(screen.getByTestId('status')).toHaveTextContent('authed:ada@example.com'),
      );

      const user = userEvent.setup();
      await act(async () => {
         await user.click(screen.getByRole('button', { name: 'logout' }));
      });
      expect(screen.getByTestId('status')).toHaveTextContent('guest');
      expect(tokenStorage.get()).toBeNull();
   });

   it('quando /users/me responde 401, limpa o token e cai para guest', async () => {
      tokenStorage.set('expired');
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse({ error: { code: 'AUTH_ERROR', message: 'expirado' } }, 401),
      ) as unknown as typeof fetch;

      render(
         <AuthProvider>
            <TestConsumer />
         </AuthProvider>,
      );
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('guest'));
      expect(tokenStorage.get()).toBeNull();
   });
});
