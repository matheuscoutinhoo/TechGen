import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';

describe('<NotFoundPage />', () => {
   it('mostra título 404 e link para o início', () => {
      render(
         <MemoryRouter>
            <NotFoundPage />
         </MemoryRouter>,
      );
      expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Voltar para o início/ })).toBeInTheDocument();
   });
});
