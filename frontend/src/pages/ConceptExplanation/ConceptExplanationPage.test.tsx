import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConceptExplanationPage } from './ConceptExplanationPage';
import { tokenStorage } from '../../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

const EXPLANATION = {
   concept: 'Repository',
   definition: 'É uma **camada** que isola o ==banco== do resto.',
   why_it_matters: 'Sem essa camada, `service` e SQL viram um nó só.',
   patterns: ['Padrão A com **estrutura clara**.', 'Padrão B'],
   examples: [
      {
         title: 'Catálogo de livros',
         description: 'Imagine uma `biblioteca` em vez do seu projeto.',
         code: 'def books(): pass',
      },
      {
         title: 'Pedido de cafeteria',
         description: 'Outro domínio análogo.',
         code: null,
      },
   ],
   hands_on_steps: [
      'Crie um arquivo `repo.py`',
      'Defina a interface',
      'Implemente o método mais simples',
   ],
   tips: ['Comece simples', 'Refatore depois', 'Escreva teste antes'],
   pitfalls: ['Acoplar a HTTP', 'Esquecer testes'],
   further_reading: ['DDD', 'Hexagonal'],
   glossary: [
      { term: 'ORM', brief: 'Mapeamento objeto-relacional.' },
   ],
};

// Trilha com o ticket TG-1 e seus concepts em ordem pedagógica. "Repository"
// (o conceito aberto) é seguido por "Migrations" e "Transações".
const TRAIL = {
   id: 1,
   topic: 'Backend',
   title: 'Trilha',
   summary: 'resumo',
   completed_at: null,
   created_at: '2025-01-01T00:00:00Z',
   updated_at: '2025-01-01T00:00:00Z',
   content: {
      project_title: 'Trilha',
      project_summary: 'resumo',
      why_realistic: 'real',
      target_audience: 'devs',
      prerequisites: [],
      tickets: [
         {
            code: 'TG-1',
            title: 'Persistência',
            objective: 'obj',
            concepts: ['Tipagem', 'Repository', 'Migrations', 'Transações'],
            tasks: [],
            acceptance_criteria: [],
         },
      ],
   },
};

/** Mock que responde tanto o endpoint de conceito quanto o da trilha. */
function fetchMock(): typeof fetch {
   return vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/concepts/')) return jsonResponse(EXPLANATION);
      if (/\/learning-trails\/\d+(\?|$)/.test(url)) return jsonResponse(TRAIL);
      throw new Error(`URL inesperada no teste: ${url}`);
   }) as unknown as typeof fetch;
}

function renderPage(initialPath = '/trails/1/tickets/TG-1/concepts/Repository') {
   return render(
      <MemoryRouter initialEntries={[initialPath]}>
         <Routes>
            <Route
               path="/trails/:id/tickets/:code/concepts/:concept"
               element={<ConceptExplanationPage />}
            />
         </Routes>
      </MemoryRouter>,
   );
}

describe('<ConceptExplanationPage />', () => {
   beforeEach(() => {
      tokenStorage.set('jwt');
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
      tokenStorage.clear();
   });

   it('renderiza todas as seções na ordem pedagógica', async () => {
      globalThis.fetch = fetchMock();

      renderPage();
      await waitFor(() =>
         expect(screen.getByRole('heading', { level: 1, name: 'Repository' })).toBeInTheDocument(),
      );

      // labels das seções na ordem
      const labels = screen.getAllByText(
         /O que é|Por que isso importa|Como funciona|Exemplos|Passo a passo|Como aplicar|O que evitar|Continue estudando/,
      );
      const labelTexts = labels.map((el) => el.textContent ?? '');
      const firstIdx = (text: string) => labelTexts.findIndex((t) => t.includes(text));

      expect(firstIdx('O que é')).toBeLessThan(firstIdx('Por que isso importa'));
      expect(firstIdx('Por que isso importa')).toBeLessThan(firstIdx('Como funciona'));
      expect(firstIdx('Como funciona')).toBeLessThan(firstIdx('Exemplos'));
      expect(firstIdx('Exemplos')).toBeLessThan(firstIdx('Passo a passo'));
      expect(firstIdx('Passo a passo')).toBeLessThan(firstIdx('Como aplicar'));
      expect(firstIdx('Como aplicar')).toBeLessThan(firstIdx('O que evitar'));
      expect(firstIdx('O que evitar')).toBeLessThan(firstIdx('Continue estudando'));
   });

   it('lista os próximos conceitos do ticket como links de navegação', async () => {
      globalThis.fetch = fetchMock();

      renderPage();
      await waitFor(() =>
         expect(
            screen.getByRole('heading', { name: 'Próximos conceitos deste ticket' }),
         ).toBeInTheDocument(),
      );

      // "Repository" é o conceito atual; os próximos do TG-1 são Migrations e
      // Transações (Tipagem vem ANTES, então não aparece).
      const migrations = screen.getByRole('link', { name: 'Migrations' });
      const transacoes = screen.getByRole('link', { name: 'Transações' });
      expect(migrations).toHaveAttribute(
         'href',
         '/trails/1/tickets/TG-1/concepts/Migrations',
      );
      expect(transacoes).toHaveAttribute(
         'href',
         '/trails/1/tickets/TG-1/concepts/Transa%C3%A7%C3%B5es',
      );
      expect(
         screen.queryByRole('link', { name: 'Tipagem' }),
      ).not.toBeInTheDocument();
   });

   it('renderiza os passos numerados do hands_on_steps', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse(EXPLANATION),
      ) as unknown as typeof fetch;
      renderPage();
      await waitFor(() =>
         expect(screen.getByText(/Crie um arquivo/)).toBeInTheDocument(),
      );
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
   });

   it('renderiza markdown leve nos campos', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse(EXPLANATION),
      ) as unknown as typeof fetch;

      renderPage();
      await waitFor(() =>
         expect(screen.getByText('camada').tagName).toBe('STRONG'),
      );
      expect(screen.getByText('banco').tagName).toBe('MARK');
      expect(screen.getAllByText('service')[0].tagName).toBe('CODE');
   });

   it('botão Atualizar chama API com refresh=true', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
         jsonResponse(EXPLANATION),
      );
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      renderPage();
      await waitFor(() => expect(screen.getByText('Atualizar')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Atualizar/ }));

      const lastCallUrl = fetchSpy.mock.calls.at(-1)?.[0] as string;
      expect(lastCallUrl).toContain('refresh=true');
   });

   it('mostra erro quando API falha', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse({ error: { code: 'NOT_FOUND', message: 'Não existe.' } }, 404),
      ) as unknown as typeof fetch;

      renderPage();
      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
      expect(screen.getByText('Não existe.')).toBeInTheDocument();
   });
});
