import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '../../ui/Button';
import styles from './Header.module.css';

export function Header() {
   const { isAuthenticated, user, logout } = useAuth();

   const navClass = ({ isActive }: { isActive: boolean }) =>
      [styles.navLink, isActive ? styles.active : ''].filter(Boolean).join(' ');

   return (
      <header className={styles.header}>
         <div className={styles.inner}>
            <Link to={isAuthenticated ? '/dashboard' : '/'} className={styles.brand}>
               TechGen <span className={styles.badge}>IA</span>
            </Link>

            {isAuthenticated ? (
               <>
                  <nav className={styles.nav} aria-label="Navegação principal">
                     <NavLink to="/dashboard" className={navClass}>
                        Trilhas
                     </NavLink>
                     <NavLink to="/trails/new" className={navClass}>
                        Nova trilha
                     </NavLink>
                     <NavLink to="/account" className={navClass}>
                        Minha conta
                     </NavLink>
                  </nav>
                  <div className={styles.userMenu}>
                     {user && <span className={styles.userName}>{user.name}</span>}
                     <Button variant="ghost" onClick={logout}>
                        Sair
                     </Button>
                  </div>
               </>
            ) : (
               <nav className={styles.nav} aria-label="Acesso">
                  <NavLink to="/login" className={navClass}>
                     Entrar
                  </NavLink>
                  <Link to="/register">
                     <Button variant="primary">Criar conta</Button>
                  </Link>
               </nav>
            )}
         </div>
      </header>
   );
}
