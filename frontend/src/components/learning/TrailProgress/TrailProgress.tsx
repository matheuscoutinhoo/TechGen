import styles from './TrailProgress.module.css';

export interface TrailProgressProps {
   completed: number;
   total: number;
   variant?: 'detailed' | 'compact';
   label?: string;
}

export function TrailProgress({
   completed,
   total,
   variant = 'detailed',
   label,
}: TrailProgressProps) {
   const safeTotal = Math.max(total, 0);
   const safeCompleted = Math.min(Math.max(completed, 0), safeTotal);
   const percent = safeTotal === 0 ? 0 : Math.round((safeCompleted / safeTotal) * 100);
   const isDone = safeTotal > 0 && safeCompleted === safeTotal;
   const wrapperClass = `${styles.wrapper} ${
      variant === 'compact' ? styles.compact : styles.detailed
   }`;
   const fillClass = isDone ? `${styles.fill} ${styles.fillDone}` : styles.fill;
   const valueClass = isDone
      ? `${styles.headerValue} ${styles.headerValueDone}`
      : styles.headerValue;
   const headerLabel = label ?? (variant === 'compact' ? 'Progresso' : 'Tickets concluídos');

   return (
      <div className={wrapperClass}>
         <div className={styles.header}>
            <span className={styles.headerLabel}>{headerLabel}</span>
            <span className={valueClass} aria-live="polite">
               {safeCompleted}/{safeTotal} · {percent}%
            </span>
         </div>
         <div
            className={styles.track}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${headerLabel}: ${safeCompleted} de ${safeTotal}`}
         >
            <span
               className={fillClass}
               style={{ ['--progress' as string]: `${percent}%` }}
            />
         </div>
      </div>
   );
}
