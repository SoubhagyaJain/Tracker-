import { aggregate, daysBetween, range, shift, targetMinutes } from './logic';
import type { Progress } from './progress-schema';
import { roadmap } from './roadmap';

export const paceWindowDays = 28;
export const minimumPaceDays = 14;

const goals = [
  { id: 'internship-gate', label: 'June internship' },
  { id: 'deadline', label: 'December 2027 goal' },
] as const;

const statusLabels = {
  'target-met': 'Hours target met',
  'target-missed': 'Hours target missed',
  'due-today': 'Due today',
  'collecting': 'Gathering data',
  'on-track': 'On track',
  'behind': 'Behind pace',
} as const;

export type ForecastStatus = keyof typeof statusLabels;

export function forecastStudyPace(data: Progress, today: string) {
  const yesterday = shift(today, -1);
  const firstLog = data.sessions.reduce<string | null>((earliest, session) =>
    session.date <= yesterday && (!earliest || session.date < earliest) ? session.date : earliest, null);
  const windowStart = shift(today, -paceWindowDays);
  const from = firstLog && firstLog > windowStart ? firstLog : windowStart;
  const daysObserved = firstLog ? daysBetween(from, today) : 0;
  const weeklyMinutes = daysObserved >= minimumPaceDays ? aggregate(data, from, yesterday) * 7 / daysObserved : null;

  // The selected roadmap capacity defines the goals. A temporary exam
  // schedule doesn't lower the cumulative milestone targets.
  const baseline = { ...data, settings: { ...data.settings, examUntil: '' } };
  const forecasts = goals.map(goal => {
    const milestone = roadmap.milestones.find(item => item.id === goal.id)!;
    const deadline = milestone.date;
    const targetMinutesByDeadline = range(roadmap.starts, deadline)
      .reduce((total, date) => total + targetMinutes(baseline, date), 0);
    const loggedMinutes = aggregate(data, roadmap.starts, today < deadline ? today : deadline);
    const remainingMinutes = Math.max(0, targetMinutesByDeadline - loggedMinutes);
    const firstProjectedDay = today < roadmap.starts ? roadmap.starts : shift(today, 1);
    const daysLeft = Math.max(0, daysBetween(firstProjectedDay, deadline) + 1);
    const projectedMinutes = weeklyMinutes !== null && daysLeft > 0
      ? loggedMinutes + weeklyMinutes * daysLeft / 7
      : null;
    const requiredWeeklyMinutes = daysLeft > 0 ? remainingMinutes * 7 / daysLeft : null;
    const gapMinutes = projectedMinutes === null ? null : projectedMinutes - targetMinutesByDeadline;

    let status: ForecastStatus;
    if (remainingMinutes === 0) status = 'target-met';
    else if (today > deadline) status = 'target-missed';
    else if (today === deadline) status = 'due-today';
    else if (gapMinutes === null) status = 'collecting';
    else status = gapMinutes >= -1e-8 ? 'on-track' : 'behind';

    return {
      ...goal, deadline, gateId: milestone.taskIds[0], targetMinutes: targetMinutesByDeadline, loggedMinutes,
      remainingMinutes, projectedMinutes, requiredWeeklyMinutes, gapMinutes,
      status, statusLabel: statusLabels[status],
    };
  });

  return { from, through: yesterday, daysObserved, weeklyMinutes, goals: forecasts };
}

