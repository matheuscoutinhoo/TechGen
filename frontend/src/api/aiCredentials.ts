import { apiClient } from './client';
import type { AICredentialStatus, AICredentialUpsert } from '../types/api';

/**
 * Cliente da API de credenciais de IA (BYOK). A chave só é enviada via `save`
 * (PUT) e nunca retorna em texto puro — `get` devolve apenas metadados + máscara.
 */
export const aiCredentialsApi = {
   get: () => apiClient.get<AICredentialStatus>('/ai-credentials'),
   save: (payload: AICredentialUpsert) =>
      apiClient.put<AICredentialStatus>('/ai-credentials', payload),
   remove: () => apiClient.del<void>('/ai-credentials'),
};
