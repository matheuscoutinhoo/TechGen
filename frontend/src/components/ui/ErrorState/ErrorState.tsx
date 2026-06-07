import type { ReactNode } from 'react';
import styles from './ErrorState.module.css';

export interface ErrorStateProps {
   title?: string;
   description: string;
   action?: ReactNode;
}

export function ErrorState({
   title = 'Algo deu errado',
   description,
   action,
}: ErrorStateProps) {
   return (
      <div className={styles.wrapper} role="alert">
         <h2 className={styles.title}>{title}</h2>
         <p className={styles.description}>{description}</p>
         {action}
      </div>
   );
}
