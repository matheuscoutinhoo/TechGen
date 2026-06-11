import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

const Q1 = {
   id: 'q1',
   question: 'Você já trabalhou com FastAPI antes?',
   rationale: 'familiaridade',
   options: [
      { id: 'a', label: 'Nunca usei FastAPI' },
      { id: 'b', label: 'Uso em produção' },
   ],
};

const Q2 = {
   id: 'q2',
   question: 'Você se sente confortável com Python?',
   rationale: 'pré-requisito',
   options: [
      { id: 'a', label: 'Não' },
      { id: 'b', label: 'Sim' },
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

interface NextHandler {
   (body: { topic: string; previous_answers: unknown[] }): Response | Promise<Response>;
}

function fetchMock(handlers: {
   next: NextHandler;
   create: (body: unknown) => Response | Promise<Response>;
}): typeof fetch {
   return vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
         const url = typeof input === 'string' ? input : input.toString();
         const body = init?.body ? JSON.parse(String(init.body)) : undefined;
         if (url.endsWith('/learning-trails/assessment/next')) {
            return handlers.next(body);
         }
         if (url.endsWith('/learning-trails')) {
            return handlers.create(body);
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

   it('faz chamadas adaptativas ao endpoint /assessment/next e gera a trilha', async () => {
      const nextSpy = vi
         .fn<(body: { topic: string; previous_answers: unknown[] }) => Response>()
         .mockImplementationOnce(() => jsonResponse({ question: Q1, done: false }))
         .mockImplementationOnce(() => jsonResponse({ question: Q2, done: false }))
         .mockImplementationOnce(() => jsonResponse({ question: null, done: true }));
      const createSpy = vi.fn(() => jsonResponse(TRAIL_RESPONSE, 201));
      globalThis.fetch = fetchMock({
         next: (body) => nextSpy(body),
         create: createSpy,
      });

      renderPage();
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Tema'), 'FastAPI');
      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      // Modal abre com Q1.
      await waitFor(() =>
         expect(screen.getByText('Você já trabalhou com FastAPI antes?')).toBeInTheDocument(),
      );

      const dialog = screen.getByRole('dialog');

      // Responde Q1 → busca Q2 (com histórico).
      await user.click(within(dialog).getByLabelText('Nunca usei FastAPI'));
      await user.click(within(dialog).getByRole('button', { name: 'Continuar' }));
      await waitFor(() =>
         expect(screen.getByText('Você se sente confortável com Python?')).toBeInTheDocument(),
      );

      // Responde Q2 → o Mentor encerra → gera trilha.
      await user.click(within(dialog).getByLabelText('Não'));
      await user.click(within(dialog).getByRole('button', { name: 'Continuar' }));

      await waitFor(() => expect(screen.getByText('detalhe ok')).toBeInTheDocument());

      // 3 chamadas a /assessment/next, com histórico crescente:
      expect(nextSpy).toHaveBeenCalledTimes(3);
      expect(nextSpy.mock.calls[0][0].previous_answers).toEqual([]);
      expect(nextSpy.mock.calls[1][0].previous_answers).toEqual([
         {
            question_id: 'q1',
            question: 'Você já trabalhou com FastAPI antes?',
            answer: 'Nunca usei FastAPI',
         },
      ]);
      expect(nextSpy.mock.calls[2][0].previous_answers).toHaveLength(2);

      // E o create carrega as duas respostas.
      const createCalls = createSpy.mock.calls as unknown as Array<
         [{ topic: string; assessment: Array<{ question_id: string; answer: string }> }]
      >;
      const createBody = createCalls[0][0];
      expect(createBody.assessment).toHaveLength(2);
      expect(createBody.assessment[0].answer).toBe('Nunca usei FastAPI');
      expect(createBody.assessment[1].answer).toBe('Não');
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

   it('gera a trilha direto quando o Mentor retorna done=true na primeira chamada', async () => {
      const nextSpy = vi.fn(() => jsonResponse({ question: null, done: true }));
      const createSpy = vi.fn(() => jsonResponse(TRAIL_RESPONSE, 201));
      globalThis.fetch = fetchMock({
         next: () => nextSpy(),
         create: createSpy,
      });

      renderPage();
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Tema'), 'FastAPI');
      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      await waitFor(() => expect(screen.getByText('detalhe ok')).toBeInTheDocument());

      const calls = createSpy.mock.calls as unknown as Array<[{ assessment: unknown[] }]>;
      expect(calls[0][0].assessment).toEqual([]);
   });
});


// ====================================================================== //
// Modo PROJECT — aluno descreve escopo + tecnologias
// ====================================================================== //
const PROJECT_Q1 = {
   id: 'q1',
   question: 'Você já trabalhou com FastAPI antes?',
   rationale: 'familiaridade com a stack principal',
   options: [
      { id: 'a', label: 'Nunca usei FastAPI' },
      { id: 'b', label: 'Uso em produção' },
   ],
};

const PROJECT_SCOPE_TEXT =
   'Plataforma web onde pessoas cadastram livros usados para doação. Tem login, busca por título/autor e dashboard.';

interface ProjectHandlers {
   nextProject: (body: {
      project_scope: string;
      technologies: string[];
      previous_answers: unknown[];
   }) => Response | Promise<Response>;
   create: (body: unknown) => Response | Promise<Response>;
}

function projectFetchMock(handlers: ProjectHandlers): typeof fetch {
   return vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
         const url = typeof input === 'string' ? input : input.toString();
         const body = init?.body ? JSON.parse(String(init.body)) : undefined;
         if (url.endsWith('/learning-trails/assessment/project/next')) {
            return handlers.nextProject(body);
         }
         if (url.endsWith('/learning-trails')) {
            return handlers.create(body);
         }
         throw new Error(`URL inesperada no teste: ${url}`);
      }) as unknown as typeof fetch;
}

describe('<CreateTrailPage /> — modo PROJECT', () => {
   beforeEach(() => {
      tokenStorage.set('jwt');
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
      tokenStorage.clear();
   });

   it('mostra o toggle de modo e troca para o form de projeto', async () => {
      renderPage();
      const user = userEvent.setup();

      // Modo TOPIC ativo por default.
      expect(screen.getByLabelText('Tema')).toBeInTheDocument();
      expect(screen.queryByLabelText('Escopo do projeto')).not.toBeInTheDocument();

      // Troca para PROJECT.
      await user.click(screen.getByRole('button', { name: /por projeto/i }));

      expect(screen.queryByLabelText('Tema')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Escopo do projeto')).toBeInTheDocument();
      expect(
         screen.getByLabelText('Tecnologias que quer aprender'),
      ).toBeInTheDocument();
   });

   it('valida escopo curto e ausência de tecnologias antes de enviar', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /por projeto/i }));

      // Escopo curto + sem tech → bloqueia com mensagem de escopo.
      await user.type(screen.getByLabelText('Escopo do projeto'), 'curto');
      await user.click(screen.getByRole('button', { name: 'Continuar' }));
      expect(screen.getByText(/escopo do projeto com pelo menos 20/i)).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();

      // Escopo OK mas sem tecnologias → bloqueia com mensagem de tech.
      await user.clear(screen.getByLabelText('Escopo do projeto'));
      await user.type(
         screen.getByLabelText('Escopo do projeto'),
         PROJECT_SCOPE_TEXT,
      );
      await user.click(screen.getByRole('button', { name: 'Continuar' }));
      expect(
         screen.getByText(/pelo menos uma tecnologia/i),
      ).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
   });

   it('adiciona tecnologias via Enter e via clique em sugestão; remove via X', async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /por projeto/i }));

      // Via Enter no input.
      const techInput = screen.getByLabelText('Tecnologias que quer aprender');
      await user.type(techInput, 'FastAPI');
      await user.keyboard('{Enter}');

      // Via clique em sugestão.
      await user.click(screen.getByText('+ React'));

      const selected = screen.getByLabelText('Tecnologias selecionadas');
      expect(within(selected).getByText('FastAPI')).toBeInTheDocument();
      expect(within(selected).getByText('React')).toBeInTheDocument();

      // Duplicata é ignorada.
      await user.type(techInput, 'fastapi');
      await user.keyboard('{Enter}');
      expect(
         within(selected).getAllByText(/fastapi/i),
      ).toHaveLength(1);

      // Remove via X.
      await user.click(
         within(selected).getByRole('button', { name: /remover fastapi/i }),
      );
      expect(within(selected).queryByText('FastAPI')).not.toBeInTheDocument();
   });

   it('faz o fluxo completo de projeto: scope+tech → assessment → cria', async () => {
      const nextSpy = vi
         .fn<
            (body: {
               project_scope: string;
               technologies: string[];
               previous_answers: unknown[];
            }) => Response
         >()
         .mockImplementationOnce(() => jsonResponse({ question: PROJECT_Q1, done: false }))
         .mockImplementationOnce(() => jsonResponse({ question: null, done: true }));
      const createSpy = vi.fn(() => jsonResponse(TRAIL_RESPONSE, 201));
      globalThis.fetch = projectFetchMock({
         nextProject: (body) => nextSpy(body),
         create: createSpy,
      });

      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /por projeto/i }));

      await user.type(
         screen.getByLabelText('Escopo do projeto'),
         PROJECT_SCOPE_TEXT,
      );
      await user.type(
         screen.getByLabelText('Tecnologias que quer aprender'),
         'FastAPI',
      );
      await user.keyboard('{Enter}');
      await user.type(
         screen.getByLabelText('Tecnologias que quer aprender'),
         'React',
      );
      await user.keyboard('{Enter}');

      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      // Modal abre com Q1 (do endpoint de projeto).
      await waitFor(() =>
         expect(
            screen.getByText('Você já trabalhou com FastAPI antes?'),
         ).toBeInTheDocument(),
      );

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByLabelText('Nunca usei FastAPI'));
      await user.click(within(dialog).getByRole('button', { name: 'Continuar' }));

      await waitFor(() =>
         expect(screen.getByText('detalhe ok')).toBeInTheDocument(),
      );

      // Primeira chamada: scope + technologies + histórico vazio.
      expect(nextSpy).toHaveBeenCalledTimes(2);
      expect(nextSpy.mock.calls[0][0].project_scope).toBe(PROJECT_SCOPE_TEXT);
      expect(nextSpy.mock.calls[0][0].technologies).toEqual(['FastAPI', 'React']);
      expect(nextSpy.mock.calls[0][0].previous_answers).toEqual([]);

      // Segunda chamada: agora com 1 resposta no histórico.
      expect(nextSpy.mock.calls[1][0].previous_answers).toEqual([
         {
            question_id: 'q1',
            question: 'Você já trabalhou com FastAPI antes?',
            answer: 'Nunca usei FastAPI',
         },
      ]);

      // Create: modo project + scope + tech + assessment com a única resposta.
      const createCalls = createSpy.mock.calls as unknown as Array<
         [
            {
               mode: string;
               project_scope: string;
               technologies: string[];
               assessment: Array<{ answer: string }>;
            },
         ]
      >;
      const createBody = createCalls[0][0];
      expect(createBody.mode).toBe('project');
      expect(createBody.project_scope).toBe(PROJECT_SCOPE_TEXT);
      expect(createBody.technologies).toEqual(['FastAPI', 'React']);
      expect(createBody.assessment).toHaveLength(1);
      expect(createBody.assessment[0].answer).toBe('Nunca usei FastAPI');
   });
});

