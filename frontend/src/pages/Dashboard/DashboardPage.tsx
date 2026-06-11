import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLearningTrails } from '../../hooks/useLearningTrails';
import { useSkills } from '../../hooks/useSkills';
import { PageTitle } from '../../components/ui/PageTitle';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { TrailProgress } from '../../components/learning/TrailProgress';
import { formatDate } from '../../utils/format';
import type { LearningTrailSummary, Skill, ProficiencyLevel } from '../../types/api';
import styles from './Dashboard.module.css';

const WEEKS_WINDOW = 8;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

const LEVEL_LABEL: Record<ProficiencyLevel, string> = {
   1: 'novice',
   2: 'beginner',
   3: 'intermediate',
   4: 'advanced',
};

interface KpiProps {
   eyebrow: string;
   value: string | number;
   trend?: { label: string; tone: 'positive' | 'neutral' | 'negative' };
   hint?: string;
}

function Kpi({ eyebrow, value, trend, hint }: KpiProps) {
   const trendClass = trend
      ? [
         styles.kpiTrend,
         trend.tone === 'positive'
            ? styles.kpiTrendPositive
            : trend.tone === 'negative'
               ? styles.kpiTrendNegative
               : '',
      ]
         .filter(Boolean)
         .join(' ')
      : undefined;
   return (
      <article className={styles.kpi}>
         <header className={styles.kpiHeader}>
            <span className={styles.kpiEyebrow}>{eyebrow}</span>
            {trend && <span className={trendClass}>{trend.label}</span>}
         </header>
         <strong className={styles.kpiValue}>{value}</strong>
         {hint && <span className={styles.kpiHint}>{hint}</span>}
      </article>
   );
}

interface ActivityPoint {
   weekStart: Date;
   activeTrails: number;
   completedTickets: number;
}

function buildActivity(trails: LearningTrailSummary[]): ActivityPoint[] {
   // Bucket por semana baseado em trail.updated_at (proxy honesto de atividade,
   // já que cada conclusão de ticket atualiza updated_at).
   const now = new Date();
   const weekZero = startOfWeek(now);
   const buckets: ActivityPoint[] = Array.from({ length: WEEKS_WINDOW }, (_, i) => ({
      weekStart: new Date(weekZero.getTime() - (WEEKS_WINDOW - 1 - i) * MS_PER_WEEK),
      activeTrails: 0,
      completedTickets: 0,
   }));

   trails.forEach((trail) => {
      const updatedAt = new Date(trail.updated_at);
      const idx = Math.floor((weekZero.getTime() - startOfWeek(updatedAt).getTime()) / MS_PER_WEEK);
      const bucketIdx = WEEKS_WINDOW - 1 - idx;
      if (bucketIdx < 0 || bucketIdx >= WEEKS_WINDOW) return;
      buckets[bucketIdx].activeTrails += 1;
      buckets[bucketIdx].completedTickets += trail.completed_ticket_count;
   });
   return buckets;
}

function startOfWeek(date: Date): Date {
   const d = new Date(date);
   const day = d.getDay();
   const diff = (day === 0 ? -6 : 1) - day;
   d.setDate(d.getDate() + diff);
   d.setHours(0, 0, 0, 0);
   return d;
}

interface ActivityChartProps {
   points: ActivityPoint[];
}

function ActivityChart({ points }: ActivityChartProps) {
   const width = 720;
   const height = 180;
   const padding = { top: 16, right: 12, bottom: 28, left: 12 };
   const innerW = width - padding.left - padding.right;
   const innerH = height - padding.top - padding.bottom;
   const maxY = Math.max(1, ...points.map((p) => p.completedTickets));
   const stepX = points.length > 1 ? innerW / (points.length - 1) : innerW;

   const linePoints = points
      .map((p, i) => {
         const x = padding.left + i * stepX;
         const y = padding.top + innerH - (p.completedTickets / maxY) * innerH;
         return `${x},${y}`;
      })
      .join(' ');
   const areaPath = `M ${padding.left},${padding.top + innerH} L ${linePoints
      .split(' ')
      .join(' L ')} L ${padding.left + (points.length - 1) * stepX},${padding.top + innerH} Z`;

   const fmtWeek = (d: Date) =>
      d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

   return (
      <svg
         className={styles.chart}
         viewBox={`0 0 ${width} ${height}`}
         preserveAspectRatio="none"
         role="img"
         aria-label="Tickets concluídos por semana"
      >
         <defs>
            <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
               <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
               <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
         </defs>
         {[0.25, 0.5, 0.75].map((ratio) => (
            <line
               key={ratio}
               x1={padding.left}
               x2={padding.left + innerW}
               y1={padding.top + innerH * ratio}
               y2={padding.top + innerH * ratio}
               stroke="var(--color-border)"
               strokeDasharray="2 6"
            />
         ))}
         <path d={areaPath} fill="url(#activityFill)" />
         <polyline
            points={linePoints}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
         />
         {points.map((p, i) => {
            const x = padding.left + i * stepX;
            const y = padding.top + innerH - (p.completedTickets / maxY) * innerH;
            return (
               <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={3}
                  fill="var(--color-bg)"
                  stroke="var(--color-primary)"
                  strokeWidth="2"
               />
            );
         })}
         {points.map((p, i) => {
            const x = padding.left + i * stepX;
            return (
               <text
                  key={`label-${i}`}
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  fill="var(--color-text-subtle)"
                  fontSize="10"
                  fontFamily="var(--font-sans)"
               >
                  {fmtWeek(p.weekStart)}
               </text>
            );
         })}
      </svg>
   );
}

interface SkillsBreakdownProps {
   skills: Skill[];
}

function SkillsBreakdown({ skills }: SkillsBreakdownProps) {
   const counts = useMemo(() => {
      const buckets: Record<ProficiencyLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      skills.forEach((s) => {
         buckets[s.proficiency] += 1;
      });
      return buckets;
   }, [skills]);
   const total = skills.length || 1;
   const rows: { level: ProficiencyLevel; label: string; tone: string }[] = [
      { level: 4, label: LEVEL_LABEL[4], tone: styles.barAdvanced },
      { level: 3, label: LEVEL_LABEL[3], tone: styles.barIntermediate },
      { level: 2, label: LEVEL_LABEL[2], tone: styles.barBeginner },
      { level: 1, label: LEVEL_LABEL[1], tone: styles.barNovice },
   ];
   return (
      <ul className={styles.breakdown}>
         {rows.map(({ level, label, tone }) => {
            const count = counts[level];
            const pct = Math.round((count / total) * 100);
            return (
               <li key={level} className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>{label}</span>
                  <span className={styles.breakdownBar}>
                     <span
                        className={`${styles.breakdownFill} ${tone}`}
                        style={{ width: `${pct}%` }}
                     />
                  </span>
                  <span className={styles.breakdownCount}>{count}</span>
               </li>
            );
         })}
      </ul>
   );
}

export function DashboardPage() {
   const { user } = useAuth();
   const { trails, isLoading: trailsLoading, error: trailsError, refetch } =
      useLearningTrails();
   const { skills: rawSkills, isLoading: skillsLoading, error: skillsError } =
      useSkills();
   const skills: Skill[] = Array.isArray(rawSkills) ? rawSkills : [];
   const navigate = useNavigate();

   const metrics = useMemo(() => {
      const totalTrails = trails.length;
      const completedTrails = trails.filter((t) => Boolean(t.completed_at)).length;
      const inProgress = totalTrails - completedTrails;
      const totalTickets = trails.reduce((sum, t) => sum + t.ticket_count, 0);
      const completedTickets = trails.reduce(
         (sum, t) => sum + t.completed_ticket_count,
         0,
      );
      const completionRate =
         totalTickets > 0 ? Math.round((completedTickets / totalTickets) * 100) : 0;
      const mastered = skills.filter((s) => s.proficiency >= 3).length;
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const ticketsThisWeek = trails
         .filter((t) => new Date(t.updated_at).getTime() >= oneWeekAgo)
         .reduce((sum, t) => sum + t.completed_ticket_count, 0);
      return {
         totalTrails,
         completedTrails,
         inProgress,
         totalTickets,
         completedTickets,
         completionRate,
         mastered,
         ticketsThisWeek,
      };
   }, [trails, skills]);

   const continueList = useMemo(
      () =>
         [...trails]
            .filter((t) => !t.completed_at && t.ticket_count > 0)
            .sort(
               (a, b) =>
                  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
            )
            .slice(0, 3),
      [trails],
   );

   const activity = useMemo(() => buildActivity(trails), [trails]);
   const isLoading = trailsLoading || skillsLoading;

   if (isLoading) {
      return <Spinner label="Carregando sua visão geral..." />;
   }

   if (trailsError) {
      return (
         <ErrorState
            description={trailsError.message}
            action={
               <Button variant="secondary" onClick={() => void refetch()}>
                  Tentar novamente
               </Button>
            }
         />
      );
   }

   if (trails.length === 0) {
      return (
         <>
            <PageTitle
               eyebrow={user ? `Olá, ${user.name.split(' ')[0]}` : undefined}
               title="Visão geral"
               description="Suas métricas, atividade e próximos passos aparecem aqui assim que você criar uma trilha."
            />
            <EmptyState
               title="Comece criando sua primeira trilha"
               description="Diga o tema que quer aprender e o Mentor constrói um projeto pedagógico em poucos segundos."
               actions={
                  <Button variant="primary" onClick={() => navigate('/trails/new')}>
                     Criar primeira trilha
                  </Button>
               }
            />
         </>
      );
   }

   return (
      <>
         <PageTitle
            eyebrow={user ? `Olá, ${user.name.split(' ')[0]}` : undefined}
            title="Visão geral"
            description="Suas métricas de aprendizado, atividade recente e onde continuar."
         />

         <section className={styles.kpiGrid} aria-label="Métricas principais">
            <Kpi
               eyebrow="Trilhas ativas"
               value={metrics.inProgress}
               trend={{
                  label: `${metrics.totalTrails} no total`,
                  tone: 'neutral',
               }}
               hint={
                  metrics.inProgress === 0
                     ? 'Todas as trilhas estão concluídas'
                     : `${metrics.inProgress === 1 ? 'Uma trilha' : `${metrics.inProgress} trilhas`} em andamento`
               }
            />
            <Kpi
               eyebrow="Tickets finalizados"
               value={metrics.completedTickets}
               trend={{
                  label:
                     metrics.ticketsThisWeek > 0
                        ? `+${metrics.ticketsThisWeek} esta semana`
                        : 'sem atividade na semana',
                  tone: metrics.ticketsThisWeek > 0 ? 'positive' : 'neutral',
               }}
               hint={`de ${metrics.totalTickets} no total · ${metrics.completionRate}% de conclusão`}
            />
            <Kpi
               eyebrow="Trilhas concluídas"
               value={metrics.completedTrails}
               trend={{
                  label:
                     metrics.totalTrails > 0
                        ? `${Math.round((metrics.completedTrails / metrics.totalTrails) * 100)}% das suas trilhas`
                        : '—',
                  tone: metrics.completedTrails > 0 ? 'positive' : 'neutral',
               }}
               hint={
                  metrics.completedTrails === 0
                     ? 'Conclua tickets para fechar uma trilha'
                     : 'Skills aplicadas no perfil'
               }
            />
            <Kpi
               eyebrow="Skills no perfil"
               value={skills.length}
               trend={{
                  label: `${metrics.mastered} no intermediate+`,
                  tone: metrics.mastered > 0 ? 'positive' : 'neutral',
               }}
               hint={
                  skillsError
                     ? 'Não foi possível carregar suas skills agora'
                     : 'Crescem automaticamente quando você conclui trilhas'
               }
            />
         </section>

         <section className={styles.chartCard} aria-label="Atividade ao longo do tempo">
            <header className={styles.chartHeader}>
               <div>
                  <h2 className={styles.cardTitle}>Atividade recente</h2>
                  <p className={styles.cardSubtitle}>
                     Tickets concluídos por semana — últimas {WEEKS_WINDOW} semanas.
                  </p>
               </div>
               <span className={styles.chartLegend}>
                  <span className={styles.legendDot} aria-hidden="true" />
                  tickets / semana
               </span>
            </header>
            <ActivityChart points={activity} />
         </section>

         <section className={styles.splitRow}>
            <article className={styles.splitCard} aria-label="Distribuição de skills">
               <header className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>Distribuição de skills</h2>
                  <p className={styles.cardSubtitle}>
                     Como seu perfil está nivelado por proficiência.
                  </p>
               </header>
               {skills.length === 0 ? (
                  <EmptyState
                     title="Sem skills ainda"
                     description="Adicione skills manualmente ou conclua trilhas para acumular automaticamente."
                     actions={
                        <Button
                           variant="secondary"
                           onClick={() => navigate('/account')}
                        >
                           Gerenciar skills
                        </Button>
                     }
                  />
               ) : (
                  <SkillsBreakdown skills={skills} />
               )}
            </article>

            <article className={styles.splitCard} aria-label="Continue de onde parou">
               <header className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>Continue de onde parou</h2>
                  <p className={styles.cardSubtitle}>
                     Suas trilhas em andamento mais recentes.
                  </p>
               </header>
               {continueList.length === 0 ? (
                  <p className={styles.allDone}>
                     Tudo em dia — nenhuma trilha em andamento.
                  </p>
               ) : (
                  <ul className={styles.continueList}>
                     {continueList.map((trail) => (
                        <li key={trail.id} className={styles.continueItem}>
                           <Link
                              to={`/trails/${trail.id}`}
                              className={styles.continueLink}
                           >
                              <div className={styles.continueHead}>
                                 <span className={styles.continueTopic}>
                                    {trail.topic}
                                 </span>
                                 <span className={styles.continueMeta}>
                                    {formatDate(trail.updated_at)}
                                 </span>
                              </div>
                              <strong className={styles.continueTitle}>
                                 {trail.title}
                              </strong>
                              <TrailProgress
                                 completed={trail.completed_ticket_count}
                                 total={trail.ticket_count}
                                 variant="compact"
                              />
                           </Link>
                        </li>
                     ))}
                  </ul>
               )}
               <footer className={styles.cardFoot}>
                  <Link to="/trails" className={styles.allTrailsLink}>
                     Ver todas as trilhas →
                  </Link>
               </footer>
            </article>
         </section>
      </>
   );
}
