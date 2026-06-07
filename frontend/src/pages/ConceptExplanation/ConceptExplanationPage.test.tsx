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
   tips: ['Comece simples', 'Refatore depois', 'Escreva teste antes'],
   pitfalls: ['Acoplar a HTTP', 'Esquecer testes'],
   further_reading: ['DDD', 'Hexagonal'],
};

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
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse(EXPLANATION),
      ) as unknown as typeof fetch;

      renderPage();
      await waitFor(() =>
         expect(screen.getByRole('heading', { level: 1, name: 'Repository' })).toBeInTheDocument(),
      );

      // labels das seções na ordem
      const labels = screen.getAllByText(
         /O que é|Por que isso importa|Como funciona|Exemplos|Como aplicar|O que evitar|Para ir além/,
      );
      const labelTexts = labels.map((el) => el.textContent ?? '');
      const firstIdx = (text: string) => labelTexts.findIndex((t) => t.includes(text));

      expect(firstIdx('O que é')).toBeLessThan(firstIdx('Por que isso importa'));
      expect(firstIdx('Por que isso importa')).toBeLessThan(firstIdx('Como funciona'));
      expect(firstIdx('Como funciona')).toBeLessThan(firstIdx('Exemplos'));
      expect(firstIdx('Exemplos')).toBeLessThan(firstIdx('Como aplicar'));
      expect(firstIdx('Como aplicar')).toBeLessThan(firstIdx('O que evitar'));
      expect(firstIdx('O que evitar')).toBeLessThan(firstIdx('Para ir além'));
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
