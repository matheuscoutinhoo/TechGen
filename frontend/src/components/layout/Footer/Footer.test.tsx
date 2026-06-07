import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('<Footer />', () => {
   it('mostra créditos do projeto', () => {
      render(<Footer />);
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
      expect(screen.getByText(/aprender tecnologia construindo/)).toBeInTheDocument();
      expect(screen.getByText(/FastAPI/)).toBeInTheDocument();
   });
});
