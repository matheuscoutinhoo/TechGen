import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrailProgress } from './TrailProgress';

describe('<TrailProgress />', () => {
   it('renderiza barra com porcentagem correta', () => {
      render(<TrailProgress completed={3} total={4} />);
      const bar = screen.getByRole('progressbar');
      expect(bar).toHaveAttribute('aria-valuenow', '75');
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '100');
      expect(screen.getByText('3/4 · 75%')).toBeInTheDocument();
   });

   it('marca 100% quando todos concluídos', () => {
      render(<TrailProgress completed={5} total={5} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
      expect(screen.getByText('5/5 · 100%')).toBeInTheDocument();
   });

   it('trata total zero sem dividir por zero', () => {
      render(<TrailProgress completed={0} total={0} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
      expect(screen.getByText('0/0 · 0%')).toBeInTheDocument();
   });

   it('clampa valores fora dos limites', () => {
      render(<TrailProgress completed={10} total={4} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
      expect(screen.getByText('4/4 · 100%')).toBeInTheDocument();
   });

   it('label padrão muda conforme variante', () => {
      const { rerender } = render(<TrailProgress completed={1} total={2} variant="detailed" />);
      expect(screen.getByText(/Tickets concluídos/i)).toBeInTheDocument();
      rerender(<TrailProgress completed={1} total={2} variant="compact" />);
      expect(screen.getByText(/Progresso/i)).toBeInTheDocument();
   });
});
