import { useCallback, useEffect, useState } from 'react';
import { learningTrailsApi } from '../../../api/learningTrails';
import { ApiError } from '../../../api/client';
import type { ConceptExplanation } from '../../../types/api';
import { Spinner } from '../../ui/Spinner';
import { ErrorState } from '../../ui/ErrorState';
import { Button } from '../../ui/Button';
import styles from './ConceptModal.module.css';

export interface ConceptModalProps {
   trailId: number;
   ticketCode: string;
   concept: string;
   onClose(): void;
}

export function ConceptModal({ trailId, ticketCode, concept, onClose }: ConceptModalProps) {
   const [explanation, setExplanation] = useState<ConceptExplanation | null>(null);
   const [isLoading, setLoading] = useState(true);
   const [isRefreshing, setRefreshing] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const load = useCallback(
      async (options: { refresh?: boolean } = {}) => {
         if (options.refresh) {
            setRefreshing(true);
         } else {
            setLoading(true);
         }
         setError(null);
         try {
            const data = await learningTrailsApi.explainConcept(
               trailId,
               ticketCode,
               concept,
               options,
            );
            setExplanation(data);
         } catch (err) {
            setError(
               err instanceof ApiError
                  ? err.message
                  : 'Não foi possível carregar a explicação.',
            );
         } finally {
            setLoading(false);
            setRefreshing(false);
         }
      },
      [trailId, ticketCode, concept],
   );

   useEffect(() => {
      void load();
   }, [load]);

   useEffect(() => {
      const handler = (event: KeyboardEvent) => {
         if (event.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
   }, [onClose]);

   return (
      <div
         className={styles.backdrop}
         role="presentation"
         onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
         }}
      >
         <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="concept-modal-title"
         >
            <header className={styles.header}>
               <div>
                  <span className={styles.eyebrow}>Conceito · {ticketCode}</span>
                  <h2 id="concept-modal-title" className={styles.title}>
                     {explanation?.concept ?? concept}
                  </h2>
               </div>
               <div className={styles.headerActions}>
                  {explanation && !isLoading && (
                     <button
                        type="button"
                        className={styles.refreshBtn}
                        onClick={() => void load({ refresh: true })}
                        disabled={isRefreshing}
                        title="Gerar uma nova explicação calibrada pelo seu nível atual"
                     >
                        {isRefreshing ? 'Atualizando...' : 'Atualizar'}
                     </button>
                  )}
                  <button
                     type="button"
                     className={styles.closeBtn}
                     onClick={onClose}
                     aria-label="Fechar"
                  >
                     ×
                  </button>
               </div>
            </header>

            {isLoading && <Spinner label="Gerando explicação..." />}
            {error && (
               <ErrorState
                  description={error}
                  action={
                     <Button variant="secondary" onClick={onClose}>
                        Fechar
                     </Button>
                  }
               />
            )}

            {explanation && !isLoading && (
               <>
                  <section className={styles.section}>
                     <h3>Definição</h3>
                     <p>{explanation.definition}</p>
                  </section>
                  <section className={styles.section}>
                     <h3>Por que importa</h3>
                     <p>{explanation.why_it_matters}</p>
                  </section>
                  {explanation.patterns.length > 0 && (
                     <section className={styles.section}>
                        <h3>Padrões</h3>
                        <ul className={styles.list}>
                           {explanation.patterns.map((p, i) => (
                              <li key={i}>{p}</li>
                           ))}
                        </ul>
                     </section>
                  )}
                  {explanation.pitfalls.length > 0 && (
                     <section className={styles.section}>
                        <h3>Armadilhas comuns</h3>
                        <ul className={styles.list}>
                           {explanation.pitfalls.map((p, i) => (
                              <li key={i}>{p}</li>
                           ))}
                        </ul>
                     </section>
                  )}
                  {explanation.tips.length > 0 && (
                     <section className={styles.section}>
                        <h3>Dicas práticas</h3>
                        <ul className={styles.list}>
                           {explanation.tips.map((t, i) => (
                              <li key={i}>{t}</li>
                           ))}
                        </ul>
                     </section>
                  )}
                  {explanation.examples.length > 0 && (
                     <section className={styles.section}>
                        <h3>Exemplos</h3>
                        {explanation.examples.map((ex, i) => (
                           <div key={i} className={styles.example}>
                              <span className={styles.exampleTitle}>{ex.title}</span>
                              <p>{ex.description}</p>
                              {ex.code && <pre className={styles.exampleCode}>{ex.code}</pre>}
                           </div>
                        ))}
                     </section>
                  )}
                  {explanation.further_reading.length > 0 && (
                     <section className={styles.section}>
                        <h3>Para ir além</h3>
                        <div className={styles.chips}>
                           {explanation.further_reading.map((r, i) => (
                              <span key={i} className={styles.chip}>
                                 {r}
                              </span>
                           ))}
                        </div>
                     </section>
                  )}
               </>
            )}
         </div>
      </div>
   );
}
