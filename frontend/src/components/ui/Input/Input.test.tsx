import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('<Input />', () => {
   it('associa label com input via htmlFor/id', () => {
      render(<Input label="Email" />);
      const input = screen.getByLabelText('Email');
      expect(input).toBeInTheDocument();
   });

   it('renderiza dica quando não há erro', () => {
      render(<Input label="Senha" hint="Mínimo 8 caracteres" />);
      expect(screen.getByText('Mínimo 8 caracteres')).toBeInTheDocument();
   });

   it('renderiza erro e marca aria-invalid', () => {
      render(<Input label="Senha" error="Muito curta" />);
      const input = screen.getByLabelText('Senha');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('Muito curta');
   });

   it('quando há erro, não renderiza a dica', () => {
      render(<Input label="Email" hint="Use seu email pessoal" error="Email inválido" />);
      expect(screen.queryByText('Use seu email pessoal')).not.toBeInTheDocument();
   });
});
