import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { learningTrailsApi } from '../../api/learningTrails';
import { ApiError } from '../../api/client';
import { AssessmentModal } from '../../components/learning/AssessmentModal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageTitle } from '../../components/ui/PageTitle';
import { Spinner } from '../../components/ui/Spinner';
import type { TopicAnswer, TopicQuestion } from '../../types/api';
import styles from './CreateTrail.module.css';

const SUGGESTIONS = [
   'FastAPI com autenticação JWT',
   'Microsserviços em Go',
   'Streaming de dados com Kafka',
   'Front-end React profissional',
   'Banco de dados relacional',
   'Observabilidade em produção',
];

type Phase = 'idle' | 'loading-questions' | 'answering' | 'generating';

export function CreateTrailPage() {
   const navigate = useNavigate();
   const [topic, setTopic] = useState('');
   const [phase, setPhase] = useState<Phase>('idle');
   const [questions, setQuestions] = useState<TopicQuestion[]>([]);
   const [error, setError] = useState<string | null>(null);

   const isBusy = phase !== 'idle';

   const generateTrail = async (assessment: TopicAnswer[]) => {
      setPhase('generating');
      try {
         const trail = await learningTrailsApi.create({
            topic: topic.trim(),
            assessment,
         });
         navigate(`/trails/${trail.id}`, { replace: true });
      } catch (err) {
         setPhase('idle');
         setQuestions([]);
         if (err instanceof ApiError) {
            setError(err.message);
         } else {
            setError('Não conseguimos gerar a trilha agora. Tente novamente.');
         }
      }
   };

   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (topic.trim().length < 3) {
         setError('Descreva o tema com pelo menos 3 caracteres.');
         return;
      }
      setError(null);
      setPhase('loading-questions');
      try {
         const result = await learningTrailsApi.buildAssessment(topic.trim());
         if (result.questions.length === 0) {
            await generateTrail([]);
            return;
         }
         setQuestions(result.questions);
         setPhase('answering');
      } catch (err) {
         setPhase('idle');
         if (err instanceof ApiError) {
            setError(err.message);
         } else {
            setError('Não conseguimos preparar o diagnóstico. Tente novamente.');
         }
      }
   };

   const handleCancelAssessment = () => {
      if (phase === 'generating') return;
      setPhase('idle');
      setQuestions([]);
   };

   const showLoadingPanel = phase === 'loading-questions' || phase === 'generating';
   const loadingLabel =
      phase === 'loading-questions'
         ? 'O mentor está preparando perguntas para entender seu nível...'
         : 'O mentor está desenhando o projeto e os tickets...';
   const loadingHint =
      phase === 'loading-questions'
         ? 'A IA vai te fazer até 5 perguntas curtas para calibrar a profundidade da trilha.'
         : 'Suas respostas estão guiando a quebra dos tickets, os conceitos abordados e os pré-requisitos cobertos. Isso pode levar alguns segundos.';

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
                     disabled={isBusy}
                  />

                  <div className={styles.suggestionList} role="list" aria-label="Sugestões de tema">
                     {SUGGESTIONS.map((suggestion) => (
                        <button
                           key={suggestion}
                           type="button"
                           className={styles.suggestion}
                           onClick={() => setTopic(suggestion)}
                           disabled={isBusy}
                           role="listitem"
                        >
                           {suggestion}
                        </button>
                     ))}
                  </div>

                  <div>
                     <Button type="submit" variant="primary" disabled={isBusy}>
                        {phase === 'loading-questions'
                           ? 'Preparando perguntas...'
                           : phase === 'generating'
                              ? 'Gerando...'
                              : 'Continuar'}
                     </Button>
                  </div>
               </form>

               {showLoadingPanel && (
                  <div className={styles.loadingPanel}>
                     <Spinner label={loadingLabel} />
                     <p>{loadingHint}</p>
                  </div>
               )}
            </section>

            <aside className={styles.tips} aria-label="Dicas para um bom tema">
               <header className={styles.tipsHeader}>
                  <span className={styles.tipsEyebrow}>Dicas</span>
                  <h3>Como descrever um bom tema</h3>
               </header>
               <ul>
                  <li>Inclua a tecnologia principal (ex.: <em>FastAPI</em>).</li>
                  <li>Mencione o tipo de projeto (API, CLI, app web, scraper...).</li>
                  <li>Cite ferramentas ou padrões que quer praticar (TDD, Docker...).</li>
                  <li>Evite temas vagos como "programação" ou "tecnologia".</li>
               </ul>
            </aside>
         </div>

         {(phase === 'answering' || phase === 'generating') && questions.length > 0 && (
            <AssessmentModal
               topic={topic.trim()}
               questions={questions}
               isSubmitting={phase === 'generating'}
               onSubmit={(answers) => {
                  void generateTrail(answers);
               }}
               onCancel={handleCancelAssessment}
            />
         )}
      </>
   );
}
