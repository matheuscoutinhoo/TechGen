import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';

describe('<HomePage />', () => {
   it('renderiza headline, CTAs e pilares', () => {
      render(
         <MemoryRouter>
            <HomePage />
         </MemoryRouter>,
      );
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/projetos reais/);
      expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Já tenho conta' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Projeto realista' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Tickets progressivos' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'TDD do início ao fim' })).toBeInTheDocument();
   });
});
