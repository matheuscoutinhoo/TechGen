import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import styles from '../Login/Login.module.css';

export function RegisterPage() {
   const { register } = useAuth();
   const navigate = useNavigate();
   const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [confirmation, setConfirmation] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);

   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      if (password.length < 8) {
         setError('A senha deve ter ao menos 8 caracteres.');
         return;
      }
      if (password !== confirmation) {
         setError('As senhas não coincidem.');
         return;
      }

      setSubmitting(true);
      try {
         await register({ name, email, password });
         navigate('/dashboard', { replace: true });
      } catch (err) {
         if (err instanceof ApiError) {
            setError(err.message);
         } else {
            setError('Não foi possível criar a conta agora. Tente novamente.');
         }
      } finally {
         setSubmitting(false);
      }
   };

   return (
      <div className={styles.shell}>
         <header>
            <h1>Criar conta</h1>
            <p className={styles.subtitle}>
               Comece a gerar trilhas pedagógicas em poucos segundos.
            </p>
         </header>

         <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {error && <div className={styles.error}>{error}</div>}
            <Input
               label="Nome"
               value={name}
               onChange={(event) => setName(event.target.value)}
               minLength={2}
               required
               autoComplete="name"
            />
            <Input
               label="Email"
               type="email"
               autoComplete="email"
               value={email}
               onChange={(event) => setEmail(event.target.value)}
               required
            />
            <Input
               label="Senha"
               type="password"
               autoComplete="new-password"
               value={password}
               onChange={(event) => setPassword(event.target.value)}
               minLength={8}
               required
               hint="Mínimo de 8 caracteres."
            />
            <Input
               label="Confirme a senha"
               type="password"
               autoComplete="new-password"
               value={confirmation}
               onChange={(event) => setConfirmation(event.target.value)}
               minLength={8}
               required
            />
            <Button type="submit" variant="primary" block isLoading={submitting}>
               Criar conta
            </Button>
         </form>

         <p className={styles.helper}>
            Já tem uma conta? <Link to="/login">Entrar</Link>
         </p>
      </div>
   );
}
