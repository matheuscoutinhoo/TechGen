import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RegisterPage } from './RegisterPage';
import { AuthProvider } from '../../contexts/AuthContext';
import { tokenStorage } from '../../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

function renderRegister() {
   return render(
      <MemoryRouter initialEntries={['/register']}>
         <AuthProvider>
            <Routes>
               <Route path="/register" element={<RegisterPage />} />
               <Route path="/dashboard" element={<div>dashboard ok</div>} />
            </Routes>
         </AuthProvider>
      </MemoryRouter>,
   );
}

describe('<RegisterPage />', () => {
   beforeEach(() => {
      tokenStorage.clear();
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
   });

   it('cria conta e navega para dashboard', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse(
            {
               access_token: 'jwt',
               token_type: 'bearer',
               user: {
                  id: 1,
                  name: 'Ada',
                  email: 'ada@example.com',
                  created_at: '2025-01-01T00:00:00Z',
                  updated_at: '2025-01-01T00:00:00Z',
               },
            },
            201,
         ),
      ) as unknown as typeof fetch;

      renderRegister();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText('Nome'), 'Ada');
      await user.type(screen.getByLabelText('Email'), 'ada@example.com');
      await user.type(screen.getByLabelText('Senha'), 'supersecret');
      await user.type(screen.getByLabelText('Confirme a senha'), 'supersecret');
      await user.click(screen.getByRole('button', { name: 'Criar conta' }));

      await waitFor(() => expect(screen.getByText('dashboard ok')).toBeInTheDocument());
      expect(tokenStorage.get()).toBe('jwt');
   });

   it('valida senhas que não coincidem antes de enviar', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      renderRegister();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText('Nome'), 'Ada');
      await user.type(screen.getByLabelText('Email'), 'ada@example.com');
      await user.type(screen.getByLabelText('Senha'), 'supersecret');
      await user.type(screen.getByLabelText('Confirme a senha'), 'outra-coisa-1');
      await user.click(screen.getByRole('button', { name: 'Criar conta' }));

      expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
   });

   it('mostra erro do backend em conflito', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse(
            { error: { code: 'CONFLICT', message: 'Já existe uma conta com este email' } },
            409,
         ),
      ) as unknown as typeof fetch;

      renderRegister();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText('Nome'), 'Ada');
      await user.type(screen.getByLabelText('Email'), 'ada@example.com');
      await user.type(screen.getByLabelText('Senha'), 'supersecret');
      await user.type(screen.getByLabelText('Confirme a senha'), 'supersecret');
      await user.click(screen.getByRole('button', { name: 'Criar conta' }));

      await waitFor(() =>
         expect(screen.getByText('Já existe uma conta com este email')).toBeInTheDocument(),
      );
   });
});
