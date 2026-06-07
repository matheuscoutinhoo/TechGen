import { useCallback, useEffect, useState } from 'react';
import { learningTrailsApi } from '../api/learningTrails';
import { ApiError } from '../api/client';
import type { LearningTrailSummary } from '../types/api';

interface UseLearningTrailsResult {
   trails: LearningTrailSummary[];
   isLoading: boolean;
   error: ApiError | null;
   refetch(): Promise<void>;
}

export function useLearningTrails(): UseLearningTrailsResult {
   const [trails, setTrails] = useState<LearningTrailSummary[]>([]);
   const [isLoading, setLoading] = useState(true);
   const [error, setError] = useState<ApiError | null>(null);

   const refetch = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         const data = await learningTrailsApi.list();
         setTrails(data);
      } catch (err) {
         if (err instanceof ApiError) {
            setError(err);
         } else {
            setError(new ApiError('Erro inesperado', 0, 'UNKNOWN'));
         }
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void refetch();
   }, [refetch]);

   return { trails, isLoading, error, refetch };
}
