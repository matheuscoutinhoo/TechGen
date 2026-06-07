import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageTitle } from './PageTitle';

describe('<PageTitle />', () => {
   it('renderiza eyebrow, título e descrição', () => {
      render(
         <PageTitle eyebrow="Etapa" title="Minha página" description="descrição" />,
      );
      expect(screen.getByText('Etapa')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Minha página' })).toBeInTheDocument();
      expect(screen.getByText('descrição')).toBeInTheDocument();
   });

   it('eyebrow é opcional', () => {
      render(<PageTitle title="Só título" />);
      expect(screen.queryByText('Etapa')).not.toBeInTheDocument();
   });
});
