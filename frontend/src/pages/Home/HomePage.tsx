import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import styles from './Home.module.css';

export function HomePage() {
   return (
      <>
         <section className={styles.hero}>
            <span className={styles.eyebrow}>Aprenda construindo</span>
            <h1 className={styles.title}>
               Trilhas de tecnologia geradas como projetos reais de mercado.
            </h1>
            <p className={styles.lead}>
               Diga o tema que você quer aprender. A IA do TechGen — atuando como um
               Staff Software Engineer mentor — desenha um projeto e o quebra em
               tickets estilo Jira, com escopo claro, fundamentos profundos e
               progressão pedagógica.
            </p>
            <div className={styles.actions}>
               <Link to="/register">
                  <Button variant="primary">Criar conta</Button>
               </Link>
               <Link to="/login">
                  <Button variant="secondary">Já tenho conta</Button>
               </Link>
            </div>
         </section>

         <section className={styles.pillars} aria-label="Pilares pedagógicos">
            <Card className={styles.pillar}>
               <h3>Projeto realista</h3>
               <p>
                  Você não estuda fragmentos isolados — constrói um sistema com nível
                  de mercado, com decisões de arquitetura e trade-offs reais.
               </p>
            </Card>
            <Card className={styles.pillar}>
               <h3>Tickets progressivos</h3>
               <p>
                  Cada etapa entrega um incremento utilizável, com conceitos novos
                  apresentados <em>antes</em> da implementação.
               </p>
            </Card>
            <Card className={styles.pillar}>
               <h3>TDD do início ao fim</h3>
               <p>
                  Os tickets reforçam testes automatizados, código limpo e revisão
                  crítica — como em um time de produto sério.
               </p>
            </Card>
         </section>

         <pre className={styles.codeBlock} aria-label="Exemplo de ticket gerado">
            {`# TG-3 — Primeiro caso de uso com TDD
- Objetivo: implementar o caso de uso central com Red → Green → Refactor.
- Conceitos: TDD, Arrange-Act-Assert, refatoração segura.
- Critérios de aceite:
  * Teste unitário verde para o caso feliz
  * Teste verde para entrada inválida
  * Cobertura documentada`}
         </pre>
      </>
   );
}
