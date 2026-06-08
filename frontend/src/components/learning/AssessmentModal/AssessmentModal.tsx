import { useCallback, useEffect, useRef, useState } from 'react';
import type { TopicAnswer, TopicQuestion } from '../../../types/api';
import { Button } from '../../ui/Button';
import styles from './AssessmentModal.module.css';

export interface AssessmentModalProps {
   topic: string;
   questions: TopicQuestion[];
   isSubmitting?: boolean;
   onSubmit: (answers: TopicAnswer[]) => void;
   onCancel: () => void;
}

type Phase = 'idle' | 'leaving';

const TRANSITION_MS = 200;

export function AssessmentModal({
   topic,
   questions,
   isSubmitting = false,
   onSubmit,
   onCancel,
}: AssessmentModalProps) {
   const [index, setIndex] = useState(0);
   const [phase, setPhase] = useState<Phase>('idle');
   const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
   const [answers, setAnswers] = useState<Record<string, string>>({});
   const dialogRef = useRef<HTMLDivElement | null>(null);

   const total = questions.length;
   const current = questions[index];
   const isLast = index === total - 1;

   const selectedId = current ? answers[current.id] : undefined;

   const goTo = useCallback(
      (nextIndex: number, dir: 'forward' | 'backward') => {
         if (nextIndex < 0 || nextIndex >= total) return;
         setDirection(dir);
         setPhase('leaving');
         window.setTimeout(() => {
            setIndex(nextIndex);
            setPhase('idle');
         }, TRANSITION_MS);
      },
      [total],
   );

   const collectAnswers = useCallback((): TopicAnswer[] => {
      return questions
         .filter((q) => Boolean(answers[q.id]))
         .map((q) => {
            const optionId = answers[q.id];
            const option = q.options.find((opt) => opt.id === optionId);
            return {
               question_id: q.id,
               question: q.question,
               answer: option?.label ?? 'Prefiro não responder',
            };
         });
   }, [questions, answers]);

   const handleNext = useCallback(() => {
      if (isLast) {
         onSubmit(collectAnswers());
         return;
      }
      goTo(index + 1, 'forward');
   }, [isLast, index, goTo, onSubmit, collectAnswers]);

   const handlePrev = () => goTo(index - 1, 'backward');

   const handleSkip = () => {
      if (current) {
         setAnswers((prev) => ({ ...prev, [current.id]: '__skip__' }));
      }
      handleNext();
   };

   const handleSelect = (optionId: string) => {
      if (!current) return;
      setAnswers((prev) => ({ ...prev, [current.id]: optionId }));
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
      // foca o card a cada troca de pergunta — leitor de tela anuncia o novo conteúdo
      if (phase === 'idle' && dialogRef.current) {
         dialogRef.current.focus();
      }
   }, [phase, index]);

   if (!current) return null;

   const stageClass = [
      styles.stage,
      phase === 'leaving' && direction === 'forward' ? styles.leavingForward : '',
      phase === 'leaving' && direction === 'backward' ? styles.leavingBackward : '',
   ]
      .filter(Boolean)
      .join(' ');

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
                  Responda rapidamente para a IA calibrar profundidade e pré-requisitos
                  sobre <strong>{topic}</strong>.
               </p>
               <ol className={styles.progress} aria-label="Progresso do diagnóstico">
                  {questions.map((q, i) => {
                     const isActive = i === index;
                     const isAnswered = Boolean(answers[q.id]);
                     const className = [
                        styles.progressDot,
                        isActive ? styles.progressDotActive : '',
                        isAnswered && !isActive ? styles.progressDotAnswered : '',
                     ]
                        .filter(Boolean)
                        .join(' ');
                     return (
                        <li key={q.id} className={className} aria-current={isActive || undefined}>
                           {i + 1}
                        </li>
                     );
                  })}
               </ol>
            </header>

            <div
               className={stageClass}
               key={`stage-${index}`}
               aria-live="polite"
            >
               <div className={styles.questionMeta}>
                  Pergunta {index + 1} de {total}
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
                           <span className={styles.optionLabel}>{option.label}</span>
                        </label>
                     );
                  })}
               </fieldset>
            </div>

            <footer className={styles.footer}>
               <button
                  type="button"
                  className={styles.skip}
                  onClick={handleSkip}
                  disabled={isSubmitting}
               >
                  Pular pergunta
               </button>
               <div className={styles.actions}>
                  <Button
                     type="button"
                     variant="ghost"
                     onClick={handlePrev}
                     disabled={index === 0 || isSubmitting}
                  >
                     Anterior
                  </Button>
                  <Button
                     type="button"
                     variant="primary"
                     onClick={handleNext}
                     disabled={!selectedId || isSubmitting}
                  >
                     {isLast
                        ? isSubmitting
                           ? 'Gerando trilha...'
                           : 'Gerar trilha'
                        : 'Próxima'}
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
