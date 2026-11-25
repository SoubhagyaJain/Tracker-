import Link from 'next/link';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import { forecastStudyPace, minimumPaceDays, paceWindowDays, type ForecastStatus } from '@/lib/forecast';
import { dateLabel, progressFor, readiness, shortHours } from '@/lib/logic';
import { roadmap } from '@/lib/roadmap';
import type { Progress } from '@/lib/progress-schema';
import { Disclosure, Panel, PanelHeader } from './ui';

type GoalForecast = ReturnType<typeof forecastStudyPace>['goals'][number];

function PaceStatus({ label, status }: { label: string; status: ForecastStatus }) {
  const comfortable = status === 'on-track' || status === 'target-met';
  const attention = status === 'behind' || status === 'due-today' || status === 'target-missed';
  const color = comfortable ? 'status-completed' : attention ? 'status-overdue' : '';
  return <span className={'status ' + color}>{label}</span>;
}

export function ForecastSummary({ goals }: { goals: GoalForecast[] }) {
  return <Link className="pace-summary" href="/analytics/#study-forecast">
    <span className="pace-summary-heading"><TrendingUp size={13}/> Study pace <ArrowUpRight size={13}/></span>
    {goals.map(goal => <span className="pace-summary-row" key={goal.id}>
      <span>{goal.id === 'internship-gate' ? 'June internship' : 'December goal'}</span>
      <PaceStatus label={goal.statusLabel} status={goal.status}/>
    </span>)}
  </Link>;
}

function hours(minutes: number) {
  return minutes > 0 && minutes < 3 ? '<0.1h' : shortHours(minutes) + 'h';
}

function ForecastGoal({ goal, evidence }: { goal: GoalForecast; evidence: string }) {
  const barTotal = Math.max(goal.targetMinutes, goal.projectedMinutes ?? 0, goal.loggedMinutes);
  const logged = goal.loggedMinutes / barTotal * 100;
  const projected = ((goal.projectedMinutes ?? goal.loggedMinutes) - goal.loggedMinutes) / barTotal * 100;
  const target = goal.targetMinutes / barTotal * 100;
  const gap = goal.gapMinutes;
  const outcome = goal.status === 'due-today' ? hours(goal.remainingMinutes) + ' left today'
    : goal.status === 'target-missed' ? hours(goal.remainingMinutes) + ' short at the deadline'
    : gap === null ? null
    : Math.abs(gap) < 1e-8 ? 'Projected to meet the hours target'
    : hours(Math.abs(gap)) + (gap > 0 ? ' above the target' : ' short at the current pace');

  return <section className="pace-goal" aria-label={goal.label}>
    <header className="pace-goal-head">
      <div><h3>{goal.label}</h3><time dateTime={goal.deadline}>{dateLabel(goal.deadline, 'd MMM yyyy')}</time></div>
      <PaceStatus label={goal.statusLabel} status={goal.status}/>
    </header>
    <div className="pace-track" aria-hidden="true">
      <span className="pace-track-logged" style={{ width: logged + '%' }}/>
      <span className="pace-track-estimate" style={{ width: projected + '%' }}/>
      <span className="pace-track-target" style={{ left: 'calc(' + target + '% - 1px)' }}/>
    </div>
    <dl className="pace-totals">
      <div><dt>Logged</dt><dd>{hours(goal.loggedMinutes)}</dd></div>
      <div><dt>Plan target</dt><dd>{hours(goal.targetMinutes)}</dd></div>
      <div><dt>Projected</dt><dd>{goal.projectedMinutes === null ? '—' : hours(goal.projectedMinutes)}</dd></div>
    </dl>
    <div className="pace-goal-details">
      {outcome && <p>{outcome}</p>}
      {goal.remainingMinutes > 0 && goal.requiredWeeklyMinutes !== null && <p><strong>{hours(goal.requiredWeeklyMinutes)}/week</strong> needed from here</p>}
      <p className="muted">{evidence}</p>
    </div>
  </section>;
}

export function StudyForecast({ data, day }: { data: Progress; day: string }) {
  const forecast = forecastStudyPace(data, day);
  const requirements = readiness(data);
  const tasks = progressFor(data);
  return <div id="study-forecast" className="span-full">
    <Panel className="forecast-panel">
      <PanelHeader title="Study pace forecast" action={<TrendingUp size={20} aria-hidden="true"/>}/>
      <div className="pace-current">
        {forecast.weeklyMinutes === null
          ? <p><strong>{forecast.daysObserved}/{minimumPaceDays} days observed.</strong> Log study time to start building your forecast.</p>
          : <p><strong>{hours(forecast.weeklyMinutes)}/week</strong> logged on average from {dateLabel(forecast.from)} to {dateLabel(forecast.through)} ({forecast.daysObserved} days).</p>}
      </div>
      <div className="pace-goals">
        {forecast.goals.map(goal => {
          const gate = data.gates[goal.gateId];
          const evidence = goal.id === 'internship-gate'
            ? requirements.filter(item => item.done).length + '/' + requirements.length + ' internship requirements met · May gate ' + (gate?.status ?? 'Pending').toLowerCase()
            : tasks.done + '/' + tasks.total + ' roadmap tasks completed · final gate ' + (gate?.status ?? 'Pending').toLowerCase();
          return <ForecastGoal key={goal.id} goal={goal} evidence={evidence}/>;
        })}
      </div>
      <Disclosure title="How the forecast works">
        <p>Your pace uses up to {paceWindowDays} completed calendar days, starting with your first study log. Days without a log count as zero. The forecast needs at least {minimumPaceDays} days of history and assumes your average continues through each deadline. Study logged today counts toward your total immediately.</p>
        <p>Targets follow the {data.settings.capacity}h study capacity over the roadmap’s scheduled weeks. Exam mode adjusts your schedule. Study before the roadmap starts can inform your pace. Hours logged from {dateLabel(roadmap.starts, 'd MMM yyyy')} through each deadline count toward its target.</p>
        <p>The status measures study hours. Internship readiness and competency gates are tracked alongside it. Hiring outcomes depend on factors beyond study time.</p>
      </Disclosure>
    </Panel>
  </div>;
}

