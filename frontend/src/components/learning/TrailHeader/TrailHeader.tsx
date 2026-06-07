import type { LearningTrail } from '../../../types/api';
import styles from './TrailHeader.module.css';

export interface TrailHeaderProps {
   trail: LearningTrail;
}

export function TrailHeader({ trail }: TrailHeaderProps) {
   const { content } = trail;
   return (
      <header className={styles.wrapper}>
         <span className={styles.topic}>Tema: {trail.topic}</span>
         <h1 className={styles.title}>{trail.title}</h1>
         <p className={styles.summary}>{trail.summary}</p>

         <div className={styles.meta}>
            <div className={styles.metaItem}>
               <strong>Por que é realista</strong>
               {content.why_realistic}
            </div>
            <div className={styles.metaItem}>
               <strong>Público-alvo</strong>
               {content.target_audience}
            </div>
            {content.prerequisites.length > 0 && (
               <div className={styles.metaItem}>
                  <strong>Pré-requisitos</strong>
                  <div className={styles.prereqs}>
                     {content.prerequisites.map((p) => (
                        <span key={p} className={styles.prereqChip}>
                           {p}
                        </span>
                     ))}
                  </div>
               </div>
            )}
         </div>
      </header>
   );
}
