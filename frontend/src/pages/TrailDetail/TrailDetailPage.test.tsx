import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TrailDetailPage } from './TrailDetailPage';
import { tokenStorage } from '../../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

const TRAIL = {
   id: 7,
   topic: 'FastAPI',
   title: 'Plataforma FastAPI',
   summary: 'Resumo.',
   created_at: '2025-01-01T00:00:00Z',
   updated_at: '2025-01-02T00:00:00Z',
   content: {
      project_title: 'Plataforma FastAPI',
      project_summary: 'Resumo.',
      why_realistic: 'Real.',
      target_audience: 'Devs.',
      prerequisites: ['Git'],
      tickets: [
         {
            code: 'TG-1',
            title: 'Setup',
            objective: 'Preparar ambiente.',
            concepts: [],
            tasks: [{ description: 'Instalar' }],
            acceptance_criteria: ['ok'],
            estimated_effort: '1h',
         },
         {
            code: 'TG-2',
            title: 'TDD',
            objective: 'Escrever primeiro teste.',
            concepts: [],
            tasks: [],
            acceptance_criteria: [],
            estimated_effort: null,
         },
      ],
   },
};

function renderDetail() {
   return render(
      <MemoryRouter initialEntries={['/trails/7']}>
         <Routes>
            <Route path="/trails/:id" element={<TrailDetailPage />} />
            <Route path="/trails/:id/edit" element={<div>edit ok</div>} />
            <Route path="/dashboard" element={<div>dashboard ok</div>} />
         </Routes>
      </MemoryRouter>,
   );
}

describe('<TrailDetailPage />', () => {
   beforeEach(() => {
      tokenStorage.set('jwt');
      vi.spyOn(window, 'confirm').mockReturnValue(true);
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
      tokenStorage.clear();
   });

   it('renderiza cabeçalho da trilha e lista de tickets', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(TRAIL)) as unknown as typeof fetch;

      renderDetail();
      await waitFor(() =>
         expect(screen.getByRole('heading', { level: 1, name: 'Plataforma FastAPI' })).toBeInTheDocument(),
      );
      expect(screen.getByText('TG-1')).toBeInTheDocument();
      expect(screen.getByText('TG-2')).toBeInTheDocument();
      expect(screen.getByText('2 tickets')).toBeInTheDocument();
   });

   it('botão Excluir confirma e navega para o dashboard', async () => {
      let deleted = false;
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
         if (init?.method === 'DELETE') {
            deleted = true;
            return Promise.resolve(new Response(null, { status: 204 }));
         }
         return Promise.resolve(jsonResponse(TRAIL));
      }) as unknown as typeof fetch;

      renderDetail();
      await waitFor(() => expect(screen.getByText('Plataforma FastAPI')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Excluir' }));

      await waitFor(() => expect(screen.getByText('dashboard ok')).toBeInTheDocument());
      expect(deleted).toBe(true);
   });

   it('mostra erro quando trilha não é encontrada', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse({ error: { code: 'NOT_FOUND', message: 'Trilha não encontrada' } }, 404),
      ) as unknown as typeof fetch;

      renderDetail();
      await waitFor(() => expect(screen.getByText('Trilha não encontrada')).toBeInTheDocument());
   });
});
