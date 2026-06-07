import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EditTrailPage } from './EditTrailPage';
import { tokenStorage } from '../../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

const TRAIL = {
   id: 9,
   topic: 'FastAPI',
   title: 'Plataforma FastAPI',
   summary: 'Resumo grande o suficiente para passar na validação.',
   created_at: '2025-01-01T00:00:00Z',
   updated_at: '2025-01-02T00:00:00Z',
   content: {
      project_title: 'Plataforma FastAPI',
      project_summary: 'Resumo grande o suficiente para passar na validação.',
      why_realistic: 'Real.',
      target_audience: 'Devs.',
      prerequisites: [],
      tickets: [],
   },
};

function renderEdit() {
   return render(
      <MemoryRouter initialEntries={['/trails/9/edit']}>
         <Routes>
            <Route path="/trails/:id/edit" element={<EditTrailPage />} />
            <Route path="/trails/:id" element={<div>detalhe ok</div>} />
         </Routes>
      </MemoryRouter>,
   );
}

describe('<EditTrailPage />', () => {
   beforeEach(() => {
      tokenStorage.set('jwt');
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
      tokenStorage.clear();
   });

   it('carrega trilha, edita e salva voltando para o detalhe', async () => {
      let patched = false;
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
         if (init?.method === 'PATCH') {
            patched = true;
            return Promise.resolve(jsonResponse({ ...TRAIL, title: 'Novo título' }));
         }
         return Promise.resolve(jsonResponse(TRAIL));
      }) as unknown as typeof fetch;

      renderEdit();
      await waitFor(() => expect(screen.getByLabelText('Título')).toHaveValue('Plataforma FastAPI'));

      const user = userEvent.setup();
      const titleInput = screen.getByLabelText('Título');
      await user.clear(titleInput);
      await user.type(titleInput, 'Novo título');
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

      await waitFor(() => expect(screen.getByText('detalhe ok')).toBeInTheDocument());
      expect(patched).toBe(true);
   });

   it('mostra erro quando trilha não existe', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse({ error: { code: 'NOT_FOUND', message: 'Trilha não encontrada' } }, 404),
      ) as unknown as typeof fetch;

      renderEdit();
      await waitFor(() => expect(screen.getByText('Trilha não encontrada')).toBeInTheDocument());
   });
});
