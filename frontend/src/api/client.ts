import type { ApiErrorPayload } from '../types/api';
import { tokenStorage } from '../utils/storage';

const DEFAULT_BASE_URL = 'http://localhost:8000/api/v1';

const baseUrl = (
   (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL
).replace(/\/$/, '');

export class ApiError extends Error {
   readonly status: number;
   readonly code: string;
   readonly details?: Record<string, unknown>;

   constructor(message: string, status: number, code: string, details?: Record<string, unknown>) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.details = details;
   }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
   method?: Method;
   body?: unknown;
   signal?: AbortSignal;
   auth?: boolean;
}

/**
 * Handler global disparado quando uma chamada autenticada recebe 401.
 * O `AuthProvider` registra um callback que limpa o token e o usuário —
 * sem isso a sessão fica "fantasma": token expirado, mas a UI continua
 * renderizando rotas protegidas e estourando 401 em cada chamada.
 */
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
   unauthorizedHandler = handler;
}

async function parseErrorBody(response: Response): Promise<ApiErrorPayload | null> {
   try {
      return (await response.json()) as ApiErrorPayload;
   } catch {
      return null;
   }
}

export async function request<TResponse>(
   path: string,
   options: RequestOptions = {},
): Promise<TResponse> {
   const { method = 'GET', body, signal, auth = true } = options;
   const headers: Record<string, string> = {
      Accept: 'application/json',
   };

   if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
   }

   // Marca se a requisição foi enviada autenticada — só nesse caso 401
   // significa "token expirou/inválido". Sem isso, um 401 de login mal
   // sucedido também dispararia logout, que seria absurdo.
   let sentWithToken = false;
   if (auth) {
      const token = tokenStorage.get();
      if (token) {
         headers.Authorization = `Bearer ${token}`;
         sentWithToken = true;
      }
   }

   let response: Response;
   try {
      response = await fetch(`${baseUrl}${path}`, {
         method,
         headers,
         body: body !== undefined ? JSON.stringify(body) : undefined,
         signal,
      });
   } catch (cause) {
      throw new ApiError(
         'Não foi possível conectar ao servidor. Verifique sua conexão.',
         0,
         'NETWORK_ERROR',
         { cause: String(cause) },
      );
   }

   if (response.status === 204) {
      return undefined as TResponse;
   }

   if (!response.ok) {
      const errorBody = await parseErrorBody(response);
      const message = errorBody?.error?.message ?? `Erro ${response.status}`;
      const code = errorBody?.error?.code ?? 'HTTP_ERROR';
      if (response.status === 401 && sentWithToken && unauthorizedHandler) {
         // Sessão expirada: limpa token/usuário globalmente. Roteamento
         // protegido cuida do redirect pra /login.
         unauthorizedHandler();
      }
      throw new ApiError(message, response.status, code, errorBody?.error?.details);
   }

   return (await response.json()) as TResponse;
}

export const apiClient = {
   get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...options, method: 'GET' }),
   post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...options, method: 'POST', body }),
   patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...options, method: 'PATCH', body }),
   del: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...options, method: 'DELETE' }),
};
