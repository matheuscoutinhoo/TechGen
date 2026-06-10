import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { ThemeToggle } from './ThemeToggle';

function renderWithProvider() {
   return render(
      <ThemeProvider>
         <ThemeToggle />
      </ThemeProvider>,
   );
}

describe('<ThemeToggle />', () => {
   it('alterna o data-theme do <html> ao clicar', async () => {
      window.localStorage.clear();
      document.documentElement.dataset.theme = 'light';
      renderWithProvider();

      const button = screen.getByRole('button', { name: /tema escuro/i });
      expect(button).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(button);

      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(window.localStorage.getItem('techgen.theme')).toBe('dark');
      expect(
         screen.getByRole('button', { name: /tema claro/i }),
      ).toBeInTheDocument();
   });
});
