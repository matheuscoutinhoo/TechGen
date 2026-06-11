import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
   TopicAnswer,
   TopicNextQuestionResponse,
   TopicQuestion,
} from '../../../types/api';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import styles from './AssessmentModal.module.css';

export interface AssessmentModalProps {
   topic: string;
   firstQuestion: TopicQuestion;
   /**
    * Busca a próxima pergunta com o histórico atual. Retorna `done=true`
    * quando o Mentor decide que já tem contexto suficiente.
    */
   loadNextQuestion: (
      previousAnswers: TopicAnswer[],
   ) => Promise<TopicNextQuestionResponse>;
   /** Disparado quando o aluno termina e a trilha pode ser gerada. */
   onSubmit: (answers: TopicAnswer[]) => void;
   onCancel: () => void;
   isSubmitting?: boolean;
   /** Teto rígido para a UI exibir o progresso. */
   maxQuestions?: number;
}

type Phase =
   | 'idle'
   | 'leaving-forward'
   | 'leaving-backward'
   | 'loading-next';

const TRANSITION_MS = 200;
const SKIP_SENTINEL = '__skip__';
const SKIP_LABEL = 'Prefiro não responder';

export function AssessmentModal({
   topic,
   firstQuestion,
   loadNextQuestion,
   onSubmit,
   onCancel,
   isSubmitting = false,
   maxQuestions = 5,
}: AssessmentModalProps) {
   const [questions, setQuestions] = useState<TopicQuestion[]>([firstQuestion]);
   const [answers, setAnswers] = useState<Record<string, string>>({});
   const [index, setIndex] = useState(0);
   const [phase, setPhase] = useState<Phase>('idle');
   const [errorMessage, setErrorMessage] = useState<string | null>(null);
   const dialogRef = useRef<HTMLDivElement | null>(null);

   const total = questions.length;
   const current = questions[index];
   const selectedId = current ? answers[current.id] : undefined;
   const isReviewing = index < total - 1;
   const reachedCeiling = total >= maxQuestions;

   const handleSelect = (optionId: string) => {
      if (!current) return;
      setAnswers((prev) => ({ ...prev, [current.id]: optionId }));
   };

   const collectAnswers = useCallback(
      (
         allQuestions: TopicQuestion[],
         allAnswers: Record<string, string>,
      ): TopicAnswer[] => {
         const result: TopicAnswer[] = [];
         for (const q of allQuestions) {
            const optionId = allAnswers[q.id];
            if (!optionId) continue;
            const label =
               optionId === SKIP_SENTINEL
                  ? SKIP_LABEL
                  : q.options.find((opt) => opt.id === optionId)?.label ?? SKIP_LABEL;
            result.push({
               question_id: q.id,
               question: q.question,
               answer: label,
            });
         }
         return result;
      },
      [],
   );

   const fetchNext = useCallback(
      async (latestAnswers: Record<string, string>) => {
         setErrorMessage(null);
         setPhase('loading-next');
         const history = collectAnswers(questions, latestAnswers);
         try {
            const result = await loadNextQuestion(history);
            if (result.done || !result.question) {
               onSubmit(history);
               return;
            }
            const nextQuestion = result.question;
            setQuestions((prev) => [...prev, nextQuestion]);
            setIndex(questions.length);
            setPhase('idle');
         } catch (err) {
            setPhase('idle');
            const message =
               err instanceof Error
                  ? err.message
                  : 'Não conseguimos carregar a próxima pergunta.';
            setErrorMessage(message);
         }
      },
      [collectAnswers, loadNextQuestion, onSubmit, questions],
   );

   const handleContinue = useCallback(() => {
      if (!current || !selectedId || isSubmitting) return;

      if (isReviewing) {
         setPhase('leaving-forward');
         window.setTimeout(() => {
            setIndex(index + 1);
            setPhase('idle');
         }, TRANSITION_MS);
         return;
      }

      if (reachedCeiling) {
         onSubmit(collectAnswers(questions, answers));
         return;
      }

      setPhase('leaving-forward');
      window.setTimeout(() => {
         void fetchNext(answers);
      }, TRANSITION_MS);
   }, [
      answers,
      collectAnswers,
      current,
      fetchNext,
      index,
      isReviewing,
      isSubmitting,
      onSubmit,
      questions,
      reachedCeiling,
      selectedId,
   ]);

   const handlePrev = () => {
      if (index === 0) return;
      setPhase('leaving-backward');
      window.setTimeout(() => {
         setIndex(index - 1);
         setPhase('idle');
      }, TRANSITION_MS);
   };

   const handleSkip = () => {
      if (!current || isSubmitting) return;
      const next = { ...answers, [current.id]: SKIP_SENTINEL };
      setAnswers(next);
      if (isReviewing) {
         setPhase('leaving-forward');
         window.setTimeout(() => {
            setIndex(index + 1);
            setPhase('idle');
         }, TRANSITION_MS);
         return;
      }
      if (reachedCeiling) {
         onSubmit(collectAnswers(questions, next));
         return;
      }
      setPhase('leaving-forward');
      window.setTimeout(() => {
         void fetchNext(next);
      }, TRANSITION_MS);
   };

   const handleRetry = () => {
      void fetchNext(answers);
   };

   useEffect(() => {
      function onKey(event: KeyboardEvent) {
         if (event.key === 'Escape' && !isSubmitting) {
            onCancel();
         }
      }
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
   }, [onCancel, isSubmitting]);

   useEffect(() => {
      if (phase === 'idle' && dialogRef.current) {
         dialogRef.current.focus();
      }
   }, [phase, index]);

   const progress = useMemo(() => {
      const items: Array<{ key: string; state: 'active' | 'answered' | 'pending' }> = [];
      questions.forEach((q, i) => {
         if (i === index && phase !== 'loading-next') {
            items.push({ key: q.id, state: 'active' });
         } else if (answers[q.id]) {
            items.push({ key: q.id, state: 'answered' });
         } else {
            items.push({ key: q.id, state: 'active' });
         }
      });
      const remaining = Math.max(0, maxQuestions - questions.length);
      const showLoadingSlot = phase === 'loading-next';
      const pendingCount = showLoadingSlot ? remaining + 1 : remaining;
      for (let i = 0; i < pendingCount; i += 1) {
         items.push({ key: `pending-${i}`, state: 'pending' });
      }
      return items;
   }, [answers, index, maxQuestions, phase, questions]);

   const stageClass = [
      styles.stage,
      phase === 'leaving-forward' ? styles.leavingForward : '',
      phase === 'leaving-backward' ? styles.leavingBackward : '',
      phase === 'loading-next' ? styles.stageLoading : '',
   ]
      .filter(Boolean)
      .join(' ');

   const isLoading = phase === 'loading-next';

   // Enquanto a trilha está sendo gerada, o modal vira uma tela de loading
   // dedicada: sem perguntas, sem rodapé e sem nenhuma ação de fechar
   // (Cancelar/Esc já estão desabilitados por `isSubmitting`). A mensagem
   // persuade o aluno a aguardar pelo resultado a nível de mercado.
   if (isSubmitting) {
      return (
         <div
            className={styles.backdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="assessment-generating-title"
         >
            <div className={styles.dialog} ref={dialogRef} tabIndex={-1}>
               <div className={styles.generating} aria-live="polite">
                  <Spinner label="O Mentor está desenhando seu projeto..." />
                  <h2
                     id="assessment-generating-title"
                     className={styles.generatingTitle}
                  >
                     Gerando sua trilha sob medida
                  </h2>
                  <p className={styles.generatingText}>
                     O Mentor está cruzando as suas <strong>skills</strong> com as{' '}
                     <strong>respostas do diagnóstico</strong> para desenhar um
                     projeto realista sobre <strong>{topic}</strong>, decomposto em
                     tickets entregáveis a nível de mercado.
                  </p>
                  <p className={styles.generatingText}>
                     Isso pode levar <strong>até 5 minutos</strong> — e vale cada
                     segundo. Em vez de uma resposta rasa e instantânea, você recebe
                     um plano de aprendizado no padrão de um projeto real, calibrado
                     exatamente para o seu nível.
                  </p>
                  <p className={styles.generatingHint}>
                     Mantenha esta aba aberta. Estamos trabalhando para entregar o
                     melhor resultado possível.
                  </p>
               </div>
            </div>
         </div>
      );
   }

   let primaryLabel: string;
   if (isSubmitting) {
      primaryLabel = 'Gerando trilha...';
   } else if (isLoading) {
      primaryLabel = 'Carregando...';
   } else if (isReviewing) {
      primaryLabel = 'Próxima';
   } else if (reachedCeiling) {
      primaryLabel = 'Gerar trilha';
   } else {
      primaryLabel = 'Continuar';
   }

   return (
      <div
         className={styles.backdrop}
         role="dialog"
         aria-modal="true"
         aria-labelledby="assessment-title"
      >
         <div className={styles.dialog} ref={dialogRef} tabIndex={-1}>
            <header className={styles.header}>
               <div className={styles.eyebrow}>
                  <span className={styles.eyebrowBar} aria-hidden="true" />
                  Diagnóstico inicial
               </div>
               <h2 id="assessment-title" className={styles.title}>
                  Antes de gerar a trilha
               </h2>
               <p className={styles.subtitle}>
                  Cada resposta calibra a próxima pergunta. O Mentor usa esse contexto
                  para ajustar a profundidade e os pré-requisitos sobre{' '}
                  <strong>{topic}</strong>.
               </p>
               <ol className={styles.progress} aria-label="Progresso do diagnóstico">
                  {progress.map((item, i) => {
                     const className = [
                        styles.progressDot,
                        item.state === 'active' && i === index && !isLoading
                           ? styles.progressDotActive
                           : '',
                        item.state === 'answered' ? styles.progressDotAnswered : '',
                        item.state === 'pending' ? styles.progressDotPending : '',
                     ]
                        .filter(Boolean)
                        .join(' ');
                     return (
                        <li
                           key={item.key}
                           className={className}
                           aria-current={
                              item.state === 'active' && i === index && !isLoading
                                 ? true
                                 : undefined
                           }
                        >
                           {item.state === 'pending' ? '·' : i + 1}
                        </li>
                     );
                  })}
               </ol>
            </header>

            <div
               className={stageClass}
               key={`stage-${index}-${phase}`}
               aria-live="polite"
            >
               {isLoading ? (
                  <>
                     <Spinner label="Preparando a próxima pergunta..." />
                     <p className={styles.stageLoadingHint}>
                        O Mentor está usando suas respostas anteriores para escolher
                        a próxima sondagem.
                     </p>
                  </>
               ) : errorMessage ? (
                  <>
                     <p className={styles.stageLoadingTitle}>
                        Algo deu errado ao carregar a próxima pergunta.
                     </p>
                     <p className={styles.stageLoadingHint}>{errorMessage}</p>
                     <Button type="button" variant="secondary" onClick={handleRetry}>
                        Tentar novamente
                     </Button>
                  </>
               ) : current ? (
                  <>
                     <div className={styles.questionMeta}>
                        Pergunta {index + 1}
                        {reachedCeiling || isReviewing ? ` de ${total}` : ''}
                     </div>
                     <h3 className={styles.question}>{current.question}</h3>
                     <fieldset
                        className={styles.options}
                        aria-label={`Alternativas para: ${current.question}`}
                        disabled={isSubmitting}
                     >
                        {current.options.map((option) => {
                           const isSelected = selectedId === option.id;
                           return (
                              <label
                                 key={option.id}
                                 className={[
                                    styles.option,
                                    isSelected ? styles.optionSelected : '',
                                 ]
                                    .filter(Boolean)
                                    .join(' ')}
                              >
                                 <input
                                    type="radio"
                                    name={`q-${current.id}`}
                                    value={option.id}
                                    checked={isSelected}
                                    onChange={() => handleSelect(option.id)}
                                    className={styles.optionRadio}
                                 />
                                 <span className={styles.optionLabel}>
                                    {option.label}
                                 </span>
                              </label>
                           );
                        })}
                     </fieldset>
                  </>
               ) : null}
            </div>

            <footer className={styles.footer}>
               <button
                  type="button"
                  className={styles.skip}
                  onClick={handleSkip}
                  disabled={isSubmitting || isLoading}
               >
                  Pular pergunta
               </button>
               <div className={styles.actions}>
                  <Button
                     type="button"
                     variant="ghost"
                     onClick={handlePrev}
                     disabled={index === 0 || isSubmitting || isLoading}
                  >
                     Anterior
                  </Button>
                  <Button
                     type="button"
                     variant="primary"
                     onClick={handleContinue}
                     disabled={!selectedId || isSubmitting || isLoading}
                  >
                     {primaryLabel}
                  </Button>
               </div>
            </footer>

            <button
               type="button"
               className={styles.cancel}
               onClick={onCancel}
               disabled={isSubmitting}
               aria-label="Cancelar diagnóstico"
            >
               Cancelar
            </button>
         </div>
      </div>
   );
}
