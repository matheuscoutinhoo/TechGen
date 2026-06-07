import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrailHeader } from './TrailHeader';
import type { LearningTrail } from '../../../types/api';

const TRAIL: LearningTrail = {
   id: 1,
   topic: 'FastAPI',
   title: 'Projeto FastAPI',
   summary: 'Resumo do projeto.',
   completed_at: null,
   created_at: '2025-01-01T00:00:00Z',
   updated_at: '2025-01-02T00:00:00Z',
   content: {
      project_title: 'Projeto FastAPI',
      project_summary: 'Resumo do projeto.',
      why_realistic: 'Porque é assim.',
      target_audience: 'Devs.',
      prerequisites: ['Git', 'Python'],
      tickets: [],
   },
};

describe('<TrailHeader />', () => {
   it('mostra tema, título, resumo e metadados', () => {
      render(<TrailHeader trail={TRAIL} />);
      expect(screen.getByText('Tema: FastAPI')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Projeto FastAPI' })).toBeInTheDocument();
      expect(screen.getByText('Resumo do projeto.')).toBeInTheDocument();
      expect(screen.getByText('Porque é assim.')).toBeInTheDocument();
      expect(screen.getByText('Devs.')).toBeInTheDocument();
      expect(screen.getByText('Git')).toBeInTheDocument();
      expect(screen.getByText('Python')).toBeInTheDocument();
   });

   it('omite bloco de pré-requisitos quando lista vazia', () => {
      const trail = { ...TRAIL, content: { ...TRAIL.content, prerequisites: [] } };
      render(<TrailHeader trail={trail} />);
      expect(screen.queryByText('Pré-requisitos')).not.toBeInTheDocument();
   });
});
