import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AuthProvider } from '../../../contexts/AuthContext';
import { tokenStorage } from '../../../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

function renderWithAuth(initialPath: string) {
   return render(
      <MemoryRouter initialEntries={[initialPath]}>
         <AuthProvider>
            <Routes>
               <Route path="/login" element={<div>login screen</div>} />
               <Route
                  path="/private"
                  element={
                     <ProtectedRoute>
                        <div>conteúdo privado</div>
                     </ProtectedRoute>
                  }
               />
            </Routes>
         </AuthProvider>
      </MemoryRouter>,
   );
}

describe('<ProtectedRoute />', () => {
   beforeEach(() => {
      tokenStorage.clear();
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
   });

   it('redireciona para /login quando não autenticado', async () => {
      renderWithAuth('/private');
      await waitFor(() => expect(screen.getByText('login screen')).toBeInTheDocument());
   });

   it('renderiza children quando autenticado', async () => {
      tokenStorage.set('jwt');
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse({
            id: 1,
            name: 'Ada',
            email: 'ada@example.com',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
         }),
      ) as unknown as typeof fetch;

      renderWithAuth('/private');
      await waitFor(() => expect(screen.getByText('conteúdo privado')).toBeInTheDocument());
   });
});
