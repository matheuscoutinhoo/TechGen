import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AICredentialEditor } from './AICredentialEditor';
import { tokenStorage } from '../../../utils/storage';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
   });
}

const NOT_CONFIGURED = {
   configured: false,
   provider: null,
   model: null,
   base_url: null,
   key_masked: null,
   updated_at: null,
};

const CONFIGURED = {
   configured: true,
   provider: 'openai',
   model: 'gpt-4o',
   base_url: null,
   key_masked: '••••1234',
   updated_at: '2025-01-01T00:00:00Z',
};

describe('<AICredentialEditor />', () => {
   beforeEach(() => {
      tokenStorage.set('jwt');
   });

   afterEach(() => {
      vi.restoreAllMocks();
      globalThis.fetch = ORIGINAL_FETCH;
      tokenStorage.clear();
   });

   it('mostra o formulário vazio quando não há credencial', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse(NOT_CONFIGURED),
      ) as unknown as typeof fetch;

      render(<AICredentialEditor />);

      await waitFor(() => expect(screen.getByLabelText('API key')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Salvar chave' })).toBeInTheDocument();
      expect(screen.queryByText('Configurada')).not.toBeInTheDocument();
   });

   it('exibe estado configurado com a chave mascarada', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
         jsonResponse(CONFIGURED),
      ) as unknown as typeof fetch;

      render(<AICredentialEditor />);

      await waitFor(() => expect(screen.getByText('Configurada')).toBeInTheDocument());
      expect(screen.getByText(/••••1234/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Atualizar chave' })).toBeInTheDocument();
   });

   it('valida chave curta sem chamar o backend', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(NOT_CONFIGURED));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      render(<AICredentialEditor />);
      await waitFor(() => expect(screen.getByLabelText('API key')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.type(screen.getByLabelText('API key'), 'short');
      await user.click(screen.getByRole('button', { name: 'Salvar chave' }));

      expect(screen.getByText(/mínimo 8 caracteres/i)).toBeInTheDocument();
      // Apenas o GET inicial; nenhum PUT foi disparado.
      expect(fetchMock).toHaveBeenCalledTimes(1);
   });

   it('salva a credencial e mostra feedback de sucesso', async () => {
      const saved = {
         configured: true,
         provider: 'openai',
         model: null,
         base_url: null,
         key_masked: '••••cdef',
         updated_at: '2025-01-01T00:00:00Z',
      };
      const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
         if (init?.method === 'PUT') return Promise.resolve(jsonResponse(saved));
         return Promise.resolve(jsonResponse(NOT_CONFIGURED));
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      render(<AICredentialEditor />);
      await waitFor(() => expect(screen.getByLabelText('API key')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.selectOptions(screen.getByLabelText('Provedor'), 'openai');
      await user.type(screen.getByLabelText('API key'), 'sk-abcdef1234');
      await user.click(screen.getByRole('button', { name: 'Salvar chave' }));

      await waitFor(() => expect(screen.getByText(/Credencial salva/)).toBeInTheDocument());

      const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(putCall).toBeTruthy();
      const body = JSON.parse((putCall![1] as RequestInit).body as string);
      expect(body).toMatchObject({ provider: 'openai', api_key: 'sk-abcdef1234' });
   });

   it('remove a credencial existente', async () => {
      const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
         if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
         return Promise.resolve(jsonResponse(CONFIGURED));
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      render(<AICredentialEditor />);
      await waitFor(() => expect(screen.getByText('Configurada')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Remover' }));

      await waitFor(() => expect(screen.getByText(/Credencial removida/)).toBeInTheDocument());
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
   });
});
