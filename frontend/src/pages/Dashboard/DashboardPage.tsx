import { Link, useNavigate } from 'react-router-dom';
import { useLearningTrails } from '../../hooks/useLearningTrails';
import { useAuth } from '../../contexts/AuthContext';
import { PageTitle } from '../../components/ui/PageTitle';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { formatDate } from '../../utils/format';
import styles from './Dashboard.module.css';

export function DashboardPage() {
   const { user } = useAuth();
   const { trails, isLoading, error, refetch } = useLearningTrails();
   const navigate = useNavigate();

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
               {trails.map((trail) => (
                  <li key={trail.id}>
                     <Link to={`/trails/${trail.id}`} className={styles.trailLink}>
                        <article className={styles.trailCard}>
                           <span className={styles.topic}>{trail.topic}</span>
                           <h2 className={styles.title}>{trail.title}</h2>
                           <p className={styles.summary}>{trail.summary}</p>
                           <span className={styles.meta}>
                              Atualizada em {formatDate(trail.updated_at)}
                           </span>
                        </article>
                     </Link>
                  </li>
               ))}
            </ul>
         )}
      </>
   );
}
