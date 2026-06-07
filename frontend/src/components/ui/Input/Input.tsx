import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
   label: string;
   hint?: string;
   error?: string | null;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
   { label, hint, error, id, className, ...rest },
   ref,
) {
   const autoId = useId();
   const inputId = id ?? `input-${autoId}`;
   const hintId = hint ? `${inputId}-hint` : undefined;
   const errorId = error ? `${inputId}-error` : undefined;
   const wrapperClasses = [styles.field, error ? styles.error : '', className ?? '']
      .filter(Boolean)
      .join(' ');

   return (
      <div className={wrapperClasses}>
         <label className={styles.label} htmlFor={inputId}>
            {label}
         </label>
         <input
            ref={ref}
            id={inputId}
            className={styles.input}
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
