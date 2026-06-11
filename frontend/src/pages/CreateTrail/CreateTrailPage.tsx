import {
   useState,
   type FormEvent,
   type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { learningTrailsApi } from '../../api/learningTrails';
import { ApiError } from '../../api/client';
import { AssessmentModal } from '../../components/learning/AssessmentModal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageTitle } from '../../components/ui/PageTitle';
import { Spinner } from '../../components/ui/Spinner';
import { TextArea } from '../../components/ui/TextArea';
import type {
   TopicAnswer,
   TopicQuestion,
   TrailCreationMode,
} from '../../types/api';
import styles from './CreateTrail.module.css';

const TOPIC_SUGGESTIONS = [
   'FastAPI com autenticação JWT',
   'Microsserviços em Go',
   'Streaming de dados com Kafka',
   'Front-end React profissional',
   'Banco de dados relacional',
   'Observabilidade em produção',
];

const TECH_SUGGESTIONS = [
   'FastAPI',
   'PostgreSQL',
   'React',
   'TypeScript',
   'Docker',
   'Redis',
   'Node.js',
];

type Phase = 'idle' | 'loading-questions' | 'answering' | 'generating';

/** Resumo curto do escopo, usado como rótulo no AssessmentModal. */
function shortProjectLabel(scope: string): string {
   const trimmed = scope.trim();
   if (!trimmed) return 'este projeto';
   const firstSentence = trimmed.split('.', 1)[0].trim();
   const candidate = firstSentence.length > 0 ? firstSentence : trimmed;
   return candidate.length > 80 ? `${candidate.slice(0, 77).trimEnd()}...` : candidate;
}

export function CreateTrailPage() {
   const navigate = useNavigate();
   const [mode, setMode] = useState<TrailCreationMode>('topic');
   const [topic, setTopic] = useState('');
   const [projectScope, setProjectScope] = useState('');
   const [technologies, setTechnologies] = useState<string[]>([]);
   const [techInput, setTechInput] = useState('');
   const [phase, setPhase] = useState<Phase>('idle');
   const [firstQuestion, setFirstQuestion] = useState<TopicQuestion | null>(null);
   const [error, setError] = useState<string | null>(null);

   const isBusy = phase !== 'idle';

   const switchMode = (next: TrailCreationMode) => {
      if (isBusy || next === mode) return;
      setMode(next);
      setError(null);
   };

   const addTechnology = (raw: string) => {
      const cleaned = raw.trim();
      if (!cleaned) return;
      const exists = technologies.some(
         (tech) => tech.toLowerCase() === cleaned.toLowerCase(),
      );
      if (exists) {
         setTechInput('');
         return;
      }
      setTechnologies([...technologies, cleaned]);
      setTechInput('');
   };

   const removeTechnology = (tech: string) => {
      setTechnologies(technologies.filter((t) => t !== tech));
   };

   const handleTechKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' || event.key === ',') {
         event.preventDefault();
         addTechnology(techInput);
      }
   };

   const generateTrail = async (assessment: TopicAnswer[]) => {
      setPhase('generating');
      try {
         const trail =
            mode === 'project'
               ? await learningTrailsApi.create({
                  mode: 'project',
                  project_scope: projectScope.trim(),
                  technologies,
                  assessment,
               })
               : await learningTrailsApi.create({
                  mode: 'topic',
                  topic: topic.trim(),
                  assessment,
               });
         navigate(`/trails/${trail.id}`, { replace: true });
      } catch (err) {
         setPhase('idle');
         setFirstQuestion(null);
         if (err instanceof ApiError) {
            setError(err.message);
         } else {
            setError('Não conseguimos gerar a trilha agora. Tente novamente.');
         }
      }
   };

   const fetchFirstQuestion = async () => {
      if (mode === 'project') {
         return learningTrailsApi.nextProjectAssessmentQuestion(
            projectScope.trim(),
            technologies,
            [],
         );
      }
      return learningTrailsApi.nextAssessmentQuestion(topic.trim(), []);
   };

   const loadNextQuestion = (history: TopicAnswer[]) => {
      if (mode === 'project') {
         return learningTrailsApi.nextProjectAssessmentQuestion(
            projectScope.trim(),
            technologies,
            history,
         );
      }
      return learningTrailsApi.nextAssessmentQuestion(topic.trim(), history);
   };

   const validateInputs = (): string | null => {
      if (mode === 'topic') {
         if (topic.trim().length < 3) {
            return 'Descreva o tema com pelo menos 3 caracteres.';
         }
         return null;
      }
      if (projectScope.trim().length < 20) {
         return 'Descreva o escopo do projeto com pelo menos 20 caracteres.';
      }
      if (technologies.length === 0) {
         return 'Adicione pelo menos uma tecnologia que você quer aprender.';
      }
      return null;
   };

   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const validationError = validateInputs();
      if (validationError) {
         setError(validationError);
         return;
      }
      setError(null);
      setPhase('loading-questions');
      try {
         const result = await fetchFirstQuestion();
         if (result.done || !result.question) {
            // IA decidiu pular o diagnóstico (caso raro) → gera direto.
            await generateTrail([]);
            return;
         }
         setFirstQuestion(result.question);
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
      setFirstQuestion(null);
   };

   const showLoadingPanel = phase === 'loading-questions' || phase === 'generating';
   const loadingLabel =
      phase === 'loading-questions'
         ? 'O mentor está preparando a primeira pergunta...'
         : 'O mentor está desenhando o projeto e os tickets...';
   const loadingHint =
      phase === 'loading-questions'
         ? 'A IA vai te entrevistar de forma adaptativa — cada resposta calibra a próxima pergunta.'
         : 'Suas respostas estão guiando a quebra dos tickets, os conceitos abordados e os pré-requisitos cobertos. Isso pode levar alguns segundos.';

   const pageDescription =
      mode === 'project'
         ? 'Descreva o projeto que quer construir e as tecnologias que quer praticar. A IA monta a trilha em volta disso e cobre pré-requisitos quando o projeto exigir.'
         : 'Descreva o tema. A IA atua como um Staff Software Engineer mentor e desenha um projeto realista, decomposto em tickets estilo Jira.';

   const introMessage =
      mode === 'project'
         ? 'Conte o que você quer construir e quais tecnologias quer praticar. A IA não fica refém da stack — adiciona o que o projeto precisar.'
         : 'Quanto mais específico for o tema, melhor o projeto resultante. Você pode editar a trilha depois.';

   const assessmentTopic =
      mode === 'project' ? shortProjectLabel(projectScope) : topic.trim();

   return (
      <>
         <PageTitle
            eyebrow="Nova trilha"
            title="O que você quer aprender?"
            description={pageDescription}
         />

         <div className={styles.shell}>
            <section>
               <div
                  className={styles.modeToggle}
                  role="group"
                  aria-label="Modo de criação"
               >
                  <button
                     type="button"
                     className={
                        mode === 'topic'
                           ? `${styles.modeButton} ${styles.modeButtonActive}`
                           : styles.modeButton
                     }
                     aria-pressed={mode === 'topic'}
                     onClick={() => switchMode('topic')}
                     disabled={isBusy}
                  >
                     <span className={styles.modeButtonTitle}>Por tema</span>
                     <span className={styles.modeButtonHint}>
                        A IA propõe o projeto
                     </span>
                  </button>
                  <button
                     type="button"
                     className={
                        mode === 'project'
                           ? `${styles.modeButton} ${styles.modeButtonActive}`
                           : styles.modeButton
                     }
                     aria-pressed={mode === 'project'}
                     onClick={() => switchMode('project')}
                     disabled={isBusy}
                  >
                     <span className={styles.modeButtonTitle}>Por projeto</span>
                     <span className={styles.modeButtonHint}>
                        Você define o que construir
                     </span>
                  </button>
               </div>

               <p className={styles.intro}>{introMessage}</p>

               <form className={styles.form} onSubmit={handleSubmit} noValidate>
                  {mode === 'topic' ? (
                     <>
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

                        <div
                           className={styles.suggestionList}
                           role="list"
                           aria-label="Sugestões de tema"
                        >
                           {TOPIC_SUGGESTIONS.map((suggestion) => (
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
                     </>
                  ) : (
                     <>
                        <TextArea
                           label="Escopo do projeto"
                           placeholder="Ex.: Plataforma onde pessoas cadastram livros usados para doação. Tem login, busca por título/autor e dashboard com ranking dos doadores do mês."
                           value={projectScope}
                           onChange={(event) => setProjectScope(event.target.value)}
                           hint="Descreva o que o projeto faz, para quem é e quais fluxos principais ele tem. Mínimo de 20 caracteres."
                           required
                           minLength={20}
                           maxLength={2000}
                           rows={5}
                           autoFocus
                           disabled={isBusy}
                        />

                        <div className={styles.techField}>
                           <label
                              htmlFor="tech-input"
                              className={styles.techLabel}
                           >
                              Tecnologias que quer aprender
                           </label>
                           <div className={styles.techComposer}>
                              <input
                                 id="tech-input"
                                 className={styles.techInput}
                                 placeholder="Ex.: FastAPI, React, PostgreSQL"
                                 value={techInput}
                                 onChange={(event) => setTechInput(event.target.value)}
                                 onKeyDown={handleTechKeyDown}
                                 maxLength={80}
                                 disabled={isBusy}
                                 autoComplete="off"
                              />
                              <button
                                 type="button"
                                 className={styles.techAddBtn}
                                 onClick={() => addTechnology(techInput)}
                                 disabled={isBusy || techInput.trim().length === 0}
                              >
                                 Adicionar
                              </button>
                           </div>
                           <span className={styles.techHint}>
                              Pressione Enter ou clique em Adicionar. A IA pode incluir
                              outras tecnologias se o projeto exigir.
                           </span>

                           {technologies.length > 0 && (
                              <ul
                                 className={styles.techChips}
                                 aria-label="Tecnologias selecionadas"
                              >
                                 {technologies.map((tech) => (
                                    <li key={tech} className={styles.techChip}>
                                       <span>{tech}</span>
                                       <button
                                          type="button"
                                          className={styles.techChipRemove}
                                          onClick={() => removeTechnology(tech)}
                                          disabled={isBusy}
                                          aria-label={`Remover ${tech}`}
                                          title={`Remover ${tech}`}
                                       >
                                          ×
                                       </button>
                                    </li>
                                 ))}
                              </ul>
                           )}

                           <div
                              className={styles.suggestionList}
                              role="list"
                              aria-label="Sugestões de tecnologia"
                           >
                              {TECH_SUGGESTIONS.map((suggestion) => (
                                 <button
                                    key={suggestion}
                                    type="button"
                                    className={styles.suggestion}
                                    onClick={() => addTechnology(suggestion)}
                                    disabled={isBusy}
                                    role="listitem"
                                 >
                                    + {suggestion}
                                 </button>
                              ))}
                           </div>

                           {error && (
                              <span className={styles.techError} role="alert">
                                 {error}
                              </span>
                           )}
                        </div>
                     </>
                  )}

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

            <aside className={styles.tips} aria-label="Dicas">
               <header className={styles.tipsHeader}>
                  <span className={styles.tipsEyebrow}>Dicas</span>
                  <h3>
                     {mode === 'project'
                        ? 'Como descrever um bom projeto'
                        : 'Como descrever um bom tema'}
                  </h3>
               </header>
               {mode === 'project' ? (
                  <ul>
                     <li>
                        Diga em <em>uma frase</em> o que o projeto faz e para quem.
                     </li>
                     <li>Liste os fluxos principais (login, busca, dashboard...).</li>
                     <li>
                        Cite restrições reais (multi-usuário, dados sensíveis, deploy).
                     </li>
                     <li>
                        Liste apenas tecnologias que você QUER aprender — a IA cobre
                        o resto.
                     </li>
                  </ul>
               ) : (
                  <ul>
                     <li>
                        Inclua a tecnologia principal (ex.: <em>FastAPI</em>).
                     </li>
                     <li>Mencione o tipo de projeto (API, CLI, app web, scraper...).</li>
                     <li>
                        Cite ferramentas ou padrões que quer praticar (TDD, Docker...).
                     </li>
                     <li>Evite temas vagos como "programação" ou "tecnologia".</li>
                  </ul>
               )}
            </aside>
         </div>

         {(phase === 'answering' || phase === 'generating') && firstQuestion && (
            <AssessmentModal
               topic={assessmentTopic}
               firstQuestion={firstQuestion}
               loadNextQuestion={loadNextQuestion}
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
