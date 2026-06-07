import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorState } from './ErrorState';

describe('<ErrorState />', () => {
   it('renderiza com role alert', () => {
      render(<ErrorState description="Algo falhou" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
   });

   it('usa título padrão quando não informado', () => {
      render(<ErrorState description="x" />);
      expect(screen.getByRole('heading', { name: 'Algo deu errado' })).toBeInTheDocument();
   });

   it('usa título customizado', () => {
      render(<ErrorState title="Falha de rede" description="x" />);
      expect(screen.getByRole('heading', { name: 'Falha de rede' })).toBeInTheDocument();
   });

   it('renderiza ação opcional', () => {
      render(<ErrorState description="x" action={<button type="button">Retry</button>} />);
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
   });
});
