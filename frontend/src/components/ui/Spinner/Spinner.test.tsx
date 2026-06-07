import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('<Spinner />', () => {
   it('renderiza label padrão com role status', () => {
      render(<Spinner />);
      expect(screen.getByRole('status')).toHaveTextContent('Carregando...');
   });

   it('aceita label customizado', () => {
      render(<Spinner label="Aguarde" />);
      expect(screen.getByRole('status')).toHaveTextContent('Aguarde');
   });
});
