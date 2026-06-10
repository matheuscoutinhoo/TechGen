import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useLearningTrails } from '../../hooks/useLearningTrails';
import { useAuth } from '../../contexts/AuthContext';
import { PageTitle } from '../../components/ui/PageTitle';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { learningTrailsApi } from '../../api/learningTrails';
import { ApiError } from '../../api/client';
import { formatDate } from '../../utils/format';
import { TrailProgress } from '../../components/learning/TrailProgress';
import styles from './Dashboard.module.css';

function TrashIcon() {
   return (
      <svg
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         strokeWidth="2"
         strokeLinecap="round"
         strokeLinejoin="round"
         aria-hidden="true"
         focusable="false"
      >
         <polyline points="3 6 5 6 21 6" />
         <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
         <path d="M10 11v6" />
         <path d="M14 11v6" />
         <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      </svg>
   );
}

export function DashboardPage() {
   const { user } = useAuth();
   const { trails, isLoading, error, refetch } = useLearningTrails();
   const navigate = useNavigate();
   const [deletingId, setDeletingId] = useState<number | null>(null);
   const [actionError, setActionError] = useState<string | null>(null);

   async function handleDelete(trailId: number, title: string) {
      const confirmed = window.confirm(
         `Remover a trilha "${title}"? Esta ação não pode ser desfeita.`,
      );
      if (!confirmed) return;
      setActionError(null);
      setDeletingId(trailId);
      try {
         await learningTrailsApi.delete(trailId);
         await refetch();
      } catch (err) {
         setActionError(
            err instanceof ApiError
               ? err.message
               : 'Não foi possível remover a trilha. Tente novamente.',
         );
      } finally {
         setDeletingId(null);
      }
   }

   return (
      <>
         <PageTitle
            eyebrow={user ? `Olá, ${user.name.split(' ')[0]}` : undefined}
            title="Suas trilhas de aprendizado"
            description="Cada trilha é um projeto pedagógico estruturado em tickets. Abra uma para continuar ou comece uma nova."
         />

         <div className={styles.toolbar}>
            <span>
               {isLoading
                  ? 'Carregando...'
                  : `${trails.length} trilha${trails.length === 1 ? '' : 's'}`}
            </span>
            <Button variant="primary" onClick={() => navigate('/trails/new')}>
               Nova trilha
            </Button>
         </div>

         {actionError && (
            <div className={styles.actionError} role="alert">
               {actionError}
            </div>
         )}

         {isLoading && <Spinner label="Carregando suas trilhas..." />}

         {error && !isLoading && (
            <ErrorState
               description={error.message}
               action={
                  <Button variant="secondary" onClick={() => void refetch()}>
                     Tentar novamente
                  </Button>
               }
            />
         )}

         {!isLoading && !error && trails.length === 0 && (
            <EmptyState
               title="Você ainda não criou nenhuma trilha"
               description="Diga o tema que quer aprender e a IA constrói um projeto pedagógico em poucos segundos."
               actions={
                  <Button variant="primary" onClick={() => navigate('/trails/new')}>
                     Criar primeira trilha
                  </Button>
               }
            />
         )}

         {!isLoading && !error && trails.length > 0 && (
            <ul className={styles.list} role="list">
               {trails.map((trail) => {
                  const isDeleting = deletingId === trail.id;
                  return (
                     <li key={trail.id} className={styles.listItem}>
                        <article
                           className={styles.trailCard}
                           aria-busy={isDeleting || undefined}
                        >
                           <div className={styles.cardHeader}>
                              <span className={styles.topic}>{trail.topic}</span>
                              {trail.completed_at && (
                                 <span className={styles.completedBadge}>
                                    concluída
                                 </span>
                              )}
                           </div>
                           <h2 className={styles.title}>
                              <Link
                                 to={`/trails/${trail.id}`}
                                 className={styles.titleLink}
                              >
                                 {trail.title}
                              </Link>
                           </h2>
                           <p className={styles.summary}>{trail.summary}</p>
                           {trail.ticket_count > 0 && (
                              <div className={styles.progressSlot}>
                                 <TrailProgress
                                    completed={trail.completed_ticket_count}
                                    total={trail.ticket_count}
                                    variant="compact"
                                 />
                              </div>
                           )}
                           <div className={styles.cardFooter}>
                              <span className={styles.meta}>
                                 Atualizada em {formatDate(trail.updated_at)}
                              </span>
                              <div className={styles.actions}>
                                 <button
                                    type="button"
                                    className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                    onClick={() =>
                                       void handleDelete(trail.id, trail.title)
                                    }
                                    disabled={isDeleting}
                                    aria-label={`Remover trilha ${trail.title}`}
                                    title="Remover trilha"
                                 >
                                    <TrashIcon />
                                 </button>
                              </div>
                           </div>
                        </article>
                     </li>
                  );
               })}
            </ul>
         )}
      </>
   );
}
