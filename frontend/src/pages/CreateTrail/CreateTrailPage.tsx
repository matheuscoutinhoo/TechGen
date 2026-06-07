import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { learningTrailsApi } from '../../api/learningTrails';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageTitle } from '../../components/ui/PageTitle';
import { Spinner } from '../../components/ui/Spinner';
import styles from './CreateTrail.module.css';

const SUGGESTIONS = [
   'FastAPI com autenticação JWT',
   'Microsserviços em Go',
   'Streaming de dados com Kafka',
   'Front-end React profissional',
   'Banco de dados relacional',
   'Observabilidade em produção',
];

export function CreateTrailPage() {
   const navigate = useNavigate();
   const [topic, setTopic] = useState('');
   const [isSubmitting, setSubmitting] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (topic.trim().length < 3) {
         setError('Descreva o tema com pelo menos 3 caracteres.');
         return;
      }
      setSubmitting(true);
      setError(null);
      try {
         const trail = await learningTrailsApi.create({ topic: topic.trim() });
         navigate(`/trails/${trail.id}`, { replace: true });
      } catch (err) {
         if (err instanceof ApiError) {
            setError(err.message);
         } else {
            setError('Não conseguimos gerar a trilha agora. Tente novamente.');
         }
      } finally {
         setSubmitting(false);
      }
   };

   return (
      <>
         <PageTitle
            eyebrow="Nova trilha"
            title="O que você quer aprender?"
            description="Descreva o tema. A IA atua como um Staff Software Engineer mentor e desenha um projeto realista, decomposto em tickets estilo Jira."
         />

         <div className={styles.shell}>
            <section>
               <p className={styles.intro}>
                  Quanto mais específico for o tema, melhor o projeto resultante. Você
                  pode editar a trilha depois.
               </p>

               <form className={styles.form} onSubmit={handleSubmit} noValidate>
                  <Input
                     label="Tema"
                     placeholder="Ex.: APIs REST com FastAPI e PostgreSQL"
                     value={topic}
                     onChange={(event) => setTopic(event.target.value)}
                     error={error}
                     required
                     minLength={3}
                     maxLength={200}
                     autoFocus
                  />

                  <div className={styles.suggestionList} role="list" aria-label="Sugestões de tema">
                     {SUGGESTIONS.map((suggestion) => (
                        <button
                           key={suggestion}
                           type="button"
                           className={styles.suggestion}
                           onClick={() => setTopic(suggestion)}
                           role="listitem"
                        >
                           {suggestion}
                        </button>
                     ))}
                  </div>

                  <div>
                     <Button type="submit" variant="primary" isLoading={isSubmitting}>
                        Gerar trilha
                     </Button>
                  </div>
               </form>

               {isSubmitting && (
                  <div className={styles.loadingPanel}>
                     <Spinner label="O mentor está desenhando o projeto e os tickets..." />
                     <p>
                        A IA está estruturando um projeto realista, definindo conceitos
                        e ordenando os tickets. Isso pode levar alguns segundos.
                     </p>
                  </div>
               )}
            </section>

            <aside className={styles.tips} aria-label="Dicas para um bom tema">
               <h3>Como descrever um bom tema</h3>
               <ul>
                  <li>Inclua a tecnologia principal (ex.: <em>FastAPI</em>).</li>
                  <li>Mencione o tipo de projeto (API, CLI, app web, scraper...).</li>
                  <li>Cite ferramentas ou padrões que quer praticar (TDD, Docker...).</li>
                  <li>Evite temas vagos como "programação" ou "tecnologia".</li>
               </ul>
            </aside>
         </div>
      </>
   );
}
