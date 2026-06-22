import { useEffect, useId, useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { useAiCredential } from '../../../hooks/useAiCredential';
import type { AIProviderKind } from '../../../types/api';
import styles from './AICredentialEditor.module.css';

interface ProviderOption {
   value: AIProviderKind;
   label: string;
   hint: string;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
   {
      value: 'abacus',
      label: 'Abacus AI',
      hint: 'RouteLLM — uma chave, vários modelos (GPT, Claude, Gemini...).',
   },
   {
      value: 'openai',
      label: 'OpenAI',
      hint: 'API oficial da OpenAI (gpt-4o, gpt-4o-mini...).',
   },
];

function providerLabel(provider: AIProviderKind | null): string {
   return PROVIDER_OPTIONS.find((opt) => opt.value === provider)?.label ?? provider ?? '';
}

/**
 * Editor da credencial de IA do usuário (BYOK). Autocontido: lê e escreve via
 * `useAiCredential`. A chave entra por um campo de senha, é cifrada no servidor
 * e nunca volta — só exibimos a versão mascarada quando já configurada.
 */
export function AICredentialEditor() {
   const { status, isLoading, error, save, remove } = useAiCredential();
   const selectId = useId();

   const [provider, setProvider] = useState<AIProviderKind>('abacus');
   const [apiKey, setApiKey] = useState('');
   const [model, setModel] = useState('');
   const [baseUrl, setBaseUrl] = useState('');
   const [formError, setFormError] = useState<string | null>(null);
   const [success, setSuccess] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);

   // Pré-preenche provider/modelo/URL quando já existe credencial. O campo de
   // chave permanece vazio de propósito: a chave nunca é devolvida pelo backend.
   useEffect(() => {
      if (status.configured) {
         if (status.provider) setProvider(status.provider);
         setModel(status.model ?? '');
         setBaseUrl(status.base_url ?? '');
      }
   }, [status]);

   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);
      setSuccess(null);
      if (apiKey.trim().length < 8) {
         setFormError('Informe a API key (mínimo 8 caracteres).');
         return;
      }
      setBusy(true);
      try {
         await save({
            provider,
            api_key: apiKey.trim(),
            model: model.trim() || null,
            base_url: baseUrl.trim() || null,
         });
         setApiKey('');
         setSuccess('Credencial salva. O Mentor passará a usar a sua chave.');
      } catch (err) {
         setFormError(
            err instanceof ApiError ? err.message : 'Não foi possível salvar a credencial.',
         );
      } finally {
         setBusy(false);
      }
   };

   const handleRemove = async () => {
      setFormError(null);
      setSuccess(null);
      setBusy(true);
      try {
         await remove();
         setApiKey('');
         setModel('');
         setBaseUrl('');
         setSuccess('Credencial removida. O Mentor voltará à configuração padrão.');
      } catch (err) {
         setFormError(
            err instanceof ApiError ? err.message : 'Não foi possível remover a credencial.',
         );
      } finally {
         setBusy(false);
      }
   };

   if (isLoading) {
      return <Spinner label="Carregando credencial de IA..." />;
   }

   const activeHint = PROVIDER_OPTIONS.find((opt) => opt.value === provider)?.hint;

   return (
      <div className={styles.editor}>
         {error && <ErrorState description={error.message} />}

         {status.configured && (
            <div className={styles.current}>
               <div className={styles.currentInfo}>
                  <span className={styles.badge}>Configurada</span>
                  <span className={styles.currentText}>
                     {providerLabel(status.provider)} · {status.key_masked}
                     {status.model ? ` · ${status.model}` : ''}
                  </span>
               </div>
               <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void handleRemove()}
                  disabled={busy}
               >
                  Remover
               </Button>
            </div>
         )}

         {formError && <ErrorState description={formError} />}
         {success && <div className={styles.feedback}>{success}</div>}

         <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
               <label className={styles.label} htmlFor={selectId}>
                  Provedor
               </label>
               <select
                  id={selectId}
                  className={styles.select}
                  value={provider}
                  onChange={(event) => setProvider(event.target.value as AIProviderKind)}
               >
                  {PROVIDER_OPTIONS.map((opt) => (
                     <option key={opt.value} value={opt.value}>
                        {opt.label}
                     </option>
                  ))}
               </select>
               {activeHint && <span className={styles.hint}>{activeHint}</span>}
            </div>

            <Input
               label="API key"
               type="password"
               autoComplete="off"
               placeholder={status.configured ? 'Reenvie a chave para atualizar' : 'Cole sua API key'}
               value={apiKey}
               onChange={(event) => setApiKey(event.target.value)}
               hint="Sua chave é cifrada no servidor e nunca é exibida de volta."
            />
            <Input
               label="Modelo (opcional)"
               placeholder="Em branco usa o modelo padrão do provedor"
               value={model}
               onChange={(event) => setModel(event.target.value)}
            />
            <Input
               label="Base URL (opcional)"
               placeholder="Só para endpoint compatível customizado"
               value={baseUrl}
               onChange={(event) => setBaseUrl(event.target.value)}
            />
            <div className={styles.actions}>
               <Button type="submit" variant="primary" isLoading={busy}>
                  {status.configured ? 'Atualizar chave' : 'Salvar chave'}
               </Button>
            </div>
         </form>
      </div>
   );
}
