import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssessmentModal } from './AssessmentModal';
import type { TopicQuestion } from '../../../types/api';

const QUESTIONS: TopicQuestion[] = [
   {
      id: 'q1',
      question: 'Você já usou FastAPI?',
      rationale: 'Mede familiaridade direta.',
      options: [
         { id: 'a', label: 'Nunca usei' },
         { id: 'b', label: 'Já fiz um hello world' },
         { id: 'c', label: 'Uso em produção' },
      ],
   },
   {
      id: 'q2',
      question: 'Você escreve testes automatizados?',
      rationale: 'Calibra cobertura de TDD.',
      options: [
         { id: 'a', label: 'Nunca' },
         { id: 'b', label: 'Às vezes' },
         { id: 'c', label: 'Sempre' },
      ],
   },
];

describe('<AssessmentModal />', () => {
   afterEach(() => {
      vi.restoreAllMocks();
   });

   it('renderiza apenas a primeira pergunta inicialmente', () => {
      render(
         <AssessmentModal
            topic="FastAPI"
            questions={QUESTIONS}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
         />,
      );

      expect(screen.getByText('Você já usou FastAPI?')).toBeInTheDocument();
      expect(screen.queryByText('Você escreve testes automatizados?')).not.toBeInTheDocument();
      expect(screen.getByText('Pergunta 1 de 2')).toBeInTheDocument();
   });

   it('bloqueia o botão Próxima até que uma alternativa seja escolhida', async () => {
      const user = userEvent.setup();
      render(
         <AssessmentModal
            topic="FastAPI"
            questions={QUESTIONS}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
         />,
      );

      const nextButton = screen.getByRole('button', { name: 'Próxima' });
      expect(nextButton).toBeDisabled();

      await user.click(screen.getByLabelText('Nunca usei'));
      expect(nextButton).toBeEnabled();
   });

   it('avança para a próxima pergunta e mostra apenas ela', async () => {
      const user = userEvent.setup();
      render(
         <AssessmentModal
            topic="FastAPI"
            questions={QUESTIONS}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
         />,
      );

      await user.click(screen.getByLabelText('Nunca usei'));
      await user.click(screen.getByRole('button', { name: 'Próxima' }));

      await waitFor(
         () =>
            expect(
               screen.getByText('Você escreve testes automatizados?'),
            ).toBeInTheDocument(),
         { timeout: 800 },
      );
      expect(screen.queryByText('Você já usou FastAPI?')).not.toBeInTheDocument();
      expect(screen.getByText('Pergunta 2 de 2')).toBeInTheDocument();
   });

   it('submete as respostas no formato esperado ao final', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(
         <AssessmentModal
            topic="FastAPI"
            questions={QUESTIONS}
            onSubmit={onSubmit}
            onCancel={vi.fn()}
         />,
      );

      await user.click(screen.getByLabelText('Nunca usei'));
      await user.click(screen.getByRole('button', { name: 'Próxima' }));

      await waitFor(() => screen.getByLabelText('Sempre'), { timeout: 800 });
      await user.click(screen.getByLabelText('Sempre'));
      await user.click(screen.getByRole('button', { name: 'Gerar trilha' }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith([
         {
            question_id: 'q1',
            question: 'Você já usou FastAPI?',
            answer: 'Nunca usei',
         },
         {
            question_id: 'q2',
            question: 'Você escreve testes automatizados?',
            answer: 'Sempre',
         },
      ]);
   });

   it('pular avança sem registrar resposta no payload final', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(
         <AssessmentModal
            topic="FastAPI"
            questions={QUESTIONS}
            onSubmit={onSubmit}
            onCancel={vi.fn()}
         />,
      );

      await user.click(screen.getByRole('button', { name: 'Pular pergunta' }));
      await waitFor(() => screen.getByLabelText('Sempre'), { timeout: 800 });
      await user.click(screen.getByLabelText('Sempre'));
      await user.click(screen.getByRole('button', { name: 'Gerar trilha' }));

      // Pular marca um valor sentinela "__skip__" que não casa com nenhuma option,
      // então a entrada vira "Prefiro não responder" no payload.
      const payload = onSubmit.mock.calls[0][0];
      expect(payload).toHaveLength(2);
      expect(payload[0].answer).toBe('Prefiro não responder');
   });

   it('cancela ao pressionar Esc', async () => {
      const onCancel = vi.fn();
      render(
         <AssessmentModal
            topic="FastAPI"
            questions={QUESTIONS}
            onSubmit={vi.fn()}
            onCancel={onCancel}
         />,
      );

      await userEvent.keyboard('{Escape}');
      expect(onCancel).toHaveBeenCalledTimes(1);
   });
});
