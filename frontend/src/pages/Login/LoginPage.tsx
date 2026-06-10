import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import styles from './Login.module.css';

interface LocationState {
   from?: { pathname?: string };
}

export function LoginPage() {
   const navigate = useNavigate();
   const location = useLocation();
   const { login } = useAuth();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);

   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setSubmitting(true);
      try {
         await login({ email, password });
         const state = location.state as LocationState | null;
         const target = state?.from?.pathname ?? '/dashboard';
         navigate(target, { replace: true });
      } catch (err) {
         if (err instanceof ApiError) {
            setError(err.message);
         } else {
            setError('Não foi possível entrar agora. Tente novamente.');
         }
      } finally {
         setSubmitting(false);
      }
   };

   return (
      <div className={styles.shell}>
         <header>
            <h1>Entrar</h1>
            <p className={styles.subtitle}>
               Acesse seu painel para criar e revisar suas trilhas.
            </p>
         </header>

         <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {error && <div className={styles.error}>{error}</div>}
            <Input
               label="Email"
               type="email"
               autoComplete="email"
               placeholder="voce@email.com"
               value={email}
               onChange={(event) => setEmail(event.target.value)}
               required
            />
            <Input
               label="Senha"
               type="password"
               autoComplete="current-password"
               placeholder="Mínimo 8 caracteres"
               value={password}
               onChange={(event) => setPassword(event.target.value)}
               required
               minLength={8}
            />
            <Button type="submit" variant="primary" block isLoading={submitting}>
               Entrar
            </Button>
         </form>

         <p className={styles.helper}>
            Ainda não tem conta? <Link to="/register">Criar conta</Link>
         </p>
      </div>
   );
}
