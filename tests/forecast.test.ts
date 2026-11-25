import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forecastStudyPace } from '../lib/forecast';
import { shift } from '../lib/logic';
import { emptyProgress, type StudySession } from '../lib/progress-schema';

const session = (date: string, minutes: number): StudySession => ({
  id: date, date, minutes, title: 'Study', category: 'Learning', taskId: '', skillId: '', notes: '',
});

test('an empty forecast shows roadmap targets and required pace at each capacity', () => {
  const data = emptyProgress();
  data.settings.examUntil = '2026-12-10';
  for (const [capacity, juneHours, decemberHours] of [[20, 500, 1040], [30, 750, 1560], [40, 1000, 2080]] as const) {
    data.settings.capacity = capacity;
    const result = forecastStudyPace(data, '2026-11-25');
    assert.equal(result.weeklyMinutes, null);
    assert.equal(result.daysObserved, 0);
    const [june, december] = result.goals;
    assert.equal(june.deadline, '2027-06-07');
    assert.equal(december.deadline, '2027-12-31');
    assert.equal(june.targetMinutes, juneHours * 60);
    assert.equal(december.targetMinutes, decemberHours * 60);
    assert.equal(june.status, 'collecting');
    assert.equal(june.projectedMinutes, null);
    assert.ok(Math.abs(june.requiredWeeklyMinutes! - juneHours * 60 / 27) < 1e-8);
  }
});

test('forecasts use the last 28 completed days and can differ at the two deadlines', () => {
  const data = emptyProgress();
  const today = '2027-01-01';
  data.sessions = Array.from({length: 28}, (_, index) => session(shift(today, index - 28), 240));
  data.sessions.push(session('2027-02-01', 600));
  const result = forecastStudyPace(data, today);
  assert.equal(result.daysObserved, 28);
  assert.equal(result.from, '2026-12-04');
  assert.equal(result.through, '2026-12-31');
  assert.equal(result.weeklyMinutes, 28 * 60);
  const [june, december] = result.goals;
  assert.equal(june.loggedMinutes, 112 * 60);
  assert.equal(june.projectedMinutes, 740 * 60);
  assert.equal(june.gapMinutes, -10 * 60);
  assert.equal(june.status, 'behind');
  assert.equal(december.projectedMinutes, 1568 * 60);
  assert.equal(december.status, 'on-track');
  data.sessions.push(session(today, 600));
  const revised = forecastStudyPace(data, today);
  assert.equal(revised.weeklyMinutes, result.weeklyMinutes);
  assert.equal(revised.goals[0].status, 'on-track');
  assert.equal(revised.goals[0].gapMinutes, 0);
});

test('pre-roadmap logs inform pace after two weeks without counting toward goal totals', () => {
  const data = emptyProgress();
  data.sessions = [session('2026-11-01', 120), session('2026-11-03', 600)];
  assert.equal(forecastStudyPace(data, '2026-11-14').weeklyMinutes, null);
  const ready = forecastStudyPace(data, '2026-11-15');
  assert.equal(ready.daysObserved, 14);
  assert.equal(ready.weeklyMinutes, 360);
  assert.equal(ready.goals[0].loggedMinutes, 0);
  assert.equal(ready.goals[0].projectedMinutes, 27 * 360);
  assert.equal(forecastStudyPace(data, '2027-02-01').weeklyMinutes, 0);
});

test('a deadline becomes due today and its result uses hours logged by that date', () => {
  const data = emptyProgress();
  data.sessions = [session('2027-06-07', 120), session('2027-06-08', 120)];
  const due = forecastStudyPace(data, '2027-06-07').goals[0];
  assert.equal(due.status, 'due-today');
  assert.equal(due.requiredWeeklyMinutes, null);
  assert.equal(due.loggedMinutes, 120);
  const past = forecastStudyPace(data, '2027-06-09');
  assert.equal(past.goals[0].status, 'target-missed');
  assert.equal(past.goals[0].projectedMinutes, null);
  assert.equal(past.goals[0].loggedMinutes, 120);
  assert.equal(past.goals[1].loggedMinutes, 240);
  data.sessions = Array.from({length: 75}, (_, index) => session(shift('2026-12-01', index), 600));
  assert.equal(forecastStudyPace(data, '2027-06-09').goals[0].status, 'target-met');
});

