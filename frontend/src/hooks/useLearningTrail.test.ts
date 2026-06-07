import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLearningTrail } from './useLearningTrail';
import { tokenStorage } from '../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

const TRAIL = {
   id: 1,
   topic: 'FastAPI',
   title: 'Projeto FastAPI',
   summary: 'Resumo',
   created_at: '2025-01-01T00:00:00Z',
   updated_at: '2025-01-01T00:00:00Z',
   content: {
      project_title: 'Projeto FastAPI',
      project_summary: 'Resumo',
      why_realistic: 'real',
      target_audience: 'dev',
      prerequisites: [],
      tickets: [],
   },
};

describe('useLearningTrail', () => {
   beforeEach(() => {
      tokenStorage.set('jwt');
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
   });

   it('quando id é null, expõe trail=null e não chama o backend', async () => {
      const mock = vi.fn();
      globalThis.fetch = mock as unknown as typeof fetch;

      const { result } = renderHook(() => useLearningTrail(null));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.trail).toBeNull();
      expect(mock).not.toHaveBeenCalled();
   });

   it('carrega trilha quando id fornecido', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(TRAIL)) as unknown as typeof fetch;

      const { result } = renderHook(() => useLearningTrail(1));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.trail?.id).toBe(1);
      expect(result.current.error).toBeNull();
   });

   it('expõe erro quando backend falha', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse({ error: { code: 'NOT_FOUND', message: 'Não existe' } }, 404),
      ) as unknown as typeof fetch;

      const { result } = renderHook(() => useLearningTrail(999));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.trail).toBeNull();
      expect(result.current.error?.status).toBe(404);
   });
});
