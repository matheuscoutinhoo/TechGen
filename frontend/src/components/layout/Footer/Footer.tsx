import styles from './Footer.module.css';

export function Footer() {
   return (
      <footer className={styles.footer}>
         <div className={styles.inner}>
            <div className={styles.row}>
               <span>TechGen — aprender tecnologia construindo.</span>
            </div>
            <div className={styles.row}>
               <span>Identidade visual inspirada no FastAPI. Conteúdo gerado por IA da Abacus.</span>
            </div>
         </div>
      </footer>
   );
}
