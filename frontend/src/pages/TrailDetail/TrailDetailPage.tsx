import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLearningTrail } from '../../hooks/useLearningTrail';
import { useSkills } from '../../hooks/useSkills';
import { learningTrailsApi } from '../../api/learningTrails';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { TrailHeader } from '../../components/learning/TrailHeader';
import { TicketCard } from '../../components/learning/TicketCard';
import { EarnedSkillsCard } from '../../components/learning/EarnedSkillsCard';
import { formatDate } from '../../utils/format';
import type { CompleteTrailResponse } from '../../types/api';
import styles from './TrailDetail.module.css';

type Action = 'regenerate' | 'delete' | 'complete';

export function TrailDetailPage() {
   const { id } = useParams<{ id: string }>();
   const trailId = id ? Number(id) : null;
   const navigate = useNavigate();
   const { trail, isLoading, error, refetch, setTrail } = useLearningTrail(trailId);
   const { skills, refetch: refetchSkills } = useSkills();
   const [actionInFlight, setActionInFlight] = useState<Action | null>(null);
   const [actionError, setActionError] = useState<string | null>(null);
   const [completion, setCompletion] = useState<CompleteTrailResponse | null>(null);

   const handleRegenerate = async () => {
      if (!trailId) return;
      const confirmed = window.confirm(
         'Regenerar substituirá o conteúdo atual da trilha. Deseja continuar?',
      );
      if (!confirmed) return;
      setActionInFlight('regenerate');
      setActionError(null);
      try {
         const updated = await learningTrailsApi.regenerate(trailId);
         setTrail(updated);
         setCompletion(null);
      } catch (err) {
         setActionError(
            err instanceof ApiError ? err.message : 'Não foi possível regenerar agora.',
         );
      } finally {
         setActionInFlight(null);
      }
   };

   const handleDelete = async () => {
      if (!trailId) return;
      const confirmed = window.confirm('Excluir esta trilha? Esta ação é definitiva.');
      if (!confirmed) return;
      setActionInFlight('delete');
      setActionError(null);
      try {
         await learningTrailsApi.delete(trailId);
         navigate('/dashboard', { replace: true });
      } catch (err) {
         setActionError(
            err instanceof ApiError ? err.message : 'Não foi possível excluir agora.',
         );
         setActionInFlight(null);
      }
   };

   const handleComplete = async () => {
      if (!trailId) return;
      setActionInFlight('complete');
      setActionError(null);
      try {
         const response = await learningTrailsApi.complete(trailId);
         setTrail(response.trail);
         setCompletion(response);
         // refresh do perfil de skills para refletir o que entrou agora
         void refetchSkills();
      } catch (err) {
         setActionError(
            err instanceof ApiError ? err.message : 'Não foi possível concluir agora.',
         );
      } finally {
         setActionInFlight(null);
      }
   };

   if (isLoading) {
      return <Spinner label="Carregando trilha..." />;
   }
   if (error || !trail) {
      return (
         <ErrorState
            description={error?.message ?? 'Trilha não encontrada.'}
            action={
               <Button variant="secondary" onClick={() => void refetch()}>
                  Tentar novamente
               </Button>
            }
         />
      );
   }

   const isCompleted = Boolean(trail.completed_at);
   const conceptHref = (ticketCode: string) => (concept: string) =>
      `/trails/${trail.id}/tickets/${encodeURIComponent(
         ticketCode,
      )}/concepts/${encodeURIComponent(concept)}`;

   return (
      <>
         <TrailHeader trail={trail} />

         {isCompleted && (
            <div className={styles.completedBadge}>
               <strong>Trilha concluída</strong>
               <span>
                  em {formatDate(trail.completed_at as string)} — os conceitos foram
                  adicionados às suas skills.
               </span>
            </div>
         )}

         <EarnedSkillsCard
            tickets={trail.content.tickets}
            currentSkills={skills}
            completed={isCompleted && completion !== null}
            addedConcepts={completion?.added_concepts ?? []}
            upgradedConcepts={completion?.upgraded_concepts ?? []}
         />

         <div className={styles.toolbar} style={{ marginTop: 'var(--space-6)' }}>
            <span className={styles.sectionTitle}>
               {trail.content.tickets.length} tickets
            </span>
            <div className={styles.actions}>
               {!isCompleted && (
                  <Button
                     variant="primary"
                     onClick={() => void handleComplete()}
                     isLoading={actionInFlight === 'complete'}
                  >
                     Concluir trilha
                  </Button>
               )}
               <Button
                  variant="secondary"
                  onClick={() => void handleRegenerate()}
                  isLoading={actionInFlight === 'regenerate'}
               >
                  Regenerar
               </Button>
               <Button
                  variant="danger"
                  onClick={() => void handleDelete()}
                  isLoading={actionInFlight === 'delete'}
               >
                  Excluir
               </Button>
            </div>
         </div>

         {actionError && <ErrorState description={actionError} />}

         <section className={styles.tickets} aria-label="Lista de tickets da trilha">
            {trail.content.tickets.map((ticket, index) => (
               <TicketCard
                  key={ticket.code}
                  ticket={ticket}
                  defaultOpen={index === 0}
                  conceptHref={conceptHref(ticket.code)}
               />
            ))}
         </section>
      </>
   );
}
