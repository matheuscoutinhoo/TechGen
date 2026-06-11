import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usersApi } from '../../api/users';
import { skillsApi } from '../../api/skills';
import { ApiError } from '../../api/client';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageTitle } from '../../components/ui/PageTitle';
import { ErrorState } from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Spinner';
import { SkillEditor, type SkillEditorEntry } from '../../components/learning/SkillEditor';
import { useSkills } from '../../hooks/useSkills';
import type { ProficiencyLevel, SkillInput } from '../../types/api';
import styles from './Account.module.css';

const AVATAR_MAX_BYTES = 450 * 1024; // ~450 KB de arquivo bruto

function readFileAsDataURL(file: File): Promise<string> {
   return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
         if (typeof reader.result === 'string') resolve(reader.result);
         else reject(new Error('Falha ao ler a imagem.'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler a imagem.'));
      reader.readAsDataURL(file);
   });
}

export function AccountPage() {
   const { user, applyUser, logout } = useAuth();
   const navigate = useNavigate();
   const { skills, isLoading: skillsLoading, error: skillsError, refetch: refetchSkills } = useSkills();

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

   const [skillsBusy, setSkillsBusy] = useState(false);
   const [skillsActionError, setSkillsActionError] = useState<string | null>(null);

   const [deleteError, setDeleteError] = useState<string | null>(null);
   const [deleting, setDeleting] = useState(false);

   const [avatarError, setAvatarError] = useState<string | null>(null);
   const [avatarBusy, setAvatarBusy] = useState(false);
   const avatarInputRef = useRef<HTMLInputElement | null>(null);

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

   const handleAddSkill = async (payload: SkillInput) => {
      setSkillsActionError(null);
      setSkillsBusy(true);
      try {
         await skillsApi.add(payload);
         await refetchSkills();
      } catch (err) {
         setSkillsActionError(
            err instanceof ApiError ? err.message : 'Não foi possível adicionar a skill.',
         );
      } finally {
         setSkillsBusy(false);
      }
   };

   const handleChangeProficiency = async (skill: SkillEditorEntry, next: ProficiencyLevel) => {
      if (!skill.id) return;
      setSkillsActionError(null);
      setSkillsBusy(true);
      try {
         await skillsApi.updateProficiency(skill.id, next);
         await refetchSkills();
      } catch (err) {
         setSkillsActionError(
            err instanceof ApiError ? err.message : 'Não foi possível atualizar a skill.',
         );
      } finally {
         setSkillsBusy(false);
      }
   };

   const handleRemoveSkill = async (skill: SkillEditorEntry) => {
      if (!skill.id) return;
      setSkillsActionError(null);
      setSkillsBusy(true);
      try {
         await skillsApi.delete(skill.id);
         await refetchSkills();
      } catch (err) {
         setSkillsActionError(
            err instanceof ApiError ? err.message : 'Não foi possível remover a skill.',
         );
      } finally {
         setSkillsBusy(false);
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

   const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      setAvatarError(null);
      if (!file.type.startsWith('image/')) {
         setAvatarError('Selecione um arquivo de imagem (PNG, JPEG, WebP).');
         return;
      }
      if (file.size > AVATAR_MAX_BYTES) {
         setAvatarError('Imagem muito grande. Escolha uma foto menor que ~450 KB.');
         return;
      }
      setAvatarBusy(true);
      try {
         const dataUrl = await readFileAsDataURL(file);
         const updated = await usersApi.update({ avatar_url: dataUrl });
         applyUser(updated);
      } catch (err) {
         setAvatarError(
            err instanceof ApiError ? err.message : 'Não foi possível enviar a foto.',
         );
      } finally {
         setAvatarBusy(false);
      }
   };

   const handleAvatarRemove = async () => {
      setAvatarError(null);
      setAvatarBusy(true);
      try {
         const updated = await usersApi.update({ avatar_url: null });
         applyUser(updated);
      } catch (err) {
         setAvatarError(
            err instanceof ApiError ? err.message : 'Não foi possível remover a foto.',
         );
      } finally {
         setAvatarBusy(false);
      }
   };

   return (
      <>
         <PageTitle
            eyebrow="Minha conta"
            title="Gerenciar conta"
            description="Atualize seus dados, suas skills, sua senha ou exclua sua conta."
         />

         <div className={styles.sections}>
            <section className={`${styles.section} ${styles.avatarSection}`}>
               <h2>Foto de perfil</h2>
               {avatarError && <ErrorState description={avatarError} />}
               <div className={styles.avatarRow}>
                  <Avatar name={user.name} src={user.avatar_url} size={96} featured />
                  <div className={styles.avatarMeta}>
                     <p className={styles.avatarHint}>
                        Sua foto aparece no cabeçalho e te leva direto para esta
                        página em qualquer tela. Use uma imagem quadrada para
                        melhor enquadramento (PNG, JPEG ou WebP até ~450 KB).
                     </p>
                     <div className={styles.actions}>
                        <Button
                           type="button"
                           variant="primary"
                           onClick={() => avatarInputRef.current?.click()}
                           isLoading={avatarBusy}
                        >
                           {user.avatar_url ? 'Trocar foto' : 'Enviar foto'}
                        </Button>
                        {user.avatar_url && (
                           <Button
                              type="button"
                              variant="ghost"
                              onClick={() => void handleAvatarRemove()}
                              disabled={avatarBusy}
                           >
                              Remover
                           </Button>
                        )}
                        <input
                           ref={avatarInputRef}
                           type="file"
                           accept="image/png,image/jpeg,image/webp,image/gif"
                           onChange={(event) => void handleAvatarChange(event)}
                           hidden
                           aria-label="Selecionar imagem de perfil"
                        />
                     </div>
                  </div>
               </div>
            </section>

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
                  placeholder="Como devemos te chamar"
               />
               <Input
                  label="Email"
                  type="email"
                  placeholder="voce@email.com"
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

            <section className={styles.section}>
               <h2>Skills</h2>
               <p className="lead">
                  Suas skills nivelam o conteúdo gerado pelo Mentor: tópicos que você
                  domina recebem desafios profundos, tópicos desconhecidos são
                  ensinados do zero. Concluir trilhas também adiciona conceitos aqui
                  automaticamente.
               </p>
               {skillsError && (
                  <ErrorState description={skillsError.message} />
               )}
               {skillsLoading ? (
                  <Spinner label="Carregando suas skills..." />
               ) : (
                  <SkillEditor
                     skills={skills}
                     onAdd={handleAddSkill}
                     onChangeProficiency={handleChangeProficiency}
                     onRemove={handleRemoveSkill}
                     isBusy={skillsBusy}
                     error={skillsActionError}
                  />
               )}
            </section>

            <form className={styles.section} onSubmit={handlePasswordSubmit} noValidate>
               <h2>Senha</h2>
               {passwordError && <ErrorState description={passwordError} />}
               {passwordSuccess && <div className={styles.feedback}>{passwordSuccess}</div>}
               <Input
                  label="Senha atual"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Digite sua senha atual"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  minLength={8}
                  required
               />
               <Input
                  label="Nova senha"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  required
               />
               <Input
                  label="Confirme a nova senha"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
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
