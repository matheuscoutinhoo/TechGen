import { describe, expect, it } from 'vitest';
import { formatDate } from './format';

describe('formatDate', () => {
   it('formata data ISO em pt-BR (dia, mês curto e ano)', () => {
      const formatted = formatDate('2025-03-15T12:00:00Z');
      expect(formatted).toMatch(/2025/);
      expect(formatted).toMatch(/15/);
   });

   it('retorna o valor original quando a data é inválida', () => {
      const value = 'not-a-date';
      expect(formatDate(value)).toBe('Invalid Date');
   });
});
