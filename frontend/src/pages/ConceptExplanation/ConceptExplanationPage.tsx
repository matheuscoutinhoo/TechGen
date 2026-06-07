import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { learningTrailsApi } from '../../api/learningTrails';
import { ApiError } from '../../api/client';
import type { ConceptExplanation } from '../../types/api';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { RichText } from '../../components/ui/RichText';
import { Button } from '../../components/ui/Button';
import styles from './ConceptExplanation.module.css';

interface RouteParams extends Record<string, string | undefined> {
   id?: string;
   code?: string;
   concept?: string;
}

export function ConceptExplanationPage() {
   const { id, code, concept } = useParams<RouteParams>();
   const trailId = id ? Number(id) : null;
   const ticketCode = code ?? '';
   const conceptName = concept ? decodeURIComponent(concept) : '';

   const [explanation, setExplanation] = useState<ConceptExplanation | null>(null);
   const [isLoading, setLoading] = useState(true);
   const [isRefreshing, setRefreshing] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const load = useCallback(
      async (options: { refresh?: boolean } = {}) => {
         if (!trailId || !ticketCode || !conceptName) return;
         if (options.refresh) setRefreshing(true);
         else setLoading(true);
         setError(null);
         try {
            const data = await learningTrailsApi.explainConcept(
               trailId,
               ticketCode,
               conceptName,
               options,
            );
            setExplanation(data);
            document.title = `${data.concept} · TechGen`;
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
      [trailId, ticketCode, conceptName],
   );

   useEffect(() => {
      void load();
   }, [load]);

   if (!trailId || !ticketCode || !conceptName) {
      return (
         <ErrorState description="URL incompleta. Volte para a trilha e abra o conceito novamente." />
      );
   }

   if (isLoading) {
      return (
         <div className={styles.loading}>
            <Spinner label="Gerando explicação..." />
         </div>
      );
   }

   if (error || !explanation) {
      return (
         <div className={styles.error}>
            <ErrorState
               description={error ?? 'Conteúdo indisponível.'}
               action={
                  <Button variant="secondary" onClick={() => void load()}>
                     Tentar novamente
                  </Button>
               }
            />
         </div>
      );
   }

   return (
      <article className={styles.page}>
         <nav className={styles.crumbs} aria-label="Navegação">
            <Link to="/dashboard">Trilhas</Link>
            <span className={styles.crumbsSep}>/</span>
            <Link to={`/trails/${trailId}`}>Trilha #{trailId}</Link>
            <span className={styles.crumbsSep}>/</span>
            <span>{ticketCode}</span>
            <span className={styles.crumbsSep}>/</span>
            <span>{explanation.concept}</span>
         </nav>

         <header className={styles.header}>
            <div>
               <span className={styles.eyebrow}>Conceito · {ticketCode}</span>
               <h1 className={styles.title}>{explanation.concept}</h1>
               <p className={styles.subtitle}>
                  Explicação calibrada ao seu nível atual.
               </p>
            </div>
            <div className={styles.actions}>
               <button
                  type="button"
                  className={styles.refreshBtn}
                  onClick={() => void load({ refresh: true })}
                  disabled={isRefreshing}
                  title="Gerar nova explicação calibrada pelo seu nível atual"
               >
                  {isRefreshing ? 'Atualizando...' : 'Atualizar'}
               </button>
            </div>
         </header>

         {/* 1. O que é */}
         <section className={styles.section}>
            <span className={styles.sectionLabel}>O que é</span>
            <RichText as="div" className={styles.lead}>
               {explanation.definition}
            </RichText>
         </section>

         {/* 2. Por que importa */}
         <section className={styles.section}>
            <span className={styles.sectionLabel}>Por que isso importa</span>
            <RichText as="div" className={styles.callout}>
               {explanation.why_it_matters}
            </RichText>
         </section>

         {/* 3. Como funciona */}
         {explanation.patterns.length > 0 && (
            <section className={styles.section}>
               <span className={styles.sectionLabel}>Como funciona na prática</span>
               <ul className={styles.list}>
                  {explanation.patterns.map((pattern, i) => (
                     <li key={i}>
                        <RichText>{pattern}</RichText>
                     </li>
                  ))}
               </ul>
            </section>
         )}

         {/* 4. Exemplos análogos (não copiar/colar no projeto) */}
         {explanation.examples.length > 0 && (
            <section className={styles.section}>
               <span className={styles.sectionLabel}>
                  Exemplos em outros contextos
               </span>
               <p className={styles.subtitle}>
                  Exemplos em domínios diferentes do seu projeto, propositalmente —
                  faça a transposição mental para fixar a ideia.
               </p>
               <div className={styles.examplesGroup}>
                  {explanation.examples.map((ex, i) => (
                     <article key={i} className={styles.example}>
                        <div className={styles.exampleHeader}>
                           <span className={styles.exampleTitle}>{ex.title}</span>
                        </div>
                        <RichText as="div" className={styles.exampleBody}>
                           {ex.description}
                        </RichText>
                        {ex.code && <pre className={styles.exampleCode}>{ex.code}</pre>}
                     </article>
                  ))}
               </div>
            </section>
         )}

         {/* 5. Dicas de aplicação */}
         {explanation.tips.length > 0 && (
            <section className={styles.section}>
               <span className={styles.sectionLabel}>Como aplicar bem</span>
               <ul className={styles.tipsList}>
                  {explanation.tips.map((tip, i) => (
                     <li key={i}>
                        <RichText>{tip}</RichText>
                     </li>
                  ))}
               </ul>
            </section>
         )}

         {/* 6. Armadilhas */}
         {explanation.pitfalls.length > 0 && (
            <section className={styles.section}>
               <span className={styles.sectionLabel}>O que evitar</span>
               <ul className={styles.pitfallsList}>
                  {explanation.pitfalls.map((p, i) => (
                     <li key={i}>
                        <RichText>{p}</RichText>
                     </li>
                  ))}
               </ul>
            </section>
         )}

         {/* 7. Para ir além */}
         {explanation.further_reading.length > 0 && (
            <section className={styles.section}>
               <span className={styles.sectionLabel}>Para ir além</span>
               <ul className={styles.listGrid}>
                  {explanation.further_reading.map((item, i) => (
                     <li key={i}>
                        <RichText>{item}</RichText>
                     </li>
                  ))}
               </ul>
            </section>
         )}
      </article>
   );
}
