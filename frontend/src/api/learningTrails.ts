import { apiClient } from './client';
import type {
   CompleteTrailResponse,
   ConceptExplanation,
   LearningTrail,
   LearningTrailSummary,
   TopicAnswer,
   TopicQuestionSet,
   TrailContent,
} from '../types/api';

export interface CreateTrailPayload {
   topic: string;
   assessment?: TopicAnswer[];
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
      apiClient.post<LearningTrail>('/learning-trails', {
         topic: payload.topic,
         assessment: payload.assessment ?? [],
      }),
   buildAssessment: (topic: string) =>
      apiClient.post<TopicQuestionSet>('/learning-trails/assessment', { topic }),
   update: (id: number, payload: UpdateTrailPayload) =>
      apiClient.patch<LearningTrail>(`/learning-trails/${id}`, payload),
   regenerate: (id: number) =>
      apiClient.post<LearningTrail>(`/learning-trails/${id}/regenerate`),
   delete: (id: number) => apiClient.del<void>(`/learning-trails/${id}`),
   complete: (id: number) =>
      apiClient.post<CompleteTrailResponse>(`/learning-trails/${id}/complete`),
   explainConcept: (
      id: number,
      ticketCode: string,
      concept: string,
      options: { refresh?: boolean } = {},
   ) => {
      const query = options.refresh ? '?refresh=true' : '';
      return apiClient.get<ConceptExplanation>(
         `/learning-trails/${id}/tickets/${encodeURIComponent(
            ticketCode,
         )}/concepts/${encodeURIComponent(concept)}${query}`,
      );
   },
};
