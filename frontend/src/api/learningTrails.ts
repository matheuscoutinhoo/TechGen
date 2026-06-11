import { apiClient } from './client';
import type {
   CompleteTicketResponse,
   ConceptExplanation,
   LearningTrail,
   LearningTrailSummary,
   TopicAnswer,
   TopicNextQuestionResponse,
   TrailCreationMode,
} from '../types/api';

/**
 * Payload de criação de trilha.
 *
 * - Modo `topic`: campo `topic` obrigatório.
 * - Modo `project`: campos `project_scope` e `technologies` obrigatórios.
 *
 * A validação real é do backend (Pydantic). Aqui mantemos os campos
 * opcionais para permitir tipos discriminados sem fricção.
 */
export interface CreateTrailPayload {
   mode?: TrailCreationMode;
   topic?: string;
   project_scope?: string;
   technologies?: string[];
   assessment?: TopicAnswer[];
}

export const learningTrailsApi = {
   list: () => apiClient.get<LearningTrailSummary[]>('/learning-trails'),
   get: (id: number) => apiClient.get<LearningTrail>(`/learning-trails/${id}`),
   create: (payload: CreateTrailPayload) =>
      apiClient.post<LearningTrail>('/learning-trails', {
         mode: payload.mode ?? 'topic',
         ...(payload.topic !== undefined ? { topic: payload.topic } : {}),
         ...(payload.project_scope !== undefined
            ? { project_scope: payload.project_scope }
            : {}),
         ...(payload.technologies !== undefined
            ? { technologies: payload.technologies }
            : {}),
         assessment: payload.assessment ?? [],
      }),
   nextAssessmentQuestion: (topic: string, previousAnswers: TopicAnswer[]) =>
      apiClient.post<TopicNextQuestionResponse>(
         '/learning-trails/assessment/next',
         { topic, previous_answers: previousAnswers },
      ),
   nextProjectAssessmentQuestion: (
      projectScope: string,
      technologies: string[],
      previousAnswers: TopicAnswer[],
   ) =>
      apiClient.post<TopicNextQuestionResponse>(
         '/learning-trails/assessment/project/next',
         {
            project_scope: projectScope,
            technologies,
            previous_answers: previousAnswers,
         },
      ),
   regenerate: (id: number) =>
      apiClient.post<LearningTrail>(`/learning-trails/${id}/regenerate`),
   delete: (id: number) => apiClient.del<void>(`/learning-trails/${id}`),
   /**
    * Marca um ticket como concluído. Quando o último ticket é marcado, a
    * trilha auto-conclui e `trail_completed=true` + `added_concepts`/
    * `upgraded_concepts` vêm preenchidos.
    */
   completeTicket: (id: number, ticketCode: string) =>
      apiClient.post<CompleteTicketResponse>(
         `/learning-trails/${id}/tickets/${encodeURIComponent(ticketCode)}/complete`,
      ),
   /** Desfaz a conclusão de um ticket; "desconclui" a trilha se for o caso. */
   uncompleteTicket: (id: number, ticketCode: string) =>
      apiClient.del<CompleteTicketResponse>(
         `/learning-trails/${id}/tickets/${encodeURIComponent(ticketCode)}/complete`,
      ),
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
