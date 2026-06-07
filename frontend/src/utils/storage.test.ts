import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStorage } from './storage';

describe('tokenStorage', () => {
   beforeEach(() => {
      localStorage.clear();
   });

   afterEach(() => {
      vi.restoreAllMocks();
      localStorage.clear();
   });

   it('persiste e recupera o token', () => {
      tokenStorage.set('abc');
      expect(tokenStorage.get()).toBe('abc');
   });

   it('limpa o token', () => {
      tokenStorage.set('abc');
      tokenStorage.clear();
      expect(tokenStorage.get()).toBeNull();
   });

   it('retorna null quando localStorage lança', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
         throw new Error('blocked');
      });
      expect(tokenStorage.get()).toBeNull();
   });

   it('absorve erro silenciosamente em set', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
         throw new Error('blocked');
      });
      expect(() => tokenStorage.set('x')).not.toThrow();
   });

   it('absorve erro silenciosamente em clear', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
         throw new Error('blocked');
      });
      expect(() => tokenStorage.clear()).not.toThrow();
   });
});
