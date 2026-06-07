export interface User {
   id: number;
   name: string;
   email: string;
   created_at: string;
   updated_at: string;
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
   created_at: string;
   updated_at: string;
}

export interface LearningTrailSummary {
   id: number;
   topic: string;
   title: string;
   summary: string;
   created_at: string;
   updated_at: string;
}

export interface ApiErrorPayload {
   error: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
   };
}
