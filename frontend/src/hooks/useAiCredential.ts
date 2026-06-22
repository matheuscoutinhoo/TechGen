import { useCallback, useEffect, useState } from 'react';
import { aiCredentialsApi } from '../api/aiCredentials';
import { ApiError } from '../api/client';
import type { AICredentialStatus, AICredentialUpsert } from '../types/api';

const NOT_CONFIGURED: AICredentialStatus = {
   configured: false,
   provider: null,
   model: null,
   base_url: null,
   key_masked: null,
   updated_at: null,
};

interface UseAiCredentialResult {
   status: AICredentialStatus;
   isLoading: boolean;
   error: ApiError | null;
   refetch(): Promise<void>;
   save(payload: AICredentialUpsert): Promise<void>;
   remove(): Promise<void>;
}

/**
 * Encapsula o estado da credencial de IA do usuário (BYOK). `save` e `remove`
 * propagam o erro para o chamador tratar (feedback inline), espelhando o
 * padrão das ações de skill na página de conta.
 */
export function useAiCredential(): UseAiCredentialResult {
   const [status, setStatus] = useState<AICredentialStatus>(NOT_CONFIGURED);
   const [isLoading, setLoading] = useState(true);
   const [error, setError] = useState<ApiError | null>(null);

   const refetch = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         const data = await aiCredentialsApi.get();
         setStatus(data);
      } catch (err) {
         setError(
            err instanceof ApiError ? err : new ApiError('Erro inesperado', 0, 'UNKNOWN'),
         );
      } finally {
         setLoading(false);
      }
   }, []);

   const save = useCallback(async (payload: AICredentialUpsert) => {
      const data = await aiCredentialsApi.save(payload);
      setStatus(data);
   }, []);

   const remove = useCallback(async () => {
      await aiCredentialsApi.remove();
      setStatus(NOT_CONFIGURED);
   }, []);

   useEffect(() => {
      void refetch();
   }, [refetch]);

   return { status, isLoading, error, refetch, save, remove };
}
