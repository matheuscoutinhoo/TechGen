export interface User {
   id: number;
   name: string;
   email: string;
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
}

export interface TrailContent {
   project_title: string;
   project_summary: string;
   why_realistic: string;
   target_audience: string;
   prerequisites: string[];
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

export interface CompleteTrailResponse {
   trail: LearningTrail;
   added_concepts: string[];
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

export interface TopicQuestionSet {
   topic: string;
   questions: TopicQuestion[];
}

export interface TopicAnswer {
   question_id: string;
   question: string;
   answer: string;
}

export interface ApiErrorPayload {
   error: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
   };
}
