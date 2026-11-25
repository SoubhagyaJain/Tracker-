import { addDays, differenceInCalendarDays, eachDayOfInterval, format, parseISO, startOfWeek } from 'date-fns';
import { roadmap, monthById, taskById } from './roadmap';
import type { LearningTask, RoadmapSource } from './roadmap-schema';
import { backupSchema, migrateProgress, schemaVersion, v1BackupSchema, type InterviewAttempt, type JobApplication, type Progress } from './progress-schema';

export function todayKey(timezone = 'Asia/Kolkata', now = new Date()) {
  const fields = new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(type=>fields.find(field=>field.type===type)!.value).join('-');
}
export const dateKey = (date: Date) => format(date,'yyyy-MM-dd');
export const shift = (day: string, amount: number) => dateKey(addDays(parseISO(day),amount));
export const daysBetween = (from: string, to: string) => differenceInCalendarDays(parseISO(to),parseISO(from));
export const dateLabel = (day: string, pattern = 'd MMM') => format(parseISO(day),pattern);
export const range = (from: string, to: string) => from>to?[]:eachDayOfInterval({start:parseISO(from),end:parseISO(to)}).map(dateKey);
export const weekStart = (day: string) => dateKey(startOfWeek(parseISO(day),{weekStartsOn:1}));
export const percent = (done: number,total: number) => total?Math.round(100*done/total):0;
export const shortHours = (minutes: number) => (minutes/60).toLocaleString('en',{maximumFractionDigits:1});
export function planDay(day: string) {
  const month = monthById.get(day.slice(0,7));
  const number = Number(day.slice(-2));
  const week = month?.weeks.find(week=>day>=week.start && day<=week.end);
  const type = !month ? 'Outside roadmap' : number>28 ? 'Flex' : number%7===0 ? 'Rest' : 'Study';
  return {month,week,number,type};
}
export function activeMonth(day: string) {
  return monthById.get(day.slice(0,7)) ?? (day<roadmap.starts?roadmap.months[0]:roadmap.months.at(-1)!);
}
export function capacityFor(data: Progress, day: string) {
  const exam = !!data.settings.examUntil && day<=data.settings.examUntil;
  const hours = exam ? 20 : data.settings.capacity;
  const plan = roadmap.capacity.find(mode=>mode.hours===hours)!;
  return {...plan,exam,days:hours===20?5:6};
}
export function targetMinutes(data: Progress, day: string) {
  const plan = planDay(day);
  const mode = capacityFor(data,day);
  return plan.type==='Study' && (plan.number-1)%7<mode.days ? mode.hours*60/mode.days : 0;
}
export function remainingPlannedMinutes(data: Progress, day: string) {
  return range(day>roadmap.starts?day:roadmap.starts,roadmap.ends).reduce((sum,d)=>sum+targetMinutes(data,d),0);
}
export function dailySchedule(data: Progress, day: string) {
  const mode = capacityFor(data,day);
  const sustainable=[20,40,90,30,45,15];
  const intensive=[20,60,190,50,55,25];
  return roadmap.dailyBlocks.map((block,index)=>({...block,minutes:mode.hours===20?sustainable[index]:mode.hours===40?intensive[index]:block.minutes}));
}
export const isDone = (data: Progress,id:string) => taskById.get(id)?.kind==='Gate'
  ? data.gates[id]?.status==='Passed' : data.tasks[id]?.status==='Completed';
export function getTaskStatus(data: Progress, task: LearningTask, day: string) {
  const status = data.tasks[task.id]?.status;
  if (isDone(data,task.id)) return 'Completed';
  if (data.gates[task.id]?.status==='Failed') return 'Blocked';
  if (status==='Blocked' || status==='Deferred') return status;
  if (day>task.due) return 'Overdue';
  return status ?? 'Not started';
}
export function progressFor(data: Progress, tasks = roadmap.tasks) {
  const done=tasks.filter(task=>isDone(data,task.id)).length;
  return {done,total:tasks.length,percent:percent(done,tasks.length)};
}
export function aggregate(data: Progress, from: string, to: string) {
  return data.sessions.filter(session=>session.date>=from && session.date<=to).reduce((total,session)=>total+session.minutes,0);
}
export function activity(data: Progress, from: string, to: string) {
  const minutesByDay = new Map<string,number>();
  for (const session of data.sessions) minutesByDay.set(session.date,(minutesByDay.get(session.date)??0)+session.minutes);
  return range(from,to).map(day=>({
    day, label:dateLabel(day,'d MMM'), hours:(minutesByDay.get(day)??0)/60, planned:targetMinutes(data,day)/60,
    average:Array.from({length:7},(_,i)=>minutesByDay.get(shift(day,-i))??0).reduce((sum,n)=>sum+n,0)/420,
    energy:data.energy[day]?.energy, focus:data.energy[day]?.focus,
    done:Object.values(data.tasks).filter(task=>task.completedOn===day).length,
  }));
}
export const interviewTotal = (attempt: InterviewAttempt) => attempt.scores.reduce((sum,value)=>sum+value,0);
export const interviewPass = (attempt: InterviewAttempt) => interviewTotal(attempt)>=15 && attempt.scores.every(score=>score>=2);
export const distinctPasses = (attempts: InterviewAttempt[]) => new Set(attempts.filter(interviewPass).map(attempt=>attempt.title.toLowerCase().trim())).size;
const recruiterStages=['Recruiter screen','Technical interview','Final round','Offer'];
export const hasScreen = (job:JobApplication) => [job.stage,...(job.stageHistory??[])].some(stage=>recruiterStages.includes(stage));
export const isSubmitted = (job:JobApplication) => !!job.date || job.stage==='Applied' || !!job.stageHistory?.includes('Applied') || hasScreen(job);
export const readinessLabels = {
  rag:'Defensible RAG evaluation evidence',regression:'Reproducible workflow regression demo',
  resume:'One-page resume ready',github:'GitHub portfolio and reproducible links', networking:'Outreach and follow-up recorded',
};
export function readiness(data: Progress) {
  const manual = Object.entries(readinessLabels).map(([id,label])=>({id,label,done:!!data.readiness[id],manual:true}));
  return [
    {id:'projects',label:'Two runnable portfolio releases',done:Object.values(data.projects).filter(project=>project.status==='Released' && !!project.repo).length>=2},
    {id:'python',label:'Python mock at rubric threshold',done:data.interviews.some(a=>a.area==='Python and DSA'&&interviewPass(a))},
    {id:'sql',label:'SQL mock at rubric threshold',done:data.interviews.some(a=>a.area==='SQL'&&interviewPass(a))},
    {id:'mocks',label:'Two separate passing mock prompts',done:distinctPasses(data.interviews)>=2},
    {id:'applications',label:'Internship application submitted',done:data.jobs.some(job=>isSubmitted(job)&&/intern/i.test(job.role))},
    ...manual,
  ];
}
export function milestoneStatus(data:Progress,milestone:RoadmapSource['milestones'][number],day:string) {
  const dependenciesMet=milestone.taskIds.length>0&&milestone.taskIds.every(id=>isDone(data,id));
  const released=!milestone.projectId || data.projects[milestone.projectId]?.status==='Released';
  const internshipReady=milestone.id!=='internship-gate'||readiness(data).every(item=>item.done);
  if(data.milestones[milestone.id]||dependenciesMet&&released&&internshipReady)return 'Completed';
  if(milestone.taskIds.some(id=>data.tasks[id]?.status==='Blocked'||data.gates[id]?.status==='Failed')||
    milestone.projectId&&data.projects[milestone.projectId]?.status==='Blocked')return 'Blocked';
  return day>milestone.date?'Overdue':'Planned';
}
export function priorityTasks(data: Progress, day: string) {
  const mode=capacityFor(data,day);
  const manual=data.priorities[day]??[];
  const ranked=roadmap.tasks.flatMap(task=>{
    const status=getTaskStatus(data,task,day);
    if (status==='Completed') return [];
    const override = manual.indexOf(task.id);
    if (override>=0) return [{task,rank:-100+override,reason:'Pinned to your priorities'}];
    const gate=data.gates[task.id];
    const nextMonth=monthById.get(task.monthId)?.end;
    const retake=nextMonth&&shift(nextMonth,1);
    if(gate?.status==='Failed' && task.priority==='P0' && (gate.previousFailures??0)>=1 && retake && day>=retake && day<=shift(retake,6)){
      return [{task,rank:1,reason:'P0 gate failed twice · corrective work in week one'}];
    }
    if (status==='Blocked'||status==='Deferred') return [];
    if (status==='Overdue') return [{task,rank:8+(task.priority==='P0'?0:4),reason:'Overdue · '+dateLabel(task.due)}];
    if (task.kind==='Gate' && daysBetween(day,task.due)<=5) return [{task,rank:4,reason:'Competency gate due '+dateLabel(task.due)}];
    if (day>=task.start&&day<=task.due) return [{task,rank:task.priority==='P0'?5:9,reason:'Active roadmap block · '+task.priority}];
    if (day<roadmap.starts&&task.start===roadmap.starts) return [{task,rank:15,reason:'First planned study day · '+dateLabel(task.start)}];
    return [];
  }).sort((a,b)=>a.rank-b.rank||a.task.due.localeCompare(b.task.due));
  return ranked.slice(0,Math.max(manual.length,mode.hours===20?3:mode.hours===40?6:4));
}
export const reviewIntervals = [1,3,7,14,30];
export const elapsedTimer = (timer:NonNullable<Progress['timer']>,now:number) => timer.elapsedMs+(timer.startedAt===null?0:Math.max(0,now-timer.startedAt));
export function makeBackup(data: Progress, now=new Date()) {
  return backupSchema.parse({application:'ai-career-os',version:schemaVersion,exportedAt:now.toISOString(),roadmapDigest:roadmap.digest,data});
}
export function readBackup(value: unknown) {
  const v1=v1BackupSchema.safeParse(value);
  if(v1.success) return {data:migrateProgress(v1.data.data,1),sourceChanged:v1.data.roadmapDigest!==roadmap.digest};
  if (value && typeof value==='object' && 'version' in value && value.version===0 && 'application' in value && value.application==='ai-career-os' && 'data' in value) {
    return {data:migrateProgress(value.data,0),sourceChanged:true};
  }
  const parsed=backupSchema.parse(value);
  return {data:parsed.data,sourceChanged:parsed.roadmapDigest!==roadmap.digest};
}
export function unmatchedProgress(data: Progress) {
  return Object.keys(data.tasks).filter(id=>!roadmap.tasks.some(task=>task.id===id));
}
export function toCSV(rows: unknown[][]) {
  return rows.map(row=>row.map(value=>{
    let cell=String(value??'');
    if (typeof value==='string' && /^[\s]*[=+\-@\t\r]/.test(cell)) cell="'"+cell;
    return '"'+cell.replaceAll('"','""')+'"';
  }).join(',')).join('\r\n')+'\r\n';
}

