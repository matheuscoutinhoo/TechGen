import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from './client';
import { tokenStorage } from '../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

describe('apiClient', () => {
   beforeEach(() => {
      tokenStorage.clear();
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
   });

   it('faz GET e retorna JSON tipado', async () => {
      const mock = vi.fn().mockResolvedValue(jsonResponse({ id: 1, name: 'Ada' }));
      globalThis.fetch = mock as unknown as typeof fetch;

      const data = await apiClient.get<{ id: number; name: string }>('/users/me');
      expect(data).toEqual({ id: 1, name: 'Ada' });
      expect(mock).toHaveBeenCalledOnce();
      const [url, init] = mock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/users\/me$/);
      expect(init.method).toBe('GET');
   });

   it('inclui o Bearer token quando há sessão', async () => {
      tokenStorage.set('jwt-token');
      const mock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      globalThis.fetch = mock as unknown as typeof fetch;

      await apiClient.get('/whatever');
      const [, init] = mock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer jwt-token');
   });

   it('omite o token quando auth=false', async () => {
      tokenStorage.set('jwt-token');
      const mock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      globalThis.fetch = mock as unknown as typeof fetch;

      await apiClient.post('/auth/login', {}, { auth: false });
      const [, init] = mock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
   });

   it('serializa o body como JSON em POST', async () => {
      const mock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
      globalThis.fetch = mock as unknown as typeof fetch;

      await apiClient.post('/things', { name: 'x' });
      const [, init] = mock.mock.calls[0] as [string, RequestInit];
      expect(init.body).toBe(JSON.stringify({ name: 'x' }));
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
   });

   it('lança ApiError com mensagem do backend em erro HTTP', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse(
            { error: { code: 'CONFLICT', message: 'Email já existe' } },
            409,
         ),
      ) as unknown as typeof fetch;

      await expect(apiClient.post('/auth/register', {})).rejects.toMatchObject({
         name: 'ApiError',
         status: 409,
         code: 'CONFLICT',
         message: 'Email já existe',
      });
   });

   it('lança NETWORK_ERROR quando fetch rejeita', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
      try {
         await apiClient.get('/anything');
         throw new Error('deveria ter falhado');
      } catch (error) {
         expect(error).toBeInstanceOf(ApiError);
         expect((error as ApiError).code).toBe('NETWORK_ERROR');
      }
   });

   it('204 retorna undefined sem erro', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 })) as unknown as typeof fetch;
      const result = await apiClient.del('/things/1');
      expect(result).toBeUndefined();
   });
});
