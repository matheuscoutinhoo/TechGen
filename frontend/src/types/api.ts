export interface User {
   id: number;
   name: string;
   email: string;
   avatar_url?: string | null;
   created_at: string;
   updated_at: string;
}

export type ProficiencyLevel = 1 | 2 | 3 | 4;
export type ProficiencyLabel = 'novice' | 'beginner' | 'intermediate' | 'advanced';

export interface Skill {
   id: number;
   name: string;
   proficiency: ProficiencyLevel;
   proficiency_label: ProficiencyLabel;
   created_at: string;
   updated_at: string;
}

export interface SkillInput {
   name: string;
   proficiency: ProficiencyLevel;
}

export interface AuthResponse {
   access_token: string;
   token_type: string;
   user: User;
}

export interface TicketTask {
   description: string;
}

export interface Ticket {
   code: string;
   title: string;
   objective: string;
   personalization_notes?: string | null;
   concepts: string[];
   tasks: TicketTask[];
   acceptance_criteria: string[];
   estimated_effort?: string | null;
   /** Timestamp (ISO) de quando o aluno marcou o ticket como concluído. */
   completed_at?: string | null;
}

export interface TrailContent {
   project_title: string;
   project_summary: string;
   why_realistic: string;
   target_audience: string;
   prerequisites: string[];
   /** Artefato concreto que o aluno terá ao concluir o último ticket. */
   final_deliverable?: string;
   /**
    * Skills genéricas (já abstraídas pela IA) que entram/elevam no perfil
    * ao concluir a trilha. Ex.: ["python", "api rest", "autenticação"].
    * Vazio em trilhas geradas antes do campo existir.
    */
   skill_categories?: string[];
   tickets: Ticket[];
}

export interface LearningTrail {
   id: number;
   topic: string;
   title: string;
   summary: string;
   content: TrailContent;
   completed_at: string | null;
   created_at: string;
   updated_at: string;
}

export interface LearningTrailSummary {
   id: number;
   topic: string;
   title: string;
   summary: string;
   completed_at: string | null;
   ticket_count: number;
   completed_ticket_count: number;
   created_at: string;
   updated_at: string;
}

export interface ConceptExample {
   title: string;
   description: string;
   code?: string | null;
}

export interface GlossaryEntry {
   term: string;
   brief: string;
}

export interface ConceptExplanation {
   concept: string;
   definition: string;
   why_it_matters: string;
   patterns: string[];
   examples: ConceptExample[];
   hands_on_steps: string[];
   tips: string[];
   pitfalls: string[];
   further_reading: string[];
   glossary: GlossaryEntry[];
}

export interface CompleteTicketResponse {
   trail: LearningTrail;
   /** True na transição 0% → 100% (auto-conclusão). */
   trail_completed: boolean;
   /** Skills adicionadas no perfil (só preenchido se trail_completed). */
   added_concepts: string[];
   /** Skills elevadas (só preenchido se trail_completed). */
   upgraded_concepts: string[];
}

export interface TopicQuestionOption {
   id: string;
   label: string;
}

export interface TopicQuestion {
   id: string;
   question: string;
   rationale: string;
   options: TopicQuestionOption[];
}

export interface TopicAnswer {
   question_id: string;
   question: string;
   answer: string;
}

export interface TopicNextQuestionResponse {
   question: TopicQuestion | null;
   done: boolean;
}

/**
 * Modo de criação de trilha.
 * - `topic`: aluno descreve um tema; a IA propõe o projeto inteiro.
 * - `project`: aluno descreve o escopo do projeto + as tecnologias que
 *   quer aprender no caminho.
 */
export type TrailCreationMode = 'topic' | 'project';

export interface ApiErrorPayload {
   error: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
   };
}
