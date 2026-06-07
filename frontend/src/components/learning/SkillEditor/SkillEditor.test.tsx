import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillEditor, type SkillEditorEntry } from './SkillEditor';

describe('<SkillEditor />', () => {
   const ITEMS: SkillEditorEntry[] = [
      { id: 1, name: 'fastapi', proficiency: 3 },
      { id: 2, name: 'tdd', proficiency: 4 },
   ];

   it('mostra mensagem de vazio quando lista está vazia', () => {
      render(<SkillEditor skills={[]} onAdd={vi.fn()} onRemove={vi.fn()} />);
      expect(screen.getByText(/ainda não adicionou nenhuma skill/i)).toBeInTheDocument();
   });

   it('renderiza skills com rótulo de nível', () => {
      render(<SkillEditor skills={ITEMS} onAdd={vi.fn()} onRemove={vi.fn()} />);
      expect(screen.getByText('fastapi')).toBeInTheDocument();
      expect(screen.getByText('intermediate')).toBeInTheDocument();
      expect(screen.getByText('advanced')).toBeInTheDocument();
   });

   it('dispara onAdd após preencher e clicar', async () => {
      const onAdd = vi.fn();
      render(<SkillEditor skills={[]} onAdd={onAdd} onRemove={vi.fn()} />);

      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Tecnologia ou conceito'), 'React');
      await user.click(screen.getByRole('button', { name: 'Adicionar' }));

      expect(onAdd).toHaveBeenCalledWith({ name: 'React', proficiency: 2 });
   });

   it('mostra erro quando nome está vazio', async () => {
      const onAdd = vi.fn();
      render(<SkillEditor skills={[]} onAdd={onAdd} onRemove={vi.fn()} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Adicionar' }));

      expect(screen.getByRole('alert')).toHaveTextContent(/tecnologia ou conceito/i);
      expect(onAdd).not.toHaveBeenCalled();
   });

   it('mostra erro quando skill já existe (case-insensitive)', async () => {
      const onAdd = vi.fn();
      render(<SkillEditor skills={ITEMS} onAdd={onAdd} onRemove={vi.fn()} />);

      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Tecnologia ou conceito'), 'FastAPI');
      await user.click(screen.getByRole('button', { name: 'Adicionar' }));

      expect(screen.getByRole('alert')).toHaveTextContent(/já adicionou/i);
      expect(onAdd).not.toHaveBeenCalled();
   });

   it('dispara onRemove quando clicar em Remover', async () => {
      const onRemove = vi.fn();
      render(<SkillEditor skills={ITEMS} onAdd={vi.fn()} onRemove={onRemove} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Remover fastapi' }));

      expect(onRemove).toHaveBeenCalledWith(ITEMS[0]);
   });
});
