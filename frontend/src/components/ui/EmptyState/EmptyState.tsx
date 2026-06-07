import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
   title: string;
   description?: string;
   actions?: ReactNode;
}

export function EmptyState({ title, description, actions }: EmptyStateProps) {
   return (
      <div className={styles.wrapper}>
         <h2 className={styles.title}>{title}</h2>
         {description && <p className={styles.description}>{description}</p>}
         {actions && <div className={styles.actions}>{actions}</div>}
      </div>
   );
}
