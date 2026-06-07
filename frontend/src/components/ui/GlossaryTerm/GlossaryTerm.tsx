import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from './GlossaryTerm.module.css';

export interface GlossaryTermProps {
   /** Texto exato como apareceu no original (preserva capitalização). */
   children: ReactNode;
   /** Termo canônico do glossário (case-insensitive). */
   term: string;
   /** Conteúdo do popover (pode ser texto com markdown já renderizado). */
   brief: ReactNode;
}

/**
 * Termo do glossário renderizado como botão com sublinhado tracejado e
 * popover sob demanda. Toggle por clique; fecha em Esc ou clique fora.
 */
export function GlossaryTerm({ children, term, brief }: GlossaryTermProps) {
   const [open, setOpen] = useState(false);
   const wrapRef = useRef<HTMLSpanElement>(null);
   const popoverId = useId();

   useEffect(() => {
      if (!open) return;
      const onKey = (event: KeyboardEvent) => {
         if (event.key === 'Escape') setOpen(false);
      };
      const onClick = (event: MouseEvent) => {
         if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
      };
      window.addEventListener('keydown', onKey);
      window.addEventListener('mousedown', onClick);
      return () => {
         window.removeEventListener('keydown', onKey);
         window.removeEventListener('mousedown', onClick);
      };
   }, [open]);

   return (
      <span ref={wrapRef} className={styles.wrap}>
         <button
            type="button"
            className={styles.trigger}
            aria-expanded={open}
            aria-describedby={open ? popoverId : undefined}
            onClick={() => setOpen((value) => !value)}
            title={`Ver explicação rápida de ${term}`}
         >
            {children}
         </button>
         {open && (
            <span
               id={popoverId}
               role="tooltip"
               className={styles.popover}
            >
               <span className={styles.popoverTerm}>{term}</span>
               <span className={styles.popoverBody}>{brief}</span>
            </span>
         )}
      </span>
   );
}
