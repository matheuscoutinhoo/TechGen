import { useState, type FormEvent } from 'react';
import type { ProficiencyLabel, ProficiencyLevel, SkillInput } from '../../../types/api';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
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

const LEVEL_LABELS: Record<ProficiencyLevel, string> = {
   1: 'Já ouvi falar',
   2: 'Já mexi um pouco',
   3: 'Uso confortavelmente',
   4: 'Domino o tópico',
};

const SHORT_LABELS: Record<ProficiencyLevel, string> = {
   1: 'novice',
   2: 'beginner',
   3: 'intermediate',
   4: 'advanced',
};

const LEVEL_CLASS: Record<ProficiencyLevel, string> = {
   1: styles.level1,
   2: styles.level2,
   3: styles.level3,
   4: styles.level4,
};

export function SkillEditor({
   skills,
   onAdd,
   onChangeProficiency,
   onRemove,
   isBusy = false,
   error,
}: SkillEditorProps) {
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

   const handleProficiency = async (
      skill: SkillEditorEntry,
      raw: string,
   ) => {
      const next = Number(raw) as ProficiencyLevel;
      if (![1, 2, 3, 4].includes(next)) return;
      await onChangeProficiency?.(skill, next);
   };

   return (
      <div className={styles.shell}>
         <form className={styles.add} onSubmit={handleAdd} noValidate>
            <Input
               label="Tecnologia ou conceito"
               value={name}
               onChange={(event) => setName(event.target.value)}
               placeholder="ex.: Python, Docker, TDD"
               maxLength={120}
               disabled={isBusy}
            />
            <div className={styles.field}>
               <label className={styles.label} htmlFor="skill-proficiency">
                  Nível
               </label>
               <select
                  id="skill-proficiency"
                  className={styles.select}
                  value={proficiency}
                  onChange={(event) => setProficiency(Number(event.target.value) as ProficiencyLevel)}
                  disabled={isBusy}
               >
                  {([1, 2, 3, 4] as ProficiencyLevel[]).map((value) => (
                     <option key={value} value={value}>
                        {value} — {LEVEL_LABELS[value]}
                     </option>
                  ))}
               </select>
            </div>
            <Button type="submit" variant="secondary" isLoading={isBusy}>
               Adicionar
            </Button>
         </form>

         {(localError || error) && (
            <span className={styles.error} role="alert">
               {localError ?? error}
            </span>
         )}

         {skills.length === 0 ? (
            <p className={styles.empty}>
               Você ainda não adicionou nenhuma skill. Comece com aquelas que você mais
               domina — a IA usará isso para calibrar suas trilhas.
            </p>
         ) : (
            <ul className={styles.list}>
               {skills.map((skill, index) => (
                  <li key={skill.id ?? `${skill.name}-${index}`} className={styles.item}>
                     <span className={styles.name}>{skill.name}</span>
                     <span
                        className={`${styles.level} ${LEVEL_CLASS[skill.proficiency]}`}
                        aria-label={`Nível ${skill.proficiency} — ${SHORT_LABELS[skill.proficiency]}`}
                     >
                        <span className={styles.levelDot} aria-hidden="true" />
                        {SHORT_LABELS[skill.proficiency]}
                     </span>
                     <div className={styles.itemActions}>
                        {onChangeProficiency && (
                           <select
                              className={styles.itemSelect}
                              value={skill.proficiency}
                              onChange={(event) => handleProficiency(skill, event.target.value)}
                              aria-label={`Alterar nível de ${skill.name}`}
                              disabled={isBusy}
                           >
                              {([1, 2, 3, 4] as ProficiencyLevel[]).map((value) => (
                                 <option key={value} value={value}>
                                    {value} — {SHORT_LABELS[value]}
                                 </option>
                              ))}
                           </select>
                        )}
                        <Button
                           type="button"
                           variant="ghost"
                           onClick={() => onRemove(skill)}
                           disabled={isBusy}
                           aria-label={`Remover ${skill.name}`}
                        >
                           Remover
                        </Button>
                     </div>
                  </li>
               ))}
            </ul>
         )}
      </div>
   );
}
