import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

function buildFetch(opts: { trails: unknown[]; skills?: unknown[] }) {
   const skills = opts.skills ?? [];
   return vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/users/me')) return Promise.resolve(jsonResponse(USER));
      if (url.endsWith('/learning-trails')) {
         return Promise.resolve(jsonResponse(opts.trails));
      }
      if (url.includes('/skills')) return Promise.resolve(jsonResponse(skills));
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
               <Route path="/trails" element={<div>trilhas ok</div>} />
               <Route
                  path="/trails/:id"
                  element={<div>detalhe ok</div>}
               />
               <Route path="/account" element={<div>conta ok</div>} />
            </Routes>
         </AuthProvider>
      </MemoryRouter>,
   );
}

describe('<DashboardPage /> (visão geral)', () => {
   beforeEach(() => {
      tokenStorage.set('jwt');
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
      tokenStorage.clear();
   });

   it('mostra empty state quando o usuário não tem trilhas', async () => {
      globalThis.fetch = buildFetch({ trails: [] }) as unknown as typeof fetch;
      renderDashboard();
      await waitFor(() =>
         expect(
            screen.getByText(/Comece criando sua primeira trilha/i),
         ).toBeInTheDocument(),
      );
   });

   it('renderiza KPIs com métricas agregadas das trilhas', async () => {
      globalThis.fetch = buildFetch({
         trails: [
            {
               id: 1,
               topic: 'FastAPI',
               title: 'Plataforma A',
               summary: 'Resumo A.',
               ticket_count: 10,
               completed_ticket_count: 4,
               completed_at: null,
               created_at: '2026-06-01T00:00:00Z',
               updated_at: '2026-06-08T00:00:00Z',
            },
            {
               id: 2,
               topic: 'React',
               title: 'Plataforma B',
               summary: 'Resumo B.',
               ticket_count: 6,
               completed_ticket_count: 6,
               completed_at: '2026-06-05T00:00:00Z',
               created_at: '2026-05-15T00:00:00Z',
               updated_at: '2026-06-05T00:00:00Z',
            },
         ],
         skills: [
            { id: 1, name: 'python', proficiency: 3 },
            { id: 2, name: 'tdd', proficiency: 4 },
            { id: 3, name: 'docker', proficiency: 2 },
         ],
      }) as unknown as typeof fetch;

      renderDashboard();

      // KPI: tickets finalizados — 4 + 6 = 10
      await waitFor(() =>
         expect(screen.getByText(/Tickets finalizados/i)).toBeInTheDocument(),
      );
      expect(screen.getByText('10')).toBeInTheDocument();
      // KPI: trilhas ativas — 1 (uma concluída, uma em andamento)
      expect(screen.getByText('Uma trilha em andamento')).toBeInTheDocument();
      // KPI: skills no perfil — 3
      expect(screen.getByText('Skills no perfil')).toBeInTheDocument();
      expect(screen.getByText(/2 no intermediate\+/i)).toBeInTheDocument();
   });

   it('mostra a trilha em andamento na lista "Continue de onde parou"', async () => {
      globalThis.fetch = buildFetch({
         trails: [
            {
               id: 42,
               topic: 'Kubernetes',
               title: 'Cluster GitOps',
               summary: 'Resumo.',
               ticket_count: 8,
               completed_ticket_count: 3,
               completed_at: null,
               created_at: '2026-06-01T00:00:00Z',
               updated_at: '2026-06-09T00:00:00Z',
            },
         ],
         skills: [],
      }) as unknown as typeof fetch;

      renderDashboard();
      await waitFor(() =>
         expect(screen.getByText('Cluster GitOps')).toBeInTheDocument(),
      );
      expect(screen.getByText('Kubernetes')).toBeInTheDocument();
      expect(
         screen.getByRole('link', { name: /Ver todas as trilhas/i }),
      ).toHaveAttribute('href', '/trails');
   });
});
