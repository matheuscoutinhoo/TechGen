import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextArea } from './TextArea';

describe('<TextArea />', () => {
   it('associa label e mostra hint', () => {
      render(<TextArea label="Resumo" hint="Pelo menos 10 caracteres" />);
      expect(screen.getByLabelText('Resumo')).toBeInTheDocument();
      expect(screen.getByText('Pelo menos 10 caracteres')).toBeInTheDocument();
   });

   it('captura entrada do usuário', async () => {
      const user = userEvent.setup();
      render(<TextArea label="x" defaultValue="" />);
      const ta = screen.getByLabelText('x') as HTMLTextAreaElement;
      await user.type(ta, 'olá');
      expect(ta.value).toBe('olá');
   });

   it('marca aria-invalid em erro', () => {
      render(<TextArea label="x" error="ruim" />);
      expect(screen.getByLabelText('x')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('ruim');
   });
});
