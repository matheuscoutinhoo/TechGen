import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { EarnedSkillsCard } from './EarnedSkillsCard';
import type { Skill, Ticket } from '../../../types/api';

const TICKETS: Ticket[] = [
   {
      code: 'TG-1',
      title: 'Setup',
      objective: 'Preparar o ambiente.',
      concepts: ['FastAPI', 'TDD'],
      tasks: [],
      acceptance_criteria: [],
   } as unknown as Ticket,
   {
      code: 'TG-2',
      title: 'Modelagem',
      objective: 'Modelar o domínio.',
      concepts: ['Pydantic', 'TDD'], // TDD repetido para validar dedupe
      tasks: [],
      acceptance_criteria: [],
   } as unknown as Ticket,
];

const SKILLS: Skill[] = [
   {
      id: 1,
      name: 'tdd',
      proficiency: 3,
      proficiency_label: 'intermediate',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
   },
];

describe('<EarnedSkillsCard />', () => {
   it('antes de concluir mostra novas em destaque e marca skills que o user já tem', () => {
      render(<EarnedSkillsCard tickets={TICKETS} currentSkills={SKILLS} />);

      expect(screen.getByText('Skills que você ganhará')).toBeInTheDocument();

      // FastAPI e Pydantic são novas
      const newGroup = screen.getByText(/Novas no seu perfil/).closest('div')!;
      expect(within(newGroup).getByText('FastAPI')).toBeInTheDocument();
      expect(within(newGroup).getByText('Pydantic')).toBeInTheDocument();

      // TDD já está no perfil, com label da proficiência atual
      const ownedGroup = screen.getByText(/Você já tem/).closest('div')!;
      expect(within(ownedGroup).getByText('TDD')).toBeInTheDocument();
      expect(within(ownedGroup).getByText(/intermediate/)).toBeInTheDocument();
   });

   it('faz dedupe dos conceitos repetidos entre tickets', () => {
      render(<EarnedSkillsCard tickets={TICKETS} currentSkills={[]} />);
      const tdd = screen.getAllByText('TDD');
      expect(tdd).toHaveLength(1);
   });

   it('estado concluído mostra apenas adicionadas e reforçadas', () => {
      render(
         <EarnedSkillsCard
            tickets={TICKETS}
            currentSkills={SKILLS}
            completed
            addedConcepts={['fastapi', 'pydantic']}
            upgradedConcepts={['tdd']}
         />,
      );

      expect(screen.getByText('Skills adicionadas')).toBeInTheDocument();
      expect(screen.getByText('fastapi')).toBeInTheDocument();
      expect(screen.getByText('pydantic')).toBeInTheDocument();
      const reforced = screen.getByText('Reforçadas').closest('div')!;
      expect(within(reforced).getByText('tdd')).toBeInTheDocument();
   });

   it('sem conceitos não renderiza nada', () => {
      const { container } = render(
         <EarnedSkillsCard tickets={[]} currentSkills={SKILLS} />,
      );
      expect(container).toBeEmptyDOMElement();
   });
});
