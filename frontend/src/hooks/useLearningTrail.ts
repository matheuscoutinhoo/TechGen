import { useCallback, useEffect, useState } from 'react';
import { learningTrailsApi } from '../api/learningTrails';
import { ApiError } from '../api/client';
import type { LearningTrail } from '../types/api';

interface UseLearningTrailResult {
   trail: LearningTrail | null;
   isLoading: boolean;
   error: ApiError | null;
   refetch(): Promise<void>;
   setTrail(trail: LearningTrail): void;
}

export function useLearningTrail(id: number | null): UseLearningTrailResult {
   const [trail, setTrail] = useState<LearningTrail | null>(null);
   const [isLoading, setLoading] = useState(true);
   const [error, setError] = useState<ApiError | null>(null);

   const refetch = useCallback(async () => {
      if (id === null) {
         setTrail(null);
         setLoading(false);
         return;
      }
      setLoading(true);
      setError(null);
      try {
         const data = await learningTrailsApi.get(id);
         setTrail(data);
      } catch (err) {
         if (err instanceof ApiError) {
            setError(err);
         } else {
            setError(new ApiError('Erro inesperado', 0, 'UNKNOWN'));
         }
      } finally {
         setLoading(false);
      }
   }, [id]);

   useEffect(() => {
      void refetch();
   }, [refetch]);

   return { trail, isLoading, error, refetch, setTrail };
}
