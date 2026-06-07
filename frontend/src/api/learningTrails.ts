import { apiClient } from './client';
import type { LearningTrail, LearningTrailSummary, TrailContent } from '../types/api';

export interface CreateTrailPayload {
   topic: string;
}

export interface UpdateTrailPayload {
   title?: string;
   summary?: string;
   content?: TrailContent;
}

export const learningTrailsApi = {
   list: () => apiClient.get<LearningTrailSummary[]>('/learning-trails'),
   get: (id: number) => apiClient.get<LearningTrail>(`/learning-trails/${id}`),
   create: (payload: CreateTrailPayload) =>
      apiClient.post<LearningTrail>('/learning-trails', payload),
   update: (id: number, payload: UpdateTrailPayload) =>
      apiClient.patch<LearningTrail>(`/learning-trails/${id}`, payload),
   regenerate: (id: number) =>
      apiClient.post<LearningTrail>(`/learning-trails/${id}/regenerate`),
   delete: (id: number) => apiClient.del<void>(`/learning-trails/${id}`),
};
