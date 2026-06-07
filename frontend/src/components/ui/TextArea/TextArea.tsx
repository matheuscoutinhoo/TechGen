import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import styles from './TextArea.module.css';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
   label: string;
   hint?: string;
   error?: string | null;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
   { label, hint, error, id, className, ...rest },
   ref,
) {
   const autoId = useId();
   const inputId = id ?? `textarea-${autoId}`;
   const hintId = hint ? `${inputId}-hint` : undefined;
   const errorId = error ? `${inputId}-error` : undefined;
   const wrapperClasses = [styles.field, error ? styles.error : '', className ?? '']
      .filter(Boolean)
      .join(' ');

   return (
      <div className={wrapperClasses}>
         <label htmlFor={inputId} className={styles.label}>
            {label}
         </label>
         <textarea
            ref={ref}
            id={inputId}
            className={styles.textarea}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
            {...rest}
         />
         {hint && !error && (
            <span id={hintId} className={styles.hint}>
               {hint}
            </span>
         )}
         {error && (
            <span id={errorId} className={styles.errorMessage} role="alert">
               {error}
            </span>
         )}
      </div>
   );
});
