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
import type { CompleteTicketResponse } from '../../types/api';
import styles from './TrailDetail.module.css';

type Action = 'regenerate' | 'delete';

function FlowCheck() {
   return (
      <svg
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         strokeWidth="3"
         strokeLinecap="round"
         strokeLinejoin="round"
         aria-hidden="true"
         focusable="false"
      >
         <polyline points="20 6 9 17 4 12" className={styles.flowCheckPath} />
      </svg>
   );
}

export function TrailDetailPage() {
   const { id } = useParams<{ id: string }>();
   const trailId = id ? Number(id) : null;
   const navigate = useNavigate();
   const { trail, isLoading, error, refetch, setTrail } = useLearningTrail(trailId);
   const { skills, refetch: refetchSkills } = useSkills();
   const [actionInFlight, setActionInFlight] = useState<Action | null>(null);
   const [actionError, setActionError] = useState<string | null>(null);
   const [completion, setCompletion] = useState<CompleteTicketResponse | null>(null);
   const [busyTicketCode, setBusyTicketCode] = useState<string | null>(null);

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

   const handleToggleTicket = async (ticketCode: string, next: boolean) => {
      if (!trailId) return;
      setActionError(null);
      setBusyTicketCode(ticketCode);
      try {
         const response = next
            ? await learningTrailsApi.completeTicket(trailId, ticketCode)
            : await learningTrailsApi.uncompleteTicket(trailId, ticketCode);
         setTrail(response.trail);
         if (response.trail_completed) {
            setCompletion(response);
            void refetchSkills();
         } else if (!next) {
            // Reabriu a trilha — limpa feedback de auto-conclusão anterior.
            setCompletion(null);
         }
      } catch (err) {
         setActionError(
            err instanceof ApiError
               ? err.message
               : 'Não foi possível atualizar o ticket agora.',
         );
      } finally {
         setBusyTicketCode(null);
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

   const tickets = trail.content.tickets;
   const isCompleted = Boolean(trail.completed_at);
   const conceptHref = (ticketCode: string) => (concept: string) =>
      `/trails/${trail.id}/tickets/${encodeURIComponent(
         ticketCode,
      )}/concepts/${encodeURIComponent(concept)}`;

   return (
      <>
         <TrailHeader trail={trail} />

         {isCompleted && (
            <div className={styles.completedBadge} role="status">
               <strong>Trilha concluída</strong>
               <span>
                  em {formatDate(trail.completed_at as string)} — os conceitos foram
                  adicionados às suas skills.
               </span>
            </div>
         )}

         <EarnedSkillsCard
            categories={trail.content.skill_categories ?? []}
            tickets={tickets}
            currentSkills={skills}
            completed={isCompleted && completion !== null}
            addedConcepts={completion?.added_concepts ?? []}
            upgradedConcepts={completion?.upgraded_concepts ?? []}
         />

         <div className={styles.toolbar} style={{ marginTop: 'var(--space-6)' }}>
            <span className={styles.sectionTitle}>Tickets</span>
            <div className={styles.actions}>
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

         <ol className={styles.flow} aria-label="Fluxo de tickets da trilha">
            {tickets.map((ticket, index) => {
               const ticketDone = Boolean(ticket.completed_at);
               const previousDone =
                  index > 0 && Boolean(tickets[index - 1].completed_at);
               const isFinal = index === tickets.length - 1;
               const itemClass = [
                  styles.flowItem,
                  ticketDone ? styles.flowItemDone : '',
                  previousDone ? styles.flowConnectorActive : '',
                  isFinal ? styles.flowItemFinal : '',
               ]
                  .filter(Boolean)
                  .join(' ');
               return (
                  <li key={ticket.code} className={itemClass}>
                     <span className={styles.flowNode} aria-hidden="true">
                        {ticketDone ? <FlowCheck /> : index + 1}
                     </span>
                     <TicketCard
                        ticket={ticket}
                        defaultOpen={index === 0}
                        conceptHref={conceptHref(ticket.code)}
                        onToggleComplete={(code, next) =>
                           void handleToggleTicket(code, next)
                        }
                        isBusy={busyTicketCode === ticket.code}
                     />
                  </li>
               );
            })}
         </ol>
      </>
   );
}
