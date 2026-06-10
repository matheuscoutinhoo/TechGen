import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { tokenStorage } from './utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

describe('<App /> + router', () => {
   beforeEach(() => {
      tokenStorage.clear();
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
   });

   it('em / mostra a home pública quando guest', async () => {
      render(
         <MemoryRouter initialEntries={['/']}>
            <App />
         </MemoryRouter>,
      );
      await waitFor(() =>
         expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/projetos reais/),
      );
   });

   it('rota desconhecida cai no NotFound', async () => {
      render(
         <MemoryRouter initialEntries={['/rota-inexistente']}>
            <App />
         </MemoryRouter>,
      );
      await waitFor(() =>
         expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument(),
      );
   });

   it('em /dashboard sem auth redireciona para /login', async () => {
      render(
         <MemoryRouter initialEntries={['/dashboard']}>
            <App />
         </MemoryRouter>,
      );
      await waitFor(() =>
         expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument(),
      );
   });

   it('quando autenticado, / redireciona para /trails/new', async () => {
      tokenStorage.set('jwt');
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
         if (url.endsWith('/users/me')) {
            return Promise.resolve(
               jsonResponse({
                  id: 1,
                  name: 'Ada',
                  email: 'ada@example.com',
                  created_at: '2025-01-01T00:00:00Z',
                  updated_at: '2025-01-01T00:00:00Z',
               }),
            );
         }
         if (url.endsWith('/learning-trails')) {
            return Promise.resolve(jsonResponse([]));
         }
         return Promise.resolve(jsonResponse({}));
      }) as unknown as typeof fetch;

      render(
         <MemoryRouter initialEntries={['/']}>
            <App />
         </MemoryRouter>,
      );
      await waitFor(() =>
         expect(
            screen.getByRole('heading', { name: /O que você quer aprender/i }),
         ).toBeInTheDocument(),
      );
   });
});
