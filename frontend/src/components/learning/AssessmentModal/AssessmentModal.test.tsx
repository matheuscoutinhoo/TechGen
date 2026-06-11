import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssessmentModal } from './AssessmentModal';
import type {
   TopicAnswer,
   TopicNextQuestionResponse,
   TopicQuestion,
} from '../../../types/api';

const Q1: TopicQuestion = {
   id: 'q1',
   question: 'Você já usou FastAPI?',
   rationale: 'Mede familiaridade direta.',
   options: [
      { id: 'a', label: 'Nunca usei' },
      { id: 'b', label: 'Já fiz um hello world' },
      { id: 'c', label: 'Uso em produção' },
   ],
};

const Q2_LOW: TopicQuestion = {
   id: 'q2',
   question: 'Você se sente confortável com Python?',
   rationale: 'Sondar pré-requisito.',
   options: [
      { id: 'a', label: 'Não' },
      { id: 'b', label: 'Mais ou menos' },
      { id: 'c', label: 'Sim' },
   ],
};

const Q2_HIGH: TopicQuestion = {
   id: 'q2',
   question: 'Quais trade-offs você costuma pensar?',
   rationale: 'Calibra nível avançado.',
   options: [
      { id: 'a', label: 'Sigo o padrão da equipe' },
      { id: 'b', label: 'Penso em performance' },
      { id: 'c', label: 'Avalio acoplamento e custo' },
   ],
};

describe('<AssessmentModal />', () => {
   afterEach(() => {
      vi.restoreAllMocks();
   });

   it('renderiza apenas a primeira pergunta inicialmente', () => {
      render(
         <AssessmentModal
            topic="FastAPI"
            firstQuestion={Q1}
            loadNextQuestion={vi.fn()}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
         />,
      );

      expect(screen.getByText('Você já usou FastAPI?')).toBeInTheDocument();
      expect(screen.getByText('Pergunta 1')).toBeInTheDocument();
   });

   it('bloqueia o botão Continuar até que uma alternativa seja escolhida', async () => {
      const user = userEvent.setup();
      render(
         <AssessmentModal
            topic="FastAPI"
            firstQuestion={Q1}
            loadNextQuestion={vi.fn()}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
         />,
      );

      const button = screen.getByRole('button', { name: 'Continuar' });
      expect(button).toBeDisabled();
      await user.click(screen.getByLabelText('Nunca usei'));
      expect(button).toBeEnabled();
   });

   it('passa o histórico para loadNextQuestion e mostra a próxima', async () => {
      const user = userEvent.setup();
      const loadNextQuestion = vi
         .fn<(prev: TopicAnswer[]) => Promise<TopicNextQuestionResponse>>()
         .mockResolvedValueOnce({ question: Q2_LOW, done: false });

      render(
         <AssessmentModal
            topic="FastAPI"
            firstQuestion={Q1}
            loadNextQuestion={loadNextQuestion}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
         />,
      );

      await user.click(screen.getByLabelText('Nunca usei'));
      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      await waitFor(() => screen.getByText('Você se sente confortável com Python?'), {
         timeout: 1500,
      });

      expect(loadNextQuestion).toHaveBeenCalledTimes(1);
      const history = loadNextQuestion.mock.calls[0][0];
      expect(history).toEqual([
         {
            question_id: 'q1',
            question: 'Você já usou FastAPI?',
            answer: 'Nunca usei',
         },
      ]);
      // a primeira pergunta saiu do palco
      expect(screen.queryByText('Você já usou FastAPI?')).not.toBeInTheDocument();
   });

   it('caminhos opostos exercitam o adaptativo (resposta diferente → pergunta diferente)', async () => {
      // Caminho 1: aluno marca "Nunca usei" → modal pede próxima com história "Nunca usei"
      const user1 = userEvent.setup();
      const lowCallback = vi
         .fn<(prev: TopicAnswer[]) => Promise<TopicNextQuestionResponse>>()
         .mockResolvedValue({ question: Q2_LOW, done: false });
      const { unmount } = render(
         <AssessmentModal
            topic="FastAPI"
            firstQuestion={Q1}
            loadNextQuestion={lowCallback}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
         />,
      );
      await user1.click(screen.getByLabelText('Nunca usei'));
      await user1.click(screen.getByRole('button', { name: 'Continuar' }));
      await waitFor(() => screen.getByText(/confortável com Python/i), {
         timeout: 1500,
      });
      expect(lowCallback.mock.calls[0][0][0].answer).toBe('Nunca usei');
      unmount();

      // Caminho 2: aluno marca "Uso em produção" → callback recebe "Uso em produção"
      const user2 = userEvent.setup();
      const highCallback = vi
         .fn<(prev: TopicAnswer[]) => Promise<TopicNextQuestionResponse>>()
         .mockResolvedValue({ question: Q2_HIGH, done: false });
      render(
         <AssessmentModal
            topic="FastAPI"
            firstQuestion={Q1}
            loadNextQuestion={highCallback}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
         />,
      );
      await user2.click(screen.getByLabelText('Uso em produção'));
      await user2.click(screen.getByRole('button', { name: 'Continuar' }));
      await waitFor(() => screen.getByText(/trade-offs/i), { timeout: 1500 });
      expect(highCallback.mock.calls[0][0][0].answer).toBe('Uso em produção');
   });

   it('finaliza com onSubmit quando o Mentor devolve done=true', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const loadNextQuestion = vi
         .fn<(prev: TopicAnswer[]) => Promise<TopicNextQuestionResponse>>()
         .mockResolvedValueOnce({ question: null, done: true });

      render(
         <AssessmentModal
            topic="FastAPI"
            firstQuestion={Q1}
            loadNextQuestion={loadNextQuestion}
            onSubmit={onSubmit}
            onCancel={vi.fn()}
         />,
      );

      await user.click(screen.getByLabelText('Uso em produção'));
      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), {
         timeout: 1500,
      });
      expect(onSubmit).toHaveBeenCalledWith([
         {
            question_id: 'q1',
            question: 'Você já usou FastAPI?',
            answer: 'Uso em produção',
         },
      ]);
   });

   it('pular registra "Prefiro não responder" e pede a próxima', async () => {
      const user = userEvent.setup();
      const loadNextQuestion = vi
         .fn<(prev: TopicAnswer[]) => Promise<TopicNextQuestionResponse>>()
         .mockResolvedValueOnce({ question: Q2_LOW, done: false });

      render(
         <AssessmentModal
            topic="FastAPI"
            firstQuestion={Q1}
            loadNextQuestion={loadNextQuestion}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
         />,
      );

      await user.click(screen.getByRole('button', { name: 'Pular pergunta' }));
      await waitFor(() => screen.getByText(/confortável com Python/i), {
         timeout: 1500,
      });

      const history = loadNextQuestion.mock.calls[0][0];
      expect(history[0].answer).toBe('Prefiro não responder');
   });

   it('mostra mensagem de erro e botão de retry quando loadNextQuestion falha', async () => {
      const user = userEvent.setup();
      const loadNextQuestion = vi
         .fn<(prev: TopicAnswer[]) => Promise<TopicNextQuestionResponse>>()
         .mockRejectedValueOnce(new Error('Falha de rede'));

      render(
         <AssessmentModal
            topic="FastAPI"
            firstQuestion={Q1}
            loadNextQuestion={loadNextQuestion}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
         />,
      );

      await user.click(screen.getByLabelText('Nunca usei'));
      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      await waitFor(() => screen.getByText(/algo deu errado/i), { timeout: 1500 });
      expect(screen.getByText('Falha de rede')).toBeInTheDocument();
      expect(
         screen.getByRole('button', { name: 'Tentar novamente' }),
      ).toBeInTheDocument();
   });

   it('cancela ao pressionar Esc', async () => {
      const onCancel = vi.fn();
      render(
         <AssessmentModal
            topic="FastAPI"
            firstQuestion={Q1}
            loadNextQuestion={vi.fn()}
            onSubmit={vi.fn()}
            onCancel={onCancel}
         />,
      );

      await userEvent.keyboard('{Escape}');
      expect(onCancel).toHaveBeenCalledTimes(1);
   });
});
