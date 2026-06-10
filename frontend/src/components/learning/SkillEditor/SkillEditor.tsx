import {
   useEffect,
   useId,
   useRef,
   useState,
   type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
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
   1: 'já ouvi falar',
   2: 'já mexi um pouco',
   3: 'uso confortavelmente',
   4: 'domino o tópico',
};

const LEVEL_CLASS: Record<ProficiencyLevel, string> = {
   1: styles.level1,
   2: styles.level2,
   3: styles.level3,
   4: styles.level4,
};

const LEVELS: ProficiencyLevel[] = [1, 2, 3, 4];

interface LevelSelectProps {
   value: ProficiencyLevel;
   onChange(next: ProficiencyLevel): void;
   ariaLabel: string;
   disabled?: boolean;
}

/**
 * Listbox custom de nível. Substitui o `<select>` nativo (que no Windows
 * ignora estilos de `option` e abre com tema do SO).
 */
function LevelSelect({ value, onChange, ariaLabel, disabled }: LevelSelectProps) {
   const wrapperRef = useRef<HTMLSpanElement | null>(null);
   const triggerRef = useRef<HTMLButtonElement | null>(null);
   const listboxId = useId();
   const [open, setOpen] = useState(false);
   const [activeIndex, setActiveIndex] = useState(() =>
      Math.max(0, LEVELS.indexOf(value)),
   );

   useEffect(() => {
      if (!open) return;
      setActiveIndex(Math.max(0, LEVELS.indexOf(value)));

      const handlePointerDown = (event: PointerEvent) => {
         if (
            wrapperRef.current &&
            event.target instanceof Node &&
            !wrapperRef.current.contains(event.target)
         ) {
            setOpen(false);
         }
      };
      document.addEventListener('pointerdown', handlePointerDown);
      return () => document.removeEventListener('pointerdown', handlePointerDown);
   }, [open, value]);

   const close = () => {
      setOpen(false);
      triggerRef.current?.focus();
   };

   const commit = (level: ProficiencyLevel) => {
      onChange(level);
      close();
   };

   const handleTriggerKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
         event.preventDefault();
         setOpen(true);
      } else if (event.key === 'Escape') {
         setOpen(false);
      }
   };

   const handleListKey = (event: ReactKeyboardEvent<HTMLUListElement>) => {
      if (event.key === 'ArrowDown') {
         event.preventDefault();
         setActiveIndex((idx) => (idx + 1) % LEVELS.length);
      } else if (event.key === 'ArrowUp') {
         event.preventDefault();
         setActiveIndex((idx) => (idx - 1 + LEVELS.length) % LEVELS.length);
      } else if (event.key === 'Home') {
         event.preventDefault();
         setActiveIndex(0);
      } else if (event.key === 'End') {
         event.preventDefault();
         setActiveIndex(LEVELS.length - 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
         event.preventDefault();
         commit(LEVELS[activeIndex]);
      } else if (event.key === 'Escape' || event.key === 'Tab') {
         event.preventDefault();
         close();
      }
   };

   return (
      <span className={styles.levelWrapper} ref={wrapperRef}>
         <button
            ref={triggerRef}
            type="button"
            className={
               open
                  ? `${styles.levelTrigger} ${styles.levelTriggerOpen}`
                  : styles.levelTrigger
            }
            onClick={() => setOpen((value) => !value)}
            onKeyDown={handleTriggerKey}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-label={ariaLabel}
            title={`${SHORT_LABELS[value]} — ${HELP_LABELS[value]}`}
         >
            {SHORT_LABELS[value]}
         </button>
         {open && (
            <ul
               id={listboxId}
               className={styles.levelPopup}
               role="listbox"
               tabIndex={-1}
               aria-activedescendant={`${listboxId}-${activeIndex}`}
               ref={(node) => {
                  // Focar a lista quando ela aparece, sem perder controle de teclado.
                  if (node) node.focus();
               }}
               onKeyDown={handleListKey}
            >
               {LEVELS.map((level, idx) => {
                  const selected = level === value;
                  const active = idx === activeIndex;
                  const className = [
                     styles.levelOption,
                     selected ? styles.levelOptionSelected : '',
                     active ? styles.levelOptionActive : '',
                     LEVEL_CLASS[level],
                  ]
                     .filter(Boolean)
                     .join(' ');
                  return (
                     <li
                        id={`${listboxId}-${idx}`}
                        key={level}
                        role="option"
                        aria-selected={selected}
                        className={className}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => commit(level)}
                     >
                        <span className={styles.levelOptionDot} aria-hidden="true" />
                        <span className={styles.levelOptionLabel}>
                           {SHORT_LABELS[level]}
                        </span>
                        <span className={styles.levelOptionHint}>
                           {HELP_LABELS[level]}
                        </span>
                     </li>
                  );
               })}
            </ul>
         )}
      </span>
   );
}

export function SkillEditor({
   skills,
   onAdd,
   onChangeProficiency,
   onRemove,
   isBusy = false,
   error,
}: SkillEditorProps) {
   const inputId = useId();
   const [name, setName] = useState('');
   const [proficiency, setProficiency] = useState<ProficiencyLevel>(2);
   const [localError, setLocalError] = useState<string | null>(null);

   // IMPORTANTE: este componente é usado dentro de outros <form>s (Register,
   // Account). Por isso a área de adicionar é um <div>, não um <form> — forms
   // aninhados são inválidos em HTML e fariam o botão acionar o form externo.
   const handleAdd = async () => {
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

   const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
         event.preventDefault();
         void handleAdd();
      }
   };

   const message = localError ?? error;

   return (
      <div className={styles.shell}>
         <div className={styles.composer} role="group" aria-label="Adicionar skill">
            <label htmlFor={inputId} className="visually-hidden">
               Tecnologia ou conceito
            </label>
            <input
               id={inputId}
               className={styles.input}
               value={name}
               onChange={(event) => setName(event.target.value)}
               onKeyDown={handleKeyDown}
               placeholder="ex.: Python, Docker, TDD"
               maxLength={120}
               disabled={isBusy}
               autoComplete="off"
            />
            <span className={`${styles.composerLevel} ${LEVEL_CLASS[proficiency]}`}>
               <LevelSelect
                  value={proficiency}
                  onChange={setProficiency}
                  ariaLabel="Nível"
                  disabled={isBusy}
               />
            </span>
            <button
               type="button"
               className={styles.addBtn}
               disabled={isBusy}
               onClick={() => void handleAdd()}
               aria-label="Adicionar skill"
            >
               Adicionar
            </button>
         </div>

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
                           <LevelSelect
                              value={skill.proficiency}
                              onChange={(next) => void onChangeProficiency(skill, next)}
                              ariaLabel={`Alterar nível de ${skill.name}`}
                              disabled={isBusy}
                           />
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
