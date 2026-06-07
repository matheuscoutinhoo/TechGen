import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('<Button />', () => {
   it('renderiza o conteúdo informado', () => {
      render(<Button>Enviar</Button>);
      expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
   });

   it('dispara onClick quando clicado', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      render(<Button onClick={onClick}>Confirmar</Button>);
      await user.click(screen.getByRole('button', { name: 'Confirmar' }));
      expect(onClick).toHaveBeenCalledOnce();
   });

   it('fica desabilitado e marca aria-busy quando isLoading', () => {
      render(<Button isLoading>Salvar</Button>);
      const button = screen.getByRole('button', { name: 'Salvar' });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
   });

   it('respeita disabled explícito', () => {
      render(<Button disabled>Indisponível</Button>);
      expect(screen.getByRole('button', { name: 'Indisponível' })).toBeDisabled();
   });
});
