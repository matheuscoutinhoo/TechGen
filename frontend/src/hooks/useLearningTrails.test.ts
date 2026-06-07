import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLearningTrails } from './useLearningTrails';
import { tokenStorage } from '../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

describe('useLearningTrails', () => {
   beforeEach(() => {
      tokenStorage.set('jwt');
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
   });

   it('carrega lista de trilhas no mount', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse([
            {
               id: 1,
               topic: 'FastAPI',
               title: 'Projeto FastAPI',
               summary: 'Resumo',
               created_at: '2025-01-01T00:00:00Z',
               updated_at: '2025-01-01T00:00:00Z',
            },
         ]),
      ) as unknown as typeof fetch;

      const { result } = renderHook(() => useLearningTrails());

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.trails).toHaveLength(1);
      expect(result.current.trails[0].title).toBe('Projeto FastAPI');
      expect(result.current.error).toBeNull();
   });

   it('expõe error em caso de falha HTTP', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse({ error: { code: 'AUTH_ERROR', message: 'sem token' } }, 401),
      ) as unknown as typeof fetch;

      const { result } = renderHook(() => useLearningTrails());

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.status).toBe(401);
      expect(result.current.trails).toEqual([]);
   });
});
