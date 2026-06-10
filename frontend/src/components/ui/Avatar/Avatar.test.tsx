import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('<Avatar />', () => {
   it('mostra iniciais quando não tem src', () => {
      render(<Avatar name="Ada Lovelace" />);
      expect(screen.getByText('AL')).toBeInTheDocument();
   });

   it('renderiza imagem com alt quando src é passado', () => {
      render(<Avatar name="Ada Lovelace" src="data:image/png;base64,xxx" />);
      const img = screen.getByRole('img', { name: 'Foto de Ada Lovelace' });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'data:image/png;base64,xxx');
   });

   it('iniciais para nome único usam até 2 letras', () => {
      render(<Avatar name="Mat" />);
      expect(screen.getByText('MA')).toBeInTheDocument();
   });

   it('iniciais para nome vazio caem em "?"', () => {
      render(<Avatar name="" />);
      expect(screen.getByText('?')).toBeInTheDocument();
   });
});
