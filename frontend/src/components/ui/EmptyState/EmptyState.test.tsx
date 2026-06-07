import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('<EmptyState />', () => {
   it('mostra título', () => {
      render(<EmptyState title="Nada por aqui" />);
      expect(screen.getByRole('heading', { name: 'Nada por aqui' })).toBeInTheDocument();
   });

   it('mostra descrição quando fornecida', () => {
      render(<EmptyState title="x" description="comece criando algo" />);
      expect(screen.getByText('comece criando algo')).toBeInTheDocument();
   });

   it('renderiza ações no rodapé', () => {
      render(<EmptyState title="x" actions={<button type="button">Ir</button>} />);
      expect(screen.getByRole('button', { name: 'Ir' })).toBeInTheDocument();
   });
});
