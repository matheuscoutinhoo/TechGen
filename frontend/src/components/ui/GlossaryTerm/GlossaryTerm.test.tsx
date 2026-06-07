import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlossaryTerm } from './GlossaryTerm';

describe('<GlossaryTerm />', () => {
   it('renderiza o texto original como botão', () => {
      render(
         <GlossaryTerm term="ORM" brief="Mapeamento OO-relacional.">
            ORM
         </GlossaryTerm>,
      );
      const trigger = screen.getByRole('button', { name: /ORM/ });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
   });

   it('abre o popover ao clicar e fecha em Escape', async () => {
      render(
         <GlossaryTerm term="JWT" brief="Token assinado em base64.">
            jwt
         </GlossaryTerm>,
      );
      const user = userEvent.setup();
      const trigger = screen.getByRole('button', { name: /jwt/ });

      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('tooltip')).toHaveTextContent('Token assinado em base64.');

      await user.keyboard('{Escape}');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
   });

   it('fecha o popover ao clicar fora', async () => {
      render(
         <div>
            <span data-testid="fora">fora</span>
            <GlossaryTerm term="X" brief="Algo.">
               x
            </GlossaryTerm>
         </div>,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole('button'));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await user.click(screen.getByTestId('fora'));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
   });
});
