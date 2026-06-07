import type { ReactNode } from 'react';
import styles from './PageTitle.module.css';

export interface PageTitleProps {
   eyebrow?: string;
   title: string;
   description?: ReactNode;
}

export function PageTitle({ eyebrow, title, description }: PageTitleProps) {
   return (
      <header className={styles.header}>
         {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
         <h1 className={styles.title}>{title}</h1>
         {description && <p className={styles.description}>{description}</p>}
      </header>
   );
}
