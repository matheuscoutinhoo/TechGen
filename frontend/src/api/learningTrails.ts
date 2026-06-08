import { apiClient } from './client';
import type {
   CompleteTrailResponse,
   ConceptExplanation,
   LearningTrail,
   LearningTrailSummary,
   TopicAnswer,
   TopicNextQuestionResponse,
} from '../types/api';

export interface CreateTrailPayload {
   topic: string;
   assessment?: TopicAnswer[];
}

export const learningTrailsApi = {
   list: () => apiClient.get<LearningTrailSummary[]>('/learning-trails'),
   get: (id: number) => apiClient.get<LearningTrail>(`/learning-trails/${id}`),
   create: (payload: CreateTrailPayload) =>
      apiClient.post<LearningTrail>('/learning-trails', {
         topic: payload.topic,
         assessment: payload.assessment ?? [],
      }),
   /**
    * Pede à IA a PRÓXIMA pergunta do diagnóstico, com o histórico atual.
    * A IA decide quando encerrar (response.done === true).
    */
   nextAssessmentQuestion: (topic: string, previousAnswers: TopicAnswer[]) =>
      apiClient.post<TopicNextQuestionResponse>(
         '/learning-trails/assessment/next',
         { topic, previous_answers: previousAnswers },
      ),
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
