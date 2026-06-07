import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('<Card />', () => {
   it('renderiza children', () => {
      render(<Card>conteúdo</Card>);
      expect(screen.getByText('conteúdo')).toBeInTheDocument();
   });

   it('aceita className extra', () => {
      render(
         <Card className="custom" data-testid="card">
            x
         </Card>,
      );
      expect(screen.getByTestId('card').className).toMatch(/custom/);
   });
});
