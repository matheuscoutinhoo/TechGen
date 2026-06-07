import { apiClient } from './client';
import type { User } from '../types/api';

export interface UpdateUserPayload {
   name?: string;
   email?: string;
}

export interface ChangePasswordPayload {
   current_password: string;
   new_password: string;
}

export const usersApi = {
   me: () => apiClient.get<User>('/users/me'),
   update: (payload: UpdateUserPayload) => apiClient.patch<User>('/users/me', payload),
   changePassword: (payload: ChangePasswordPayload) =>
      apiClient.post<void>('/users/me/password', payload),
   delete: () => apiClient.del<void>('/users/me'),
};
