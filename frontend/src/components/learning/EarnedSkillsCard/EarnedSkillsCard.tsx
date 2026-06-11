import { useMemo } from 'react';
import type { Skill, Ticket } from '../../../types/api';
import styles from './EarnedSkillsCard.module.css';

export interface EarnedSkillsCardProps {
   /**
    * Skills genéricas que o aluno vai adicionar/elevar ao concluir.
    * Geradas pelo Mentor na criação da trilha (`TrailContent.skill_categories`).
    */
   categories: string[];
   /**
    * Tickets — só usado como FALLBACK quando `categories` está vazio (trilhas
    * geradas antes do campo existir). Quando há categorias, o componente
    * ignora os tickets.
    */
   tickets?: Ticket[];
   /** Skills atuais do perfil; define o que entra como nova vs. já existente. */
   currentSkills: Skill[];
   /** Quando true, mostra o estado pós-conclusão. */
   completed?: boolean;
   /** Categorias que ENTRARAM no perfil agora (lowercase). */
   addedConcepts?: string[];
   /** Categorias já existentes que foram ELEVADAS (lowercase). */
   upgradedConcepts?: string[];
}

function fallbackFromTickets(tickets: Ticket[]): string[] {
   const seen = new Set<string>();
   const out: string[] = [];
   for (const ticket of tickets) {
      for (const concept of ticket.concepts) {
         const normalized = concept.trim();
         if (!normalized) continue;
         const key = normalized.toLowerCase();
         if (seen.has(key)) continue;
         seen.add(key);
         out.push(normalized);
      }
   }
   return out;
}

export function EarnedSkillsCard({
   categories,
   tickets = [],
   currentSkills,
   completed = false,
   addedConcepts = [],
   upgradedConcepts = [],
}: EarnedSkillsCardProps) {
   // Fonte primária: categorias (lowercase, já abstraídas). Fallback:
   // concepts dos tickets (trilhas legadas geradas antes do campo existir).
   const items = useMemo(() => {
      if (categories.length > 0) return categories;
      return fallbackFromTickets(tickets);
   }, [categories, tickets]);

   const ownedNames = useMemo(
      () => new Set(currentSkills.map((s) => s.name.toLowerCase())),
      [currentSkills],
   );

   if (items.length === 0) return null;

   const newOnes = items.filter((c) => !ownedNames.has(c.toLowerCase()));
   const owned = items.filter((c) => ownedNames.has(c.toLowerCase()));

   const eyebrow = completed ? 'Skills adicionadas' : 'Skills que você vai ganhar';
   const description = completed
      ? 'Estas skills passaram a fazer parte do seu perfil — você pode ajustar o nível na sua conta.'
      : 'Ao concluir esta trilha, estas skills genéricas entram no seu perfil em nível beginner. Skills que você já tem ficam destacadas.';

   return (
      <section
         className={styles.wrapper}
         aria-label="Skills que você vai ganhar ao concluir esta trilha"
      >
         <header className={styles.header}>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <p className={styles.description}>{description}</p>
         </header>

         {completed ? (
            <div className={styles.completedGroups}>
               {addedConcepts.length > 0 && (
                  <div className={styles.group}>
                     <span className={styles.groupLabel}>Novas</span>
                     <ul className={styles.chipList}>
                        {addedConcepts.map((name) => (
                           <li key={`added-${name}`}>
                              <span className={`${styles.chip} ${styles.chipNew}`}>
                                 {name}
                                 <span className={styles.chipMeta}>beginner</span>
                              </span>
                           </li>
                        ))}
                     </ul>
                  </div>
               )}
               {upgradedConcepts.length > 0 && (
                  <div className={styles.group}>
                     <span className={styles.groupLabel}>Reforçadas</span>
                     <ul className={styles.chipList}>
                        {upgradedConcepts.map((name) => (
                           <li key={`up-${name}`}>
                              <span
                                 className={`${styles.chip} ${styles.chipUpgraded}`}
                              >
                                 {name}
                              </span>
                           </li>
                        ))}
                     </ul>
                  </div>
               )}
               {addedConcepts.length === 0 && upgradedConcepts.length === 0 && (
                  <p className={styles.emptyNote}>
                     As skills desta trilha já estavam no seu perfil — nada
                     foi alterado.
                  </p>
               )}
            </div>
         ) : (
            <div className={styles.preview}>
               {newOnes.length > 0 && (
                  <div className={styles.group}>
                     <span className={styles.groupLabel}>
                        Novas no seu perfil ({newOnes.length})
                     </span>
                     <ul className={styles.chipList}>
                        {newOnes.map((name) => (
                           <li key={`new-${name}`}>
                              <span className={`${styles.chip} ${styles.chipNew}`}>
                                 {name}
                                 <span className={styles.chipMeta}>beginner</span>
                              </span>
                           </li>
                        ))}
                     </ul>
                  </div>
               )}
               {owned.length > 0 && (
                  <div className={styles.group}>
                     <span className={styles.groupLabel}>
                        Você já tem ({owned.length})
                     </span>
                     <ul className={styles.chipList}>
                        {owned.map((name) => {
                           const profile = currentSkills.find(
                              (s) => s.name.toLowerCase() === name.toLowerCase(),
                           );
                           const willUpgrade =
                              !!profile && profile.proficiency < 2;
                           return (
                              <li key={`owned-${name}`}>
                                 <span
                                    className={`${styles.chip} ${styles.chipOwned}`}
                                 >
                                    {name}
                                    {profile && (
                                       <span className={styles.chipMeta}>
                                          {profile.proficiency_label}
                                          {willUpgrade ? ' → beginner' : ''}
                                       </span>
                                    )}
                                 </span>
                              </li>
                           );
                        })}
                     </ul>
                  </div>
               )}
            </div>
         )}
      </section>
   );
}
