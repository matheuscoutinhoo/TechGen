import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLearningTrail } from '../../hooks/useLearningTrail';
import { learningTrailsApi } from '../../api/learningTrails';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { TextArea } from '../../components/ui/TextArea';
import { PageTitle } from '../../components/ui/PageTitle';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/ErrorState';
import styles from './EditTrail.module.css';

export function EditTrailPage() {
   const { id } = useParams<{ id: string }>();
   const trailId = id ? Number(id) : null;
   const navigate = useNavigate();
   const { trail, isLoading, error, refetch } = useLearningTrail(trailId);

   const [title, setTitle] = useState('');
   const [summary, setSummary] = useState('');
   const [submitting, setSubmitting] = useState(false);
   const [submitError, setSubmitError] = useState<string | null>(null);

   useEffect(() => {
      if (trail) {
         setTitle(trail.title);
         setSummary(trail.summary);
      }
   }, [trail]);

   if (isLoading) {
      return <Spinner label="Carregando trilha..." />;
   }
   if (error || !trail || !trailId) {
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

   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitError(null);
      setSubmitting(true);
      try {
         await learningTrailsApi.update(trailId, { title, summary });
         navigate(`/trails/${trailId}`, { replace: true });
      } catch (err) {
         setSubmitError(
            err instanceof ApiError ? err.message : 'Não foi possível salvar agora.',
         );
      } finally {
         setSubmitting(false);
      }
   };

   return (
      <>
         <PageTitle
            eyebrow={`Tema: ${trail.topic}`}
            title="Editar trilha"
            description="Você pode ajustar o título e o resumo manualmente."
         />

         <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {submitError && <ErrorState description={submitError} />}
            <Input
               label="Título"
               value={title}
               onChange={(event) => setTitle(event.target.value)}
               minLength={3}
               maxLength={200}
               required
            />
            <TextArea
               label="Resumo"
               value={summary}
               onChange={(event) => setSummary(event.target.value)}
               minLength={10}
               maxLength={4000}
               required
               rows={8}
            />
            <div className={styles.actions}>
               <Button
                  variant="secondary"
                  type="button"
                  onClick={() => navigate(`/trails/${trailId}`)}
               >
                  Cancelar
               </Button>
               <Button type="submit" variant="primary" isLoading={submitting}>
                  Salvar alterações
               </Button>
            </div>
         </form>
      </>
   );
}
