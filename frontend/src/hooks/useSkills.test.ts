import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSkills } from './useSkills';
import { tokenStorage } from '../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

describe('useSkills', () => {
   beforeEach(() => {
      tokenStorage.set('jwt');
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
   });

   it('carrega skills no mount', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse([
            {
               id: 1,
               name: 'fastapi',
               proficiency: 3,
               proficiency_label: 'intermediate',
               created_at: '2025-01-01T00:00:00Z',
               updated_at: '2025-01-01T00:00:00Z',
            },
         ]),
      ) as unknown as typeof fetch;

      const { result } = renderHook(() => useSkills());

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.skills).toHaveLength(1);
      expect(result.current.skills[0].name).toBe('fastapi');
      expect(result.current.error).toBeNull();
   });

   it('expõe erro em caso de falha', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse({ error: { code: 'AUTH_ERROR', message: 'sem token' } }, 401),
      ) as unknown as typeof fetch;

      const { result } = renderHook(() => useSkills());

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error?.status).toBe(401);
      expect(result.current.skills).toEqual([]);
   });
});
