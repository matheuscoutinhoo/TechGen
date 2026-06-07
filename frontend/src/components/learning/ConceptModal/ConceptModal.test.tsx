import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConceptModal } from './ConceptModal';
import { tokenStorage } from '../../../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

const EXPLANATION = {
   concept: 'Repository',
   definition: 'Definição em profundidade do conceito.',
   why_it_matters: 'Importa porque desacopla camadas.',
   patterns: ['Padrão A', 'Padrão B'],
   pitfalls: ['Armadilha 1'],
   tips: ['Dica 1', 'Dica 2'],
   examples: [
      { title: 'Exemplo X', description: 'Descrição do exemplo.', code: 'pass' },
   ],
   further_reading: ['DDD'],
};

describe('<ConceptModal />', () => {
   beforeEach(() => {
      tokenStorage.set('jwt');
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
   });

   it('mostra spinner e depois a explicação', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(EXPLANATION)) as unknown as typeof fetch;

      render(
         <ConceptModal
            trailId={1}
            ticketCode="TG-1"
            concept="Repository"
            onClose={vi.fn()}
         />,
      );

      expect(screen.getByRole('status')).toHaveTextContent(/Gerando explicação/i);
      await waitFor(() =>
         expect(screen.getByText('Definição em profundidade do conceito.')).toBeInTheDocument(),
      );
      expect(screen.getByText('Padrão A')).toBeInTheDocument();
      expect(screen.getByText('Exemplo X')).toBeInTheDocument();
   });

   it('dispara onClose ao clicar no botão fechar', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(EXPLANATION)) as unknown as typeof fetch;
      const onClose = vi.fn();
      render(
         <ConceptModal trailId={1} ticketCode="TG-1" concept="X" onClose={onClose} />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Fechar' }));
      expect(onClose).toHaveBeenCalled();
   });

   it('mostra erro quando API falha', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse({ error: { code: 'AI_PROVIDER_ERROR', message: 'A IA falhou.' } }, 502),
      ) as unknown as typeof fetch;

      render(
         <ConceptModal trailId={1} ticketCode="TG-1" concept="X" onClose={vi.fn()} />,
      );

      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
      expect(screen.getByText('A IA falhou.')).toBeInTheDocument();
   });
});
