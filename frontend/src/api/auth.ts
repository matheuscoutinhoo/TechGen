import { apiClient } from './client';
import type { AuthResponse, SkillInput } from '../types/api';

export interface RegisterPayload {
   name: string;
   email: string;
   password: string;
   skills?: SkillInput[];
}

export interface LoginPayload {
   email: string;
   password: string;
}

export const authApi = {
   register: (payload: RegisterPayload) =>
      apiClient.post<AuthResponse>('/auth/register', payload, { auth: false }),
   login: (payload: LoginPayload) =>
      apiClient.post<AuthResponse>('/auth/login', payload, { auth: false }),
};
