import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { AuthProvider } from '../../contexts/AuthContext';
import { tokenStorage } from '../../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

const USER = {
   id: 1,
   name: 'Ada Lovelace',
   email: 'ada@example.com',
   created_at: '2025-01-01T00:00:00Z',
   updated_at: '2025-01-01T00:00:00Z',
};

function buildFetch(trails: unknown[]) {
   return vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(USER));
      if (url.endsWith('/learning-trails')) return Promise.resolve(jsonResponse(trails));
      return Promise.resolve(jsonResponse({}));
   });
}

function renderDashboard() {
   return render(
      <MemoryRouter initialEntries={['/dashboard']}>
         <AuthProvider>
            <Routes>
               <Route path="/dashboard" element={<DashboardPage />} />
               <Route path="/trails/new" element={<div>nova trilha ok</div>} />
               <Route path="/trails/:id" element={<div>detalhe ok</div>} />
            </Routes>
         </AuthProvider>
      </MemoryRouter>,
   );
}

const TRAIL_FIXTURE = {
   id: 7,
   topic: 'FastAPI',
   title: 'Projeto FastAPI',
   summary: 'Resumo do projeto.',
   ticket_count: 0,
   completed_ticket_count: 0,
   created_at: '2025-01-01T00:00:00Z',
   updated_at: '2025-01-02T00:00:00Z',
};

describe('<DashboardPage />', () => {
   beforeEach(() => {
      tokenStorage.set('jwt');
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
      tokenStorage.clear();
   });

   it('mostra empty state quando não há trilhas', async () => {
      globalThis.fetch = buildFetch([]) as unknown as typeof fetch;

      renderDashboard();
      await waitFor(() =>
         expect(
            screen.getByRole('heading', { name: 'Você ainda não criou nenhuma trilha' }),
         ).toBeInTheDocument(),
      );
   });

   it('renderiza lista de trilhas e cabeçalho com nome do usuário', async () => {
      globalThis.fetch = buildFetch([
         {
            id: 1,
            topic: 'FastAPI',
            title: 'Projeto FastAPI',
            summary: 'Resumo do projeto.',
            ticket_count: 4,
            completed_ticket_count: 1,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
         },
         {
            id: 2,
            topic: 'React',
            title: 'Projeto React',
            summary: 'Outro resumo.',
            ticket_count: 3,
            completed_ticket_count: 3,
            created_at: '2025-01-03T00:00:00Z',
            updated_at: '2025-01-04T00:00:00Z',
         },
      ]) as unknown as typeof fetch;

      renderDashboard();
      await waitFor(() =>
         expect(screen.getByRole('heading', { name: /Suas trilhas/i })).toBeInTheDocument(),
      );
      expect(screen.getByText('Projeto FastAPI')).toBeInTheDocument();
      expect(screen.getByText('Projeto React')).toBeInTheDocument();
      expect(screen.getByText(/Olá, Ada/)).toBeInTheDocument();
      expect(screen.getByText('2 trilhas')).toBeInTheDocument();
   });

   it('botão "Nova trilha" navega para /trails/new', async () => {
      globalThis.fetch = buildFetch([]) as unknown as typeof fetch;

      renderDashboard();
      await waitFor(() => expect(screen.getByText(/0 trilhas/)).toBeInTheDocument());

      const user = userEvent.setup();
      await user.click(
         screen.getByRole('button', { name: 'Criar primeira trilha' }),
      );
      expect(screen.getByText('nova trilha ok')).toBeInTheDocument();
   });

   it('ícone de remover dispara confirm, chama DELETE e refaz fetch', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      let listResponse: unknown[] = [TRAIL_FIXTURE];
      let deleteCalled = false;
      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
         if (typeof url === 'string' && url.includes('/users/me')) {
            return Promise.resolve(jsonResponse(USER));
         }
         if (init?.method === 'DELETE' && String(url).includes('/learning-trails/7')) {
            deleteCalled = true;
            listResponse = [];
            return Promise.resolve(new Response(null, { status: 204 }));
         }
         if (typeof url === 'string' && url.endsWith('/learning-trails')) {
            return Promise.resolve(jsonResponse(listResponse));
         }
         return Promise.resolve(jsonResponse({}));
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      renderDashboard();
      await waitFor(() => expect(screen.getByText('Projeto FastAPI')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.click(
         screen.getByRole('button', { name: 'Remover trilha Projeto FastAPI' }),
      );

      expect(confirmSpy).toHaveBeenCalledTimes(1);

      // após remoção + refetch, mostra empty state
      await waitFor(() =>
         expect(
            screen.getByRole('heading', { name: 'Você ainda não criou nenhuma trilha' }),
         ).toBeInTheDocument(),
      );

      expect(deleteCalled).toBe(true);
   });

   it('cancelar o confirm não remove a trilha', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      let deleteCalled = false;
      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
         if (typeof url === 'string' && url.includes('/users/me')) {
            return Promise.resolve(jsonResponse(USER));
         }
         if (init?.method === 'DELETE') {
            deleteCalled = true;
            return Promise.resolve(new Response(null, { status: 204 }));
         }
         if (typeof url === 'string' && url.endsWith('/learning-trails')) {
            return Promise.resolve(jsonResponse([TRAIL_FIXTURE]));
         }
         return Promise.resolve(jsonResponse({}));
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      renderDashboard();
      await waitFor(() => expect(screen.getByText('Projeto FastAPI')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.click(
         screen.getByRole('button', { name: 'Remover trilha Projeto FastAPI' }),
      );

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Projeto FastAPI')).toBeInTheDocument();
      expect(deleteCalled).toBe(false);
   });
});
