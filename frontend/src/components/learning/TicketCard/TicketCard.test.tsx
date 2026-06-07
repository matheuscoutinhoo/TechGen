import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketCard } from './TicketCard';
import type { Ticket } from '../../../types/api';

const TICKET: Ticket = {
   code: 'TG-1',
   title: 'Setup do ambiente',
   objective: 'Preparar o ambiente de desenvolvimento.',
   concepts: ['Ambiente', 'Dependências'],
   tasks: [{ description: 'Instalar Node' }, { description: 'Criar repositório' }],
   acceptance_criteria: ['Comando hello roda'],
   estimated_effort: '1h',
};

describe('<TicketCard />', () => {
   it('mostra código, título e objetivo na cabeçalho', () => {
      render(<TicketCard ticket={TICKET} />);
      expect(screen.getByText('TG-1')).toBeInTheDocument();
      expect(screen.getByText('Setup do ambiente')).toBeInTheDocument();
      expect(screen.getByText(/Preparar o ambiente/)).toBeInTheDocument();
   });

   it('inicia colapsado e expande ao clicar', async () => {
      const user = userEvent.setup();
      render(<TicketCard ticket={TICKET} />);
      const toggle = screen.getByRole('button', { name: /TG-1 Setup do ambiente/ });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('Instalar Node')).not.toBeInTheDocument();

      await user.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Instalar Node')).toBeInTheDocument();
      expect(screen.getByText('Comando hello roda')).toBeInTheDocument();
      expect(screen.getByText(/Esforço estimado: 1h/)).toBeInTheDocument();
   });

   it('respeita defaultOpen=true', () => {
      render(<TicketCard ticket={TICKET} defaultOpen />);
      expect(screen.getByText('Instalar Node')).toBeInTheDocument();
   });
});
