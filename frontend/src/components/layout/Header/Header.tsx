import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '../../ui/Button';
import { Avatar } from '../../ui/Avatar';
import styles from './Header.module.css';

export function Header() {
   const { isAuthenticated, user, logout } = useAuth();

   const navClass = ({ isActive }: { isActive: boolean }) =>
      [styles.navLink, isActive ? styles.active : ''].filter(Boolean).join(' ');

   return (
      <header className={styles.header}>
         <div className={styles.inner}>
            <Link to={isAuthenticated ? '/dashboard' : '/'} className={styles.brand}>
               <span className={styles.brandMark} aria-hidden="true">▲</span>
               MentorIA
            </Link>

            {isAuthenticated ? (
               <>
                  <nav className={styles.nav} aria-label="Navegação principal">
                     <NavLink to="/dashboard" className={navClass} end>
                        Visão geral
                     </NavLink>
                     <NavLink to="/trails" className={navClass}>
                        Trilhas
                     </NavLink>
                  </nav>
                  <div className={styles.userMenu}>
                     {user && (
                        <Link
                           to="/account"
                           className={styles.profileLink}
                           aria-label={`Conta de ${user.name}`}
                           title="Minha conta"
                        >
                           <Avatar
                              name={user.name}
                              src={user.avatar_url}
                              size={32}
                              interactive
                           />
                           <span className={styles.userName}>{user.name}</span>
                        </Link>
                     )}
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
