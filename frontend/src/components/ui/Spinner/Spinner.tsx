import styles from './Spinner.module.css';

export interface SpinnerProps {
   label?: string;
}

export function Spinner({ label = 'Carregando...' }: SpinnerProps) {
   return (
      <span className={styles.spinner} role="status" aria-live="polite">
         <span className={styles.circle} aria-hidden="true" />
         <span>{label}</span>
      </span>
   );
}
