import type { HTMLAttributes } from 'react';
import styles from './PageContainer.module.css';

export interface PageContainerProps extends HTMLAttributes<HTMLElement> {
   width?: 'narrow' | 'base' | 'wide';
}

export function PageContainer({
   width = 'base',
   className,
   children,
   ...rest
}: PageContainerProps) {
   const classes = [
      styles.container,
      width === 'narrow' ? styles.narrow : '',
      width === 'wide' ? styles.wide : '',
      className ?? '',
   ]
      .filter(Boolean)
      .join(' ');

   return (
      <main id="conteudo" className={classes} {...rest}>
         {children}
      </main>
   );
}
