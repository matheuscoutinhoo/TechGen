import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CreateTrailPage } from './CreateTrailPage';
import { tokenStorage } from '../../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

function renderPage() {
   return render(
      <MemoryRouter initialEntries={['/trails/new']}>
         <Routes>
            <Route path="/trails/new" element={<CreateTrailPage />} />
            <Route path="/trails/:id" element={<div>detalhe ok</div>} />
         </Routes>
      </MemoryRouter>,
   );
}

describe('<CreateTrailPage />', () => {
   beforeEach(() => {
      tokenStorage.set('jwt');
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
      tokenStorage.clear();
   });

   it('submete tema e navega para detalhe da trilha criada', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse(
            {
               id: 42,
               topic: 'FastAPI',
               title: 'Plataforma de FastAPI',
               summary: 'resumo',
               created_at: '2025-01-01T00:00:00Z',
               updated_at: '2025-01-01T00:00:00Z',
               content: {
                  project_title: 'Plataforma de FastAPI',
                  project_summary: 'resumo',
                  why_realistic: 'real',
                  target_audience: 'devs',
                  prerequisites: [],
                  tickets: [],
               },
            },
            201,
         ),
      ) as unknown as typeof fetch;

      renderPage();
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Tema'), 'FastAPI');
      await user.click(screen.getByRole('button', { name: 'Gerar trilha' }));

      await waitFor(() => expect(screen.getByText('detalhe ok')).toBeInTheDocument());
   });

   it('rejeita tema muito curto antes de enviar', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      renderPage();
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Tema'), 'a');
      await user.click(screen.getByRole('button', { name: 'Gerar trilha' }));

      expect(screen.getByText(/pelo menos 3 caracteres/)).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
   });

   it('preenche o campo ao clicar em uma sugestão', async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByText('Microsserviços em Go'));
      expect(screen.getByLabelText('Tema')).toHaveValue('Microsserviços em Go');
   });
});
