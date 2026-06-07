import { useState } from 'react';
import type { Ticket } from '../../../types/api';
import styles from './TicketCard.module.css';

export interface TicketCardProps {
   ticket: Ticket;
   defaultOpen?: boolean;
   /**
    * Quando fornecido, cada conceito vira um link clicável que abre a
    * explicação em uma **nova guia** (target="_blank") — facilita uso em
    * pairing e consulta paralela sem perder a trilha original.
    */
   conceptHref?(concept: string): string;
}

export function TicketCard({ ticket, defaultOpen = false, conceptHref }: TicketCardProps) {
   const [isOpen, setOpen] = useState(defaultOpen);
   const bodyId = `ticket-${ticket.code}-body`;

   return (
      <article className={styles.ticket}>
         <button
            type="button"
            className={styles.summary}
            aria-expanded={isOpen}
            aria-controls={bodyId}
            onClick={() => setOpen((value) => !value)}
         >
            <div className={styles.titleArea}>
               <div>
                  <span className={styles.code}>{ticket.code}</span>
                  <span className={styles.title}>{ticket.title}</span>
               </div>
               <p className={styles.objective}>{ticket.objective}</p>
            </div>
            <span className={styles.chevron} aria-hidden="true" />
         </button>

         {isOpen && (
            <div id={bodyId} className={styles.body}>
               {ticket.personalization_notes && (
                  <section className={styles.personalization}>
                     <h3 className={styles.sectionTitle}>Calibrado para você</h3>
                     <p>{ticket.personalization_notes}</p>
                  </section>
               )}

               {ticket.concepts.length > 0 && (
                  <section>
                     <h3 className={styles.sectionTitle}>Conceitos abordados</h3>
                     <div className={styles.chips}>
                        {ticket.concepts.map((concept) =>
                           conceptHref ? (
                              <a
                                 key={concept}
                                 className={`${styles.chip} ${styles.chipInteractive}`}
                                 href={conceptHref(concept)}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 aria-label={`Aprofundar conceito ${concept} (abre em nova guia)`}
                              >
                                 {concept}
                              </a>
                           ) : (
                              <span key={concept} className={styles.chip}>
                                 {concept}
                              </span>
                           ),
                        )}
                     </div>
                     {conceptHref && (
                        <p className={styles.chipHint}>
                           Clique em um conceito para abrir a explicação aprofundada
                           em uma nova guia.
                        </p>
                     )}
                  </section>
               )}

               {ticket.tasks.length > 0 && (
                  <section>
                     <h3 className={styles.sectionTitle}>Tarefas</h3>
                     <ul className={styles.list}>
                        {ticket.tasks.map((task, index) => (
                           <li key={`${ticket.code}-task-${index}`}>{task.description}</li>
                        ))}
                     </ul>
                  </section>
               )}

               {ticket.acceptance_criteria.length > 0 && (
                  <section>
                     <h3 className={styles.sectionTitle}>Critérios de aceite</h3>
                     <ul className={styles.list}>
                        {ticket.acceptance_criteria.map((criteria, index) => (
                           <li key={`${ticket.code}-ac-${index}`}>{criteria}</li>
                        ))}
                     </ul>
                  </section>
               )}

               {ticket.estimated_effort && (
                  <p className={styles.effort}>Esforço estimado: {ticket.estimated_effort}</p>
               )}
            </div>
         )}
      </article>
   );
}
