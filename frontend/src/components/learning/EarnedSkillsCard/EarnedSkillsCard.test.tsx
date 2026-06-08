import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { EarnedSkillsCard } from './EarnedSkillsCard';
import type { Skill, Ticket } from '../../../types/api';

const TICKETS: Ticket[] = [
   {
      code: 'TG-1',
      title: 'Setup',
      objective: 'Preparar o ambiente.',
      concepts: ['JWT', 'Repository Pattern'],
      tasks: [],
      acceptance_criteria: [],
   } as unknown as Ticket,
];

const SKILLS: Skill[] = [
   {
      id: 1,
      name: 'testes',
      proficiency: 3,
      proficiency_label: 'intermediate',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
   },
];

describe('<EarnedSkillsCard />', () => {
   it('preview: mostra categorias genéricas; novas em primary, já existentes em cinza', () => {
      render(
         <EarnedSkillsCard
            categories={['autenticação', 'banco de dados', 'testes']}
            currentSkills={SKILLS}
         />,
      );

      expect(screen.getByText('Skills que você vai ganhar')).toBeInTheDocument();

      const newGroup = screen.getByText(/Novas no seu perfil/).closest('div')!;
      expect(within(newGroup).getByText('autenticação')).toBeInTheDocument();
      expect(within(newGroup).getByText('banco de dados')).toBeInTheDocument();

      const ownedGroup = screen.getByText(/Você já tem/).closest('div')!;
      expect(within(ownedGroup).getByText('testes')).toBeInTheDocument();
      expect(within(ownedGroup).getByText(/intermediate/)).toBeInTheDocument();
   });

   it('quando categorias estão vazias, faz fallback para concepts dos tickets', () => {
      render(<EarnedSkillsCard categories={[]} tickets={TICKETS} currentSkills={[]} />);
      // mostra os concepts crus como fallback (trilhas legacy)
      expect(screen.getByText('JWT')).toBeInTheDocument();
      expect(screen.getByText('Repository Pattern')).toBeInTheDocument();
   });

   it('estado concluído mostra Novas + Reforçadas vindas do payload de complete', () => {
      render(
         <EarnedSkillsCard
            categories={['autenticação', 'testes']}
            currentSkills={SKILLS}
            completed
            addedConcepts={['autenticação']}
            upgradedConcepts={['testes']}
         />,
      );

      expect(screen.getByText('Skills adicionadas')).toBeInTheDocument();
      const novas = screen.getByText('Novas').closest('div')!;
      expect(within(novas).getByText('autenticação')).toBeInTheDocument();
      const reforced = screen.getByText('Reforçadas').closest('div')!;
      expect(within(reforced).getByText('testes')).toBeInTheDocument();
   });

   it('sem categorias e sem tickets não renderiza nada', () => {
      const { container } = render(
         <EarnedSkillsCard categories={[]} currentSkills={SKILLS} />,
      );
      expect(container).toBeEmptyDOMElement();
   });
});
