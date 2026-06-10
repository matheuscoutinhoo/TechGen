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
      globalThis.fetch = vi
         .fn()
         .mockImplementation((url: string) => {
            if (typeof url === 'string' && url.includes('/skills')) {
               return Promise.resolve(jsonResponse([]));
            }
            return Promise.resolve(jsonResponse(TRAIL));
         }) as unknown as typeof fetch;

      renderDetail();
      await waitFor(() =>
         expect(screen.getByRole('heading', { level: 1, name: 'Plataforma FastAPI' })).toBeInTheDocument(),
      );
      expect(screen.getByText('TG-1')).toBeInTheDocument();
      expect(screen.getByText('TG-2')).toBeInTheDocument();
      expect(screen.getByText('0 de 2 tickets concluídos')).toBeInTheDocument();
   });

   it('botão Excluir confirma e navega para o dashboard', async () => {
      let deleted = false;
      globalThis.fetch = vi
         .fn()
         .mockImplementation((url: string, init?: RequestInit) => {
            if (init?.method === 'DELETE') {
               deleted = true;
               return Promise.resolve(new Response(null, { status: 204 }));
            }
            if (typeof url === 'string' && url.includes('/skills')) {
               return Promise.resolve(jsonResponse([]));
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
      globalThis.fetch = vi
         .fn()
         .mockImplementation((url: string) => {
            if (typeof url === 'string' && url.includes('/skills')) {
               return Promise.resolve(jsonResponse([]));
            }
            return Promise.resolve(
               jsonResponse(
                  { error: { code: 'NOT_FOUND', message: 'Trilha não encontrada' } },
                  404,
               ),
            );
         }) as unknown as typeof fetch;

      renderDetail();
      await waitFor(() => expect(screen.getByText('Trilha não encontrada')).toBeInTheDocument());
   });

   it('concluir todos os tickets auto-conclui a trilha e exibe feedback', async () => {
      const trailOneDone = {
         ...TRAIL,
         content: {
            ...TRAIL.content,
            tickets: [
               { ...TRAIL.content.tickets[0], completed_at: '2025-01-03T00:00:00Z' },
               { ...TRAIL.content.tickets[1] },
            ],
         },
      };
      const trailAllDone = {
         ...TRAIL,
         completed_at: '2025-01-04T00:00:00Z',
         content: {
            ...TRAIL.content,
            tickets: [
               { ...TRAIL.content.tickets[0], completed_at: '2025-01-03T00:00:00Z' },
               { ...TRAIL.content.tickets[1], completed_at: '2025-01-04T00:00:00Z' },
            ],
         },
      };

      let postCalls = 0;
      globalThis.fetch = vi
         .fn()
         .mockImplementation((url: string, init?: RequestInit) => {
            if (typeof url === 'string' && url.includes('/skills')) {
               return Promise.resolve(jsonResponse([]));
            }
            if (init?.method === 'POST' && url.includes('/tickets/')) {
               postCalls += 1;
               if (postCalls === 1) {
                  return Promise.resolve(
                     jsonResponse({
                        trail: trailOneDone,
                        trail_completed: false,
                        added_concepts: [],
                        upgraded_concepts: [],
                     }),
                  );
               }
               return Promise.resolve(
                  jsonResponse({
                     trail: trailAllDone,
                     trail_completed: true,
                     added_concepts: ['testes'],
                     upgraded_concepts: [],
                  }),
               );
            }
            return Promise.resolve(jsonResponse(TRAIL));
         }) as unknown as typeof fetch;

      renderDetail();
      await waitFor(() =>
         expect(screen.getByText('0 de 2 tickets concluídos')).toBeInTheDocument(),
      );

      const user = userEvent.setup();
      const completeButtons = screen.getAllByRole('button', { name: /marcar como conclu/i });
      await user.click(completeButtons[0]);
      await waitFor(() =>
         expect(screen.getByText('1 de 2 tickets concluídos')).toBeInTheDocument(),
      );

      // O segundo ticket começa colapsado: precisa expandir antes de marcar.
      const expanders = screen.getAllByRole('button', { expanded: false });
      const tg2Expander = expanders.find((btn) => btn.textContent?.includes('TG-2'));
      if (tg2Expander) {
         await user.click(tg2Expander);
      }

      const remainingButton = await screen.findByRole('button', {
         name: /marcar como conclu/i,
      });
      await user.click(remainingButton);
      await waitFor(() =>
         expect(screen.getByText('2 de 2 tickets concluídos')).toBeInTheDocument(),
      );
      expect(screen.getByText(/Trilha conclu/i)).toBeInTheDocument();
   });
});
