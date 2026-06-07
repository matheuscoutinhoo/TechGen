import { useCallback, useEffect, useState } from 'react';
import { skillsApi } from '../api/skills';
import { ApiError } from '../api/client';
import type { Skill } from '../types/api';

interface UseSkillsResult {
   skills: Skill[];
   isLoading: boolean;
   error: ApiError | null;
   refetch(): Promise<void>;
}

export function useSkills(): UseSkillsResult {
   const [skills, setSkills] = useState<Skill[]>([]);
   const [isLoading, setLoading] = useState(true);
   const [error, setError] = useState<ApiError | null>(null);

   const refetch = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         const data = await skillsApi.list();
         setSkills(data);
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

   return { skills, isLoading, error, refetch };
}
