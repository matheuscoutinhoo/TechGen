import { useMemo } from 'react';
import type { Skill, Ticket } from '../../../types/api';
import styles from './EarnedSkillsCard.module.css';

export interface EarnedSkillsCardProps {
   tickets: Ticket[];
   /** Skills atuais do perfil — define o que vai entrar como nova vs. existente. */
   currentSkills: Skill[];
   /** Quando true, mostra o estado pós-conclusão (skills foram adicionadas). */
   completed?: boolean;
   /**
    * Quando vier do endpoint /complete: nomes que ENTRARAM agora no perfil.
    * Lowercase, como o backend devolve. Aplicável só se `completed` for true.
    */
   addedConcepts?: string[];
   /**
    * Conceitos que já existiam e foram elevados (lowercase). Mostrados como
    * "reforçadas" no estado pós-conclusão.
    */
   upgradedConcepts?: string[];
}

function dedupeConcepts(tickets: Ticket[]): string[] {
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
   tickets,
   currentSkills,
   completed = false,
   addedConcepts = [],
   upgradedConcepts = [],
}: EarnedSkillsCardProps) {
   const concepts = useMemo(() => dedupeConcepts(tickets), [tickets]);

   const ownedNames = useMemo(
      () => new Set(currentSkills.map((s) => s.name.toLowerCase())),
      [currentSkills],
   );

   if (concepts.length === 0) return null;

   // Antes de concluir: separa em "novas para o perfil" vs. "você já tem".
   const newOnes = concepts.filter((c) => !ownedNames.has(c.toLowerCase()));
   const owned = concepts.filter((c) => ownedNames.has(c.toLowerCase()));

   const eyebrow = completed ? 'Skills adicionadas' : 'Skills que você ganhará';
   const description = completed
      ? 'Os conceitos abaixo passaram a fazer parte do seu perfil — você pode ajustar o nível na sua conta.'
      : 'Ao concluir esta trilha, os conceitos abaixo entram no seu perfil em nível beginner. Skills que você já tem ficam destacadas.';

   return (
      <section
         className={styles.wrapper}
         aria-label="Skills que você ganhará ao concluir esta trilha"
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
                        {addedConcepts.map((concept) => (
                           <li key={`added-${concept}`}>
                              <span className={`${styles.chip} ${styles.chipNew}`}>
                                 {concept}
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
                        {upgradedConcepts.map((concept) => (
                           <li key={`up-${concept}`}>
                              <span
                                 className={`${styles.chip} ${styles.chipUpgraded}`}
                              >
                                 {concept}
                              </span>
                           </li>
                        ))}
                     </ul>
                  </div>
               )}
               {addedConcepts.length === 0 && upgradedConcepts.length === 0 && (
                  <p className={styles.emptyNote}>
                     Os conceitos desta trilha já estavam no seu perfil — nada
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
                        {newOnes.map((concept) => (
                           <li key={`new-${concept}`}>
                              <span className={`${styles.chip} ${styles.chipNew}`}>
                                 {concept}
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
                        {owned.map((concept) => {
                           const profile = currentSkills.find(
                              (s) => s.name.toLowerCase() === concept.toLowerCase(),
                           );
                           const willUpgrade =
                              !!profile && profile.proficiency < 2;
                           return (
                              <li key={`owned-${concept}`}>
                                 <span
                                    className={`${styles.chip} ${styles.chipOwned}`}
                                 >
                                    {concept}
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

         {!completed && (
            <p className={styles.footnote}>
               Total de conceitos cobertos: <strong>{concepts.length}</strong>.
               Reaproveitamos os nomes dos conceitos de cada ticket; ajustamos
               proficiência apenas quando o concluir vê que você ainda não
               tinha o conceito.
            </p>
         )}
      </section>
   );
}
