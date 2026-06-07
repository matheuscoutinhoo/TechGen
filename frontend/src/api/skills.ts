import { apiClient } from './client';
import type { Skill, SkillInput, ProficiencyLevel } from '../types/api';

export const skillsApi = {
   list: () => apiClient.get<Skill[]>('/skills'),
   add: (payload: SkillInput) => apiClient.post<Skill>('/skills', payload),
   updateProficiency: (id: number, proficiency: ProficiencyLevel) =>
      apiClient.patch<Skill>(`/skills/${id}`, { proficiency }),
   delete: (id: number) => apiClient.del<void>(`/skills/${id}`),
};
