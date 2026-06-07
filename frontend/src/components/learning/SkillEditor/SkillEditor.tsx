import { useId, useState, type FormEvent } from 'react';
import type { ProficiencyLabel, ProficiencyLevel, SkillInput } from '../../../types/api';
import styles from './SkillEditor.module.css';

export interface SkillEditorEntry {
   id?: number;
   name: string;
   proficiency: ProficiencyLevel;
   proficiency_label?: ProficiencyLabel;
}

export interface SkillEditorProps {
   /** Skills atualmente listadas. */
   skills: SkillEditorEntry[];
   /** Disparado quando o usuário pede para adicionar uma nova skill. */
   onAdd(payload: SkillInput): void | Promise<void>;
   /** Disparado ao alterar a proficiência de uma skill existente. */
   onChangeProficiency?(skill: SkillEditorEntry, next: ProficiencyLevel): void | Promise<void>;
   /** Disparado ao remover uma skill. */
   onRemove(skill: SkillEditorEntry): void | Promise<void>;
   /** Bloqueia interações enquanto uma operação assíncrona acontece. */
   isBusy?: boolean;
   /** Mensagem de erro a renderizar abaixo do formulário. */
   error?: string | null;
}

const SHORT_LABELS: Record<ProficiencyLevel, string> = {
   1: 'novice',
   2: 'beginner',
   3: 'intermediate',
   4: 'advanced',
};

const HELP_LABELS: Record<ProficiencyLevel, string> = {
   1: 'novice — já ouvi falar',
   2: 'beginner — já mexi um pouco',
   3: 'intermediate — uso confortavelmente',
   4: 'advanced — domino o tópico',
};

const LEVEL_CLASS: Record<ProficiencyLevel, string> = {
   1: styles.level1,
   2: styles.level2,
   3: styles.level3,
   4: styles.level4,
};

const LEVELS: ProficiencyLevel[] = [1, 2, 3, 4];

export function SkillEditor({
   skills,
   onAdd,
   onChangeProficiency,
   onRemove,
   isBusy = false,
   error,
}: SkillEditorProps) {
   const inputId = useId();
   const levelId = useId();
   const [name, setName] = useState('');
   const [proficiency, setProficiency] = useState<ProficiencyLevel>(2);
   const [localError, setLocalError] = useState<string | null>(null);

   const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLocalError(null);
      const trimmed = name.trim();
      if (!trimmed) {
         setLocalError('Informe uma tecnologia ou conceito.');
         return;
      }
      if (skills.some((skill) => skill.name.toLowerCase() === trimmed.toLowerCase())) {
         setLocalError('Você já adicionou essa skill.');
         return;
      }
      await onAdd({ name: trimmed, proficiency });
      setName('');
      setProficiency(2);
   };

   const handleProficiency = async (skill: SkillEditorEntry, raw: string) => {
      const next = Number(raw) as ProficiencyLevel;
      if (!LEVELS.includes(next)) return;
      await onChangeProficiency?.(skill, next);
   };

   const message = localError ?? error;

   return (
      <div className={styles.shell}>
         <form className={styles.composer} onSubmit={handleAdd} noValidate aria-label="Adicionar skill">
            <label htmlFor={inputId} className="visually-hidden">
               Tecnologia ou conceito
            </label>
            <input
               id={inputId}
               className={styles.input}
               value={name}
               onChange={(event) => setName(event.target.value)}
               placeholder="ex.: Python, Docker, TDD"
               maxLength={120}
               disabled={isBusy}
               autoComplete="off"
            />
            <label htmlFor={levelId} className="visually-hidden">
               Nível
            </label>
            <select
               id={levelId}
               className={styles.select}
               value={proficiency}
               onChange={(event) =>
                  setProficiency(Number(event.target.value) as ProficiencyLevel)
               }
               disabled={isBusy}
               aria-label="Nível"
               title={HELP_LABELS[proficiency]}
            >
               {LEVELS.map((value) => (
                  <option key={value} value={value}>
                     {SHORT_LABELS[value]}
                  </option>
               ))}
            </select>
            <button
               type="submit"
               className={styles.addBtn}
               disabled={isBusy}
               aria-label="Adicionar skill"
            >
               Adicionar
            </button>
         </form>

         {message ? (
            <span className={styles.error} role="alert">
               {message}
            </span>
         ) : skills.length === 0 ? (
            <span className={styles.hint}>
               Você ainda não adicionou nenhuma skill — comece pelas que mais domina.
            </span>
         ) : null}

         {skills.length > 0 && (
            <ul className={styles.list}>
               {skills.map((skill, index) => {
                  const key = skill.id ?? `${skill.name}-${index}`;
                  return (
                     <li
                        key={key}
                        className={`${styles.chip} ${LEVEL_CLASS[skill.proficiency]}`}
                     >
                        <span className={styles.chipName}>{skill.name}</span>
                        <span className={styles.chipDivider} aria-hidden="true" />
                        {onChangeProficiency ? (
                           <span className={styles.chipLevel}>
                              <select
                                 className={styles.chipLevelSelect}
                                 value={skill.proficiency}
                                 onChange={(event) =>
                                    handleProficiency(skill, event.target.value)
                                 }
                                 disabled={isBusy}
                                 aria-label={`Alterar nível de ${skill.name}`}
                                 title={HELP_LABELS[skill.proficiency]}
                              >
                                 {LEVELS.map((value) => (
                                    <option key={value} value={value}>
                                       {SHORT_LABELS[value]}
                                    </option>
                                 ))}
                              </select>
                              <span className={styles.chipLevelLabel} aria-hidden="true">
                                 {SHORT_LABELS[skill.proficiency]}
                              </span>
                           </span>
                        ) : (
                           <span
                              className={styles.chipLevelStatic}
                              aria-label={`Nível ${SHORT_LABELS[skill.proficiency]}`}
                           >
                              {SHORT_LABELS[skill.proficiency]}
                           </span>
                        )}
                        <button
                           type="button"
                           className={styles.chipRemove}
                           onClick={() => onRemove(skill)}
                           disabled={isBusy}
                           aria-label={`Remover ${skill.name}`}
                           title={`Remover ${skill.name}`}
                        >
                           ×
                        </button>
                     </li>
                  );
               })}
            </ul>
         )}
      </div>
   );
}
