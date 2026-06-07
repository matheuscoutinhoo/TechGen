import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usersApi } from '../../api/users';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageTitle } from '../../components/ui/PageTitle';
import { ErrorState } from '../../components/ui/ErrorState';
import styles from './Account.module.css';

export function AccountPage() {
   const { user, applyUser, logout } = useAuth();
   const navigate = useNavigate();

   const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [profileError, setProfileError] = useState<string | null>(null);
   const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
   const [profileSubmitting, setProfileSubmitting] = useState(false);

   const [currentPassword, setCurrentPassword] = useState('');
   const [newPassword, setNewPassword] = useState('');
   const [confirmation, setConfirmation] = useState('');
   const [passwordError, setPasswordError] = useState<string | null>(null);
   const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
   const [passwordSubmitting, setPasswordSubmitting] = useState(false);

   const [deleteError, setDeleteError] = useState<string | null>(null);
   const [deleting, setDeleting] = useState(false);

   useEffect(() => {
      if (user) {
         setName(user.name);
         setEmail(user.email);
      }
   }, [user]);

   if (!user) return null;

   const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setProfileError(null);
      setProfileSuccess(null);
      setProfileSubmitting(true);
      try {
         const updated = await usersApi.update({
            name: name !== user.name ? name : undefined,
            email: email !== user.email ? email : undefined,
         });
         applyUser(updated);
         setProfileSuccess('Perfil atualizado com sucesso.');
      } catch (err) {
         setProfileError(
            err instanceof ApiError ? err.message : 'Não foi possível atualizar agora.',
         );
      } finally {
         setProfileSubmitting(false);
      }
   };

   const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setPasswordError(null);
      setPasswordSuccess(null);
      if (newPassword.length < 8) {
         setPasswordError('A nova senha deve ter ao menos 8 caracteres.');
         return;
      }
      if (newPassword !== confirmation) {
         setPasswordError('As senhas não coincidem.');
         return;
      }
      setPasswordSubmitting(true);
      try {
         await usersApi.changePassword({
            current_password: currentPassword,
            new_password: newPassword,
         });
         setPasswordSuccess('Senha alterada com sucesso.');
         setCurrentPassword('');
         setNewPassword('');
         setConfirmation('');
      } catch (err) {
         setPasswordError(
            err instanceof ApiError ? err.message : 'Não foi possível alterar a senha agora.',
         );
      } finally {
         setPasswordSubmitting(false);
      }
   };

   const handleDelete = async () => {
      const confirmed = window.confirm(
         'Excluir sua conta apaga todas as suas trilhas. Esta ação é definitiva. Deseja continuar?',
      );
      if (!confirmed) return;
      setDeleteError(null);
      setDeleting(true);
      try {
         await usersApi.delete();
         logout();
         navigate('/', { replace: true });
      } catch (err) {
         setDeleteError(
            err instanceof ApiError ? err.message : 'Não foi possível excluir a conta.',
         );
         setDeleting(false);
      }
   };

   return (
      <>
         <PageTitle
            eyebrow="Minha conta"
            title="Gerenciar conta"
            description="Atualize seus dados, mude a senha ou exclua sua conta."
         />

         <div className={styles.sections}>
            <form className={styles.section} onSubmit={handleProfileSubmit} noValidate>
               <h2>Perfil</h2>
               {profileError && <ErrorState description={profileError} />}
               {profileSuccess && <div className={styles.feedback}>{profileSuccess}</div>}
               <Input
                  label="Nome"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                  required
               />
               <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
               />
               <div className={styles.actions}>
                  <Button type="submit" variant="primary" isLoading={profileSubmitting}>
                     Salvar
                  </Button>
               </div>
            </form>

            <form className={styles.section} onSubmit={handlePasswordSubmit} noValidate>
               <h2>Senha</h2>
               {passwordError && <ErrorState description={passwordError} />}
               {passwordSuccess && <div className={styles.feedback}>{passwordSuccess}</div>}
               <Input
                  label="Senha atual"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  minLength={8}
                  required
               />
               <Input
                  label="Nova senha"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  required
               />
               <Input
                  label="Confirme a nova senha"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  minLength={8}
                  required
               />
               <div className={styles.actions}>
                  <Button type="submit" variant="primary" isLoading={passwordSubmitting}>
                     Alterar senha
                  </Button>
               </div>
            </form>

            <section className={`${styles.section} ${styles.dangerSection}`}>
               <h2>Excluir conta</h2>
               <p className="lead">
                  A exclusão é definitiva: removemos seu cadastro e todas as suas trilhas.
               </p>
               {deleteError && <ErrorState description={deleteError} />}
               <div className={styles.actions}>
                  <Button variant="danger" onClick={() => void handleDelete()} isLoading={deleting}>
                     Excluir minha conta
                  </Button>
               </div>
            </section>
         </div>
      </>
   );
}
