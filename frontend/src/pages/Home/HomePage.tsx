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
               Trilhas de tecnologia <em>personalizadas</em> como projetos reais de mercado.
            </h1>
            <p className={styles.lead}>
               Diga o tema que você quer aprender e declare suas skills atuais. A IA
               do TechGen — atuando como um Staff Software Engineer mentor — desenha
               um projeto e o quebra em tickets estilo Jira, calibrados ao seu nível
               e com fundamentos profundos.
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
               <h3>Personalizada por skills</h3>
               <p>
                  Você lista as tecnologias e conceitos que já domina. A IA assume
                  fluência onde você é forte e ensina do zero o que falta.
               </p>
            </Card>
            <Card className={styles.pillar}>
               <h3>Tickets progressivos</h3>
               <p>
                  Cada etapa entrega um incremento utilizável, com conceitos novos
                  apresentados <em>antes</em> da implementação — e cada conceito tem
                  uma explicação aprofundada a um clique.
               </p>
            </Card>
            <Card className={styles.pillar}>
               <h3>Progressão automática</h3>
               <p>
                  Concluiu a trilha? Os conceitos cobertos viram skills no seu perfil.
                  A próxima trilha já parte de um nivelamento mais alto.
               </p>
            </Card>
         </section>

         <pre className={styles.codeBlock} aria-label="Exemplo de ticket gerado">
            {`# TG-3 — Primeiro caso de uso com TDD
- Calibrado para você: assume base em Python, ensina TDD do zero.
- Conceitos: TDD, Arrange-Act-Assert, refatoração segura.
- Critérios de aceite:
  * Teste unitário verde para o caso feliz
  * Teste verde para entrada inválida
  * Cobertura documentada`}
         </pre>
      </>
   );
}
