import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
   variant?: ButtonVariant;
   isLoading?: boolean;
   block?: boolean;
}

const variantClass: Record<ButtonVariant, string> = {
   primary: styles.primary,
   secondary: styles.secondary,
   ghost: styles.ghost,
   danger: styles.danger,
};

export function Button({
   variant = 'primary',
   isLoading = false,
   block = false,
   disabled,
   className,
   children,
   type = 'button',
   ...rest
}: ButtonProps) {
   const classes = [
      styles.button,
      variantClass[variant],
      block ? styles.block : '',
      isLoading ? styles.loading : '',
      className ?? '',
   ]
      .filter(Boolean)
      .join(' ');

   return (
      <button
         type={type}
         className={classes}
         disabled={disabled ?? isLoading}
         aria-busy={isLoading || undefined}
         {...rest}
      >
         {children}
      </button>
   );
}
