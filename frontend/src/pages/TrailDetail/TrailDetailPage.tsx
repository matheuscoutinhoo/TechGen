import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLearningTrail } from '../../hooks/useLearningTrail';
import { learningTrailsApi } from '../../api/learningTrails';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { TrailHeader } from '../../components/learning/TrailHeader';
import { TicketCard } from '../../components/learning/TicketCard';
import styles from './TrailDetail.module.css';

export function TrailDetailPage() {
   const { id } = useParams<{ id: string }>();
   const trailId = id ? Number(id) : null;
   const navigate = useNavigate();
   const { trail, isLoading, error, refetch, setTrail } = useLearningTrail(trailId);
   const [actionInFlight, setActionInFlight] = useState<'regenerate' | 'delete' | null>(null);
   const [actionError, setActionError] = useState<string | null>(null);

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

   return (
      <>
         <TrailHeader trail={trail} />

         <div className={styles.toolbar} style={{ marginTop: 'var(--space-6)' }}>
            <span className={styles.sectionTitle}>
               {trail.content.tickets.length} tickets
            </span>
            <div className={styles.actions}>
               <Link to={`/trails/${trail.id}/edit`}>
                  <Button variant="secondary">Editar</Button>
               </Link>
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

         {actionError && (
            <ErrorState description={actionError} />
         )}

         <section className={styles.tickets} aria-label="Lista de tickets da trilha">
            {trail.content.tickets.map((ticket, index) => (
               <TicketCard key={ticket.code} ticket={ticket} defaultOpen={index === 0} />
            ))}
         </section>
      </>
   );
}
