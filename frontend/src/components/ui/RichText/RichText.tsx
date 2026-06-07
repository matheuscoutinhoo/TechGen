import { type ReactNode } from 'react';
import type { GlossaryEntry } from '../../../types/api';
import { GlossaryTerm } from '../GlossaryTerm';
import styles from './RichText.module.css';

export interface RichTextProps {
   /** Texto com markdown leve: **negrito**, ==marca-texto== e `código inline`. */
   children: string;
   /** Elemento HTML wrapper (default: span para inline em listas). */
   as?: 'span' | 'p' | 'div';
   className?: string;
   /**
    * Quando fornecido, a PRIMEIRA ocorrência de cada termo (case-insensitive,
    * com word boundary) é envolvida num GlossaryTerm clicável. Termos já
    * marcados internamente por outro estilo (negrito, código, etc.) não são
    * reescritos.
    */
   glossary?: GlossaryEntry[];
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
export function RichText({
   children,
   as = 'span',
   className,
   glossary,
}: RichTextProps) {
   const nodes = renderInline(children, glossary);
   const classes = [styles.text, className].filter(Boolean).join(' ');
   if (as === 'p') return <p className={classes}>{nodes}</p>;
   if (as === 'div') return <div className={classes}>{nodes}</div>;
   return <span className={classes}>{nodes}</span>;
}

// Ordem importa: regex testadas da mais específica/longa para a mais simples.
// Cada match vira um nó React; o resto é texto.
const TOKEN_RE =
   /(\*\*([^*\n]+?)\*\*)|(==([^=\n]+?)==)|(`([^`\n]+?)`)/g;

function escapeRegex(value: string): string {
   return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Encontra a primeira ocorrência (com word boundary, ci) de qualquer termo. */
function findGlossaryMatch(
   text: string,
   glossary: GlossaryEntry[],
   alreadyUsed: Set<string>,
): { index: number; length: number; entry: GlossaryEntry; matched: string } | null {
   let best: { index: number; length: number; entry: GlossaryEntry; matched: string } | null = null;
   for (const entry of glossary) {
      const key = entry.term.toLowerCase();
      if (alreadyUsed.has(key)) continue;
      const pattern = new RegExp(`\\b${escapeRegex(entry.term)}\\b`, 'i');
      const m = pattern.exec(text);
      if (m && (best === null || m.index < best.index)) {
         best = { index: m.index, length: m[0].length, entry, matched: m[0] };
      }
   }
   return best;
}

function splitGlossary(
   text: string,
   glossary: GlossaryEntry[] | undefined,
   alreadyUsed: Set<string>,
   keyPrefix: string,
): ReactNode[] {
   if (!glossary || glossary.length === 0) return [text];
   const out: ReactNode[] = [];
   let remaining = text;
   let offset = 0;
   while (remaining.length > 0) {
      const hit = findGlossaryMatch(remaining, glossary, alreadyUsed);
      if (!hit) {
         out.push(remaining);
         break;
      }
      if (hit.index > 0) out.push(remaining.slice(0, hit.index));
      alreadyUsed.add(hit.entry.term.toLowerCase());
      out.push(
         <GlossaryTerm
            key={`${keyPrefix}-g-${offset + hit.index}`}
            term={hit.entry.term}
            brief={renderInline(hit.entry.brief)}
         >
            {hit.matched}
         </GlossaryTerm>,
      );
      const consumed = hit.index + hit.length;
      remaining = remaining.slice(consumed);
      offset += consumed;
   }
   return out;
}

function renderInline(input: string, glossary?: GlossaryEntry[]): ReactNode[] {
   // alreadyUsed é compartilhado por TODA a string renderizada: cada termo
   // do glossário aparece como tooltip apenas uma vez nesta passagem.
   const alreadyUsed = new Set<string>();
   const tokens: ReactNode[] = [];
   let lastIndex = 0;
   let key = 0;
   for (const match of input.matchAll(TOKEN_RE)) {
      const start = match.index ?? 0;
      if (start > lastIndex) {
         const segment = input.slice(lastIndex, start);
         tokens.push(
            ...splitGlossary(segment, glossary, alreadyUsed, `seg${key}`),
         );
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
      const segment = input.slice(lastIndex);
      tokens.push(
         ...splitGlossary(segment, glossary, alreadyUsed, `tail${key}`),
      );
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
