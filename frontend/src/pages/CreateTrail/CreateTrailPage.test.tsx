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

const QUESTION_SET = {
   topic: 'FastAPI',
   questions: [
      {
         id: 'q1',
         question: 'Você já usou FastAPI?',
         rationale: 'familiaridade',
         options: [
            { id: 'a', label: 'Nunca usei FastAPI' },
            { id: 'b', label: 'Uso em produção' },
         ],
      },
   ],
};

const TRAIL_RESPONSE = {
   id: 42,
   topic: 'FastAPI',
   title: 'Plataforma de FastAPI',
   summary: 'resumo',
   completed_at: null,
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
};

function fetchMock(handlers: {
   assessment?: () => Promise<Response> | Response;
   create?: (body: unknown) => Promise<Response> | Response;
}): typeof fetch {
   return vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
         const url = typeof input === 'string' ? input : input.toString();
         if (url.endsWith('/learning-trails/assessment')) {
            const fn = handlers.assessment;
            if (!fn) throw new Error('assessment handler missing');
            return fn();
         }
         if (url.endsWith('/learning-trails')) {
            const fn = handlers.create;
            if (!fn) throw new Error('create handler missing');
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;
            return fn(body);
         }
         throw new Error(`URL inesperada no teste: ${url}`);
      }) as unknown as typeof fetch;
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

   it('abre o modal de diagnóstico ao continuar e gera a trilha com as respostas', async () => {
      const createSpy = vi.fn(() => jsonResponse(TRAIL_RESPONSE, 201));
      globalThis.fetch = fetchMock({
         assessment: () => jsonResponse(QUESTION_SET),
         create: createSpy,
      });

      renderPage();
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Tema'), 'FastAPI');
      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      await waitFor(() =>
         expect(screen.getByText('Você já usou FastAPI?')).toBeInTheDocument(),
      );

      await user.click(screen.getByLabelText('Nunca usei FastAPI'));
      await user.click(screen.getByRole('button', { name: 'Gerar trilha' }));

      await waitFor(() => expect(screen.getByText('detalhe ok')).toBeInTheDocument());

      expect(createSpy).toHaveBeenCalledTimes(1);
      const calls = createSpy.mock.calls as unknown as Array<
         [{ topic: string; assessment: Array<{ question_id: string; question: string; answer: string }> }]
      >;
      const body = calls[0][0];
      expect(body.topic).toBe('FastAPI');
      expect(body.assessment).toEqual([
         {
            question_id: 'q1',
            question: 'Você já usou FastAPI?',
            answer: 'Nunca usei FastAPI',
         },
      ]);
   });

   it('rejeita tema muito curto antes de enviar', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      renderPage();
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Tema'), 'a');
      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      expect(screen.getByText(/pelo menos 3 caracteres/)).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
   });

   it('preenche o campo ao clicar em uma sugestão', async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByText('Microsserviços em Go'));
      expect(screen.getByLabelText('Tema')).toHaveValue('Microsserviços em Go');
   });

   it('gera a trilha sem assessment quando a IA retorna lista vazia', async () => {
      const createSpy = vi.fn(() => jsonResponse(TRAIL_RESPONSE, 201));
      globalThis.fetch = fetchMock({
         assessment: () => jsonResponse({ topic: 'FastAPI', questions: [] }),
         create: createSpy,
      });

      renderPage();
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Tema'), 'FastAPI');
      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      await waitFor(() => expect(screen.getByText('detalhe ok')).toBeInTheDocument());
      expect(createSpy).toHaveBeenCalledTimes(1);
      const calls = createSpy.mock.calls as unknown as Array<[{ assessment: unknown[] }]>;
      expect(calls[0][0].assessment).toEqual([]);
   });
});
