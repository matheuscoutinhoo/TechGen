import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RichText } from './RichText';

describe('<RichText />', () => {
   it('renderiza texto puro sem markdown', () => {
      const { container } = render(<RichText>texto simples</RichText>);
      expect(container.textContent).toBe('texto simples');
      expect(container.querySelector('strong')).toBeNull();
   });

   it('reconhece **negrito**', () => {
      render(<RichText>Esta é uma **palavra** chave.</RichText>);
      const strong = screen.getByText('palavra');
      expect(strong.tagName).toBe('STRONG');
   });

   it('reconhece ==marca-texto==', () => {
      render(<RichText>Olhe ==isso aqui== com atenção.</RichText>);
      const mark = screen.getByText('isso aqui');
      expect(mark.tagName).toBe('MARK');
   });

   it('reconhece `código inline`', () => {
      render(<RichText>Use a função `map()` aqui.</RichText>);
      const code = screen.getByText('map()');
      expect(code.tagName).toBe('CODE');
   });

   it('combina vários estilos no mesmo texto', () => {
      render(
         <RichText>
            **Repository** é uma ==abstração== entre `service` e `db`.
         </RichText>,
      );
      expect(screen.getByText('Repository').tagName).toBe('STRONG');
      expect(screen.getByText('abstração').tagName).toBe('MARK');
      expect(screen.getByText('service').tagName).toBe('CODE');
      expect(screen.getByText('db').tagName).toBe('CODE');
   });

   it('não interpreta HTML cru (protege contra XSS)', () => {
      const { container } = render(
         <RichText>{'<script>alert(1)</script> ok'}</RichText>,
      );
      expect(container.querySelector('script')).toBeNull();
      expect(container.textContent).toContain('<script>alert(1)</script>');
   });

   it('preserva quebras de linha como <br />', () => {
      const { container } = render(<RichText>{'linha 1\nlinha 2'}</RichText>);
      expect(container.querySelectorAll('br').length).toBe(1);
   });

   it('respeita o wrapper "p"', () => {
      const { container } = render(<RichText as="p">texto</RichText>);
      expect(container.querySelector('p')).not.toBeNull();
   });

   it('wrap a primeira ocorrência de cada termo do glossário em botão', () => {
      const glossary = [
         { term: 'router', brief: 'Coisa que despacha requisições.' },
         { term: 'JWT', brief: 'Token assinado.' },
      ];
      render(
         <RichText glossary={glossary}>
            O router decide a rota; o JWT autentica. Router de novo aqui.
         </RichText>,
      );
      // primeira ocorrência vira botão; a segunda ocorrência de "router" não.
      const buttons = screen.getAllByRole('button');
      expect(buttons.map((b) => b.textContent)).toEqual(['router', 'JWT']);
   });

   it('case-insensitive e respeita word boundary', () => {
      const glossary = [{ term: 'orm', brief: 'mapeador' }];
      render(
         <RichText glossary={glossary}>
            ORM é útil. A palavra "form" não casa.
         </RichText>,
      );
      // "ORM" como palavra isolada casa; "form" não casa por causa do \b.
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveTextContent('ORM');
   });
});
