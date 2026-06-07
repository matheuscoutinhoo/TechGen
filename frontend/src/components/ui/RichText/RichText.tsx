import { type ReactNode } from 'react';
import styles from './RichText.module.css';

export interface RichTextProps {
   /** Texto com markdown leve: **negrito**, ==marca-texto== e `código inline`. */
   children: string;
   /** Elemento HTML wrapper (default: span para inline em listas). */
   as?: 'span' | 'p' | 'div';
   className?: string;
}

/**
 * Renderiza um subconjunto seguro de markdown inline.
 *
 * Suporta APENAS:
 *  - **negrito**        → <strong>
 *  - ==marca-texto==    → <mark>
 *  - `código inline`    → <code>
 *
 * Tudo o que não casa com esses padrões é renderizado como texto puro pelo
 * React (escape automático). Isso fecha o vetor de XSS — não há nunca
 * `dangerouslySetInnerHTML`.
 */
export function RichText({ children, as = 'span', className }: RichTextProps) {
   const nodes = renderInline(children);
   const classes = [styles.text, className].filter(Boolean).join(' ');
   if (as === 'p') return <p className={classes}>{nodes}</p>;
   if (as === 'div') return <div className={classes}>{nodes}</div>;
   return <span className={classes}>{nodes}</span>;
}

// Ordem importa: regex testadas da mais específica/longa para a mais simples.
// Cada match vira um nó React; o resto é texto.
const TOKEN_RE =
   /(\*\*([^*\n]+?)\*\*)|(==([^=\n]+?)==)|(`([^`\n]+?)`)/g;

function renderInline(input: string): ReactNode[] {
   const tokens: ReactNode[] = [];
   let lastIndex = 0;
   let key = 0;
   for (const match of input.matchAll(TOKEN_RE)) {
      const start = match.index ?? 0;
      if (start > lastIndex) {
         tokens.push(input.slice(lastIndex, start));
      }
      const [, bold, boldInner, mark, markInner, code, codeInner] = match;
      if (bold) {
         tokens.push(<strong key={key++}>{boldInner}</strong>);
      } else if (mark) {
         tokens.push(<mark key={key++}>{markInner}</mark>);
      } else if (code) {
         tokens.push(<code key={key++}>{codeInner}</code>);
      }
      lastIndex = start + match[0].length;
   }
   if (lastIndex < input.length) {
      tokens.push(input.slice(lastIndex));
   }
   // Em texto longo pode haver quebras de linha — preservamos como <br />.
   const result: ReactNode[] = [];
   tokens.forEach((token, i) => {
      if (typeof token !== 'string') {
         result.push(token);
         return;
      }
      const lines = token.split('\n');
      lines.forEach((line, j) => {
         if (line) result.push(line);
         if (j < lines.length - 1) result.push(<br key={`br-${i}-${j}`} />);
      });
   });
   return result;
}

export const __test__ = { renderInline };
