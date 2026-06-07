import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AccountPage } from './AccountPage';
import { AuthProvider } from '../../contexts/AuthContext';
import { tokenStorage } from '../../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

const USER = {
   id: 1,
   name: 'Ada Lovelace',
   email: 'ada@example.com',
   created_at: '2025-01-01T00:00:00Z',
   updated_at: '2025-01-02T00:00:00Z',
};

function renderAccount() {
   return render(
      <MemoryRouter initialEntries={['/account']}>
         <AuthProvider>
            <Routes>
               <Route path="/account" element={<AccountPage />} />
               <Route path="/" element={<div>home ok</div>} />
            </Routes>
         </AuthProvider>
      </MemoryRouter>,
   );
}

describe('<AccountPage />', () => {
   beforeEach(() => {
      tokenStorage.set('jwt');
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
      tokenStorage.clear();
   });

   it('preenche os campos com os dados do usuário', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(USER)) as unknown as typeof fetch;

      renderAccount();
      await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveValue('Ada Lovelace'));
      expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
   });

   it('atualiza o perfil e mostra feedback de sucesso', async () => {
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
         if (init?.method === 'PATCH') {
            return Promise.resolve(jsonResponse({ ...USER, name: 'Ada Atualizada' }));
         }
         return Promise.resolve(jsonResponse(USER));
      }) as unknown as typeof fetch;

      renderAccount();
      await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveValue('Ada Lovelace'));

      const user = userEvent.setup();
      const nameInput = screen.getByLabelText('Nome');
      await user.clear(nameInput);
      await user.type(nameInput, 'Ada Atualizada');
      await user.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() =>
         expect(screen.getByText('Perfil atualizado com sucesso.')).toBeInTheDocument(),
      );
   });

   it('valida confirmação de senha antes de enviar', async () => {
      const fetchSpy = vi
         .fn()
         .mockImplementation(() => Promise.resolve(jsonResponse(USER))) as unknown as typeof fetch;
      globalThis.fetch = fetchSpy;

      renderAccount();
      await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveValue('Ada Lovelace'));

      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Senha atual'), 'oldsecret123');
      await user.type(screen.getByLabelText('Nova senha'), 'newsecret123');
      await user.type(screen.getByLabelText('Confirme a nova senha'), 'mismatched12');
      await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

      expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument();
   });

   it('exclui conta após confirmação e navega para a home', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
         if (init?.method === 'DELETE') {
            return Promise.resolve(new Response(null, { status: 204 }));
         }
         return Promise.resolve(jsonResponse(USER));
      }) as unknown as typeof fetch;

      renderAccount();
      await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveValue('Ada Lovelace'));

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Excluir minha conta' }));

      await waitFor(() => expect(screen.getByText('home ok')).toBeInTheDocument());
      expect(tokenStorage.get()).toBeNull();
   });
});
