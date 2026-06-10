import styles from './Avatar.module.css';

export interface AvatarProps {
   name: string;
   src?: string | null;
   /** Tamanho em px. Default = 36. */
   size?: number;
   /** Renderiza com aro/glow primary (uso destacado). */
   featured?: boolean;
   /** Para uso em botões/links — define cursor + microinteração de hover. */
   interactive?: boolean;
}

function initialsFrom(name: string): string {
   const parts = name.trim().split(/\s+/).filter(Boolean);
   if (parts.length === 0) return '?';
   if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
   return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
   name,
   src,
   size = 36,
   featured = false,
   interactive = false,
}: AvatarProps) {
   const initials = initialsFrom(name);
   const className = [
      styles.avatar,
      featured ? styles.featured : '',
      interactive ? styles.interactive : '',
      !src ? styles.placeholder : '',
   ]
      .filter(Boolean)
      .join(' ');

   const style = {
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.max(11, size * 0.36)}px`,
   } as React.CSSProperties;

   return (
      <span className={className} style={style}>
         {src ? (
            <img src={src} alt={`Foto de ${name}`} className={styles.image} />
         ) : (
            <span className={styles.initials} aria-label={`Iniciais de ${name}`}>
               {initials}
            </span>
         )}
      </span>
   );
}
