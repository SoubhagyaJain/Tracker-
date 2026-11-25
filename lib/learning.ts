import { activeMonth, aggregate, capacityFor, daysBetween, isDone, shift, targetMinutes, todayKey, weekStart } from './logic';
import { blankMapping, canonicalCourseUrl, companionEntrySchema, courseThumbnail, externalCourseSchema, type CourseRoadmapMapping, type ExternalCourse, type LearningEntry, type LearningProvider, type StudyInterval, type SyncEvent } from './learning-schema';
import { levels, sessionSchema, type ExternalLearningSession, type Progress, type StudySession } from './progress-schema';
import { monthById, projectById, roadmap, skillById, taskById } from './roadmap';

export const sourceNames:Record<LearningProvider,string> = {
  manual:'Manual progress',file:'File import',business:'Udemy Business snapshot',companion:'Companion · manually entered',
};
export const courseLink=(id:string)=>'/learning/course/?id='+encodeURIComponent(id);
const topics = [
  [/\bagents?\b|agentic/i,'agents'], [/inference|vllm|quantiz/i,'serving'],
  [/retrieval|\brag\b|\bllms?\b|langchain|ragas/i,'llm'], [/pytorch|deep learning/i,'pytorch'],
  [/scikit|machine learning/i,'classical'], [/statistics|experimentation/i,'stats'],
  [/probability|linear algebra/i,'math'], [/\bsql\b/i,'sql'], [/\bpython\b/i,'python'],
  [/docker|github actions/i,'deployment'], [/\bfastapi\b|rest api/i,'api'], [/pandas|numpy/i,'data'],
] as const;
const interviewTopics: Record<string,string> = {
  python:'Python and DSA',sql:'SQL',stats:'Math, statistics and ML',math:'Math, statistics and ML',
  classical:'Math, statistics and ML',pytorch:'Deep learning',llm:'LLM/RAG',agents:'Agents',serving:'ML system design',
};

export function suggestMapping(title:string):CourseRoadmapMapping {
  const skillId=topics.find(([pattern])=>pattern.test(title))?.[1];
  if(!skillId)return {...blankMapping};
  const applicable=roadmap.months.filter(month=>month.skills.includes(skillId));
  const preferred = skillId==='sql'?'2027-01':skillId==='classical'?'2027-02':undefined;
  const month=applicable.find(item=>item.id===preferred)??applicable[0];
  return {...blankMapping,skillId,monthId:month?.id??'',priority:skillById.get(skillId)?.priority??'',
    projectId:month?.projectIds[0]??'',interviewTopic:interviewTopics[skillId]??''};
}

export function normalizeMapping(mapping:CourseRoadmapMapping):CourseRoadmapMapping {
  const task=taskById.get(mapping.taskId);
  const week=roadmap.months.flatMap(month=>month.weeks).find(item=>item.id===(task?.weekId??mapping.weekId));
  const month=monthById.get(task?.monthId??week?.start.slice(0,7)??mapping.monthId);
  const skill=skillById.get(mapping.skillId);
  return {
    monthId:month?.id??'',weekId:week?.id??'',taskId:task?.id??'',skillId:skill?.id??'',
    priority:mapping.priority||skill?.priority||'',projectId:projectById.has(mapping.projectId)?mapping.projectId:'',
    interviewTopic:roadmap.interviewAreas.some(area=>area.title===mapping.interviewTopic)?mapping.interviewTopic:'',
  };
}

export function courseProgress(course:ExternalCourse){
  const included=course.sections.filter(section=>section.scope!=='Irrelevant');
  const lectures=included.flatMap(section=>section.lectures);
  const ignored=course.sections.filter(section=>section.scope==='Irrelevant').flatMap(section=>section.lectures).length;
  const tracked=lectures.filter(lecture=>lecture.completedAt).length;
  const completed=tracked+course.unlistedCompleted;
  const total=course.declaredLectures||course.curriculumComplete?Math.max(0,course.declaredLectures-ignored,lectures.length):0;
  const percent=total?Math.min(100,Math.round(completed/total*1000)/10):course.reportedPercent;
  return {
    tracked,completed,total,percent,
    remaining:total?Math.max(0,total-completed):null,
    next:included.flatMap(section=>section.lectures.filter(x=>!x.completedAt).map(lecture=>({section,lecture})))
      .sort((a,b)=>Number(a.section.scope==='Optional')-Number(b.section.scope==='Optional'))[0],
  };
}

export function trackedUpdate(course:ExternalCourse, changes:Partial<ExternalCourse>, source:LearningProvider, at:string) {
  const updated=externalCourseSchema.parse({...course,...changes,updatedAt:at});
  const before=courseProgress(course);
  const after=courseProgress(updated);
  const changed=before.completed!==after.completed || before.total!==after.total || before.percent!==after.percent ||
    (!course.snapshots.length&&(after.total>0||after.percent!==null));
  const autoDone=(after.total>0&&after.completed>=after.total)||(!after.total&&after.percent===100);
  if(autoDone) updated.enrollment={...updated.enrollment,status:'Completed',completedAt:updated.enrollment.completedAt??at};
  else if(course.enrollment.status==='Completed' && changes.enrollment===undefined && changed && ((before.total>0&&before.completed>=before.total)||before.percent===100)){
    updated.enrollment={...updated.enrollment,status:'Active',completedAt:null};
  }
  if(changed){
    updated.progressSource=source;
    updated.snapshots=[...updated.snapshots,{
      id:crypto.randomUUID(),at,completed:after.completed,total:after.total,percent:after.percent??0,source,
    }].slice(-10000);
  }
  return updated;
}

export function applyCourseCounts(course:ExternalCourse, entry:LearningEntry, source:LearningProvider, at:string) {
  const reportedActivity=source==='business'&&(entry.providerActivityAt||entry.providerVideoMinutes!==undefined);
  if(entry.completedLectures===undefined&&entry.totalLectures===undefined&&entry.percent===undefined&&entry.completedAt===undefined&&!reportedActivity)return course;
  const tracked=courseProgress(course).tracked;
  const enrollment=entry.completedAt?{...course.enrollment,status:'Completed' as const,completedAt:entry.completedAt}
    : (entry.completedLectures??entry.percent??0)>0&&course.enrollment.status==='Enrolled'
      ? {...course.enrollment,status:'Active' as const}:course.enrollment;
  return trackedUpdate(course,{
    declaredLectures:entry.totalLectures??course.declaredLectures,
    unlistedCompleted:entry.completedLectures===undefined?course.unlistedCompleted:Math.max(0,entry.completedLectures-tracked),
    reportedPercent:entry.percent??course.reportedPercent,
    ...(source==='business'?{providerActivityAt:entry.providerActivityAt??course.providerActivityAt,
      providerVideoMinutes:entry.providerVideoMinutes??course.providerVideoMinutes}:{}),
    progressSource:source,
    ...((entry.completedAt||enrollment!==course.enrollment)?{enrollment}:{}),
  },source,at);
}

export function makeCourse(entry:LearningEntry, source:LearningProvider, at:string, date:string):ExternalCourse {
  const course=externalCourseSchema.parse({
    ...entry,id:crypto.randomUUID(),url:canonicalCourseUrl(entry.url),thumbnail:courseThumbnail(entry.thumbnail),
    provider:source,progressSource:source,updatedAt:at,notes:'',practice:'',mapping:suggestMapping(entry.title),
    ...(source==='business'?{}:{providerActivityAt:undefined,providerVideoMinutes:undefined}),
    enrollment:{status:'Enrolled',bookmarked:false,enrolledOn:date,targetDate:'',completedAt:null},
    certificate:{url:entry.certificateUrl,earnedOn:''},sections:[],snapshots:[],unlistedCompleted:0,declaredLectures:0,reportedPercent:null,
  });
  return applyCourseCounts(course,entry,source,entry.reportedAt??at);
}

export function matchingCourse(courses:ExternalCourse[],entry:LearningEntry,source:LearningProvider){
  const url=canonicalCourseUrl(entry.url);
  return courses.find(course=>(url && course.url===url) ||
    (entry.externalId && course.provider===source && course.externalId===entry.externalId) ||
    (!url && !entry.externalId && !course.url && !course.externalId && course.title.toLowerCase()===entry.title.toLowerCase() &&
      course.instructor.toLowerCase()===entry.instructor.toLowerCase()));
}

export function upsertCourse(data:Progress,course:ExternalCourse):Progress {
  const found=data.learning.courses.some(item=>item.id===course.id);
  const courses=found?data.learning.courses.map(item=>item.id===course.id?course:item):[...data.learning.courses,course];
  return {...data,learning:{...data.learning,courses}};
}

export function integrationEvent(data:Progress, event:Omit<SyncEvent,'id'> & {id?:string}):Progress {
  return {...data,learning:{...data.learning,sync:[...data.learning.sync,{...event,id:event.id??crypto.randomUUID()}].slice(-1000)}};
}

export function timerIntervals(timer:NonNullable<Progress['timer']>,now:number):StudyInterval[]{
  return timer.startedAt && now>timer.startedAt
    ? [...(timer.intervals??[]),{start:timer.startedAt,end:now}].slice(-300)
    : timer.intervals??[];
}

export function recordStudySession(data:Progress, entry:StudySession, edit=false):Progress {
  const session=sessionSchema.parse(entry);
  const intervals=session.intervals??[];
  const ids=data.sessions.filter(previous=>!edit||previous.id!==session.id);
  if(ids.some(previous=>previous.id===session.id))throw new Error('This study session is already recorded.');
  const active=session.source==='companion' && data.timer ? timerIntervals(data.timer,Date.parse(session.recordedAt??'')||Date.now()) : [];
  if(intervals.some((interval,index)=>intervals.slice(0,index).some(previous=>overlap(interval,previous))||
      active.some(previous=>overlap(interval,previous))||
      ids.some(previous=>(previous.intervals??[]).some(existing=>overlap(interval,existing))))) {
    throw new Error('This session overlaps a recorded or active focus timer. Adjust the time before saving.');
  }
  const sessions=edit?data.sessions.map(previous=>previous.id===session.id?session:previous):[...data.sessions,session];
  const next={...data,sessions};
  const course=data.learning.courses.find(item=>item.id===session.courseId&&item.enrollment.status==='Enrolled');
  return course?upsertCourse(next,{...course,enrollment:{...course.enrollment,status:'Active'}}):next;
}

function overlap(a:StudyInterval,b:StudyInterval){return a.start<b.end && b.start<a.end;}
export function learningCategory(mode:StudySession['learningMode']):StudySession['category'] {
  return mode==='Implementation'?'Build':mode==='Revision'||mode==='Practice & assessment'?'Review':'Learning';
}

export function acceptCompanion(data:Progress, value:unknown, at:string) {
  const item=companionEntrySchema.parse(value);
  if(data.learning.sync.some(event=>event.id===item.id&&event.source==='companion')){
    return {data,duplicate:true};
  }
  if(item.session&&data.sessions.some(session=>session.id===item.session!.id))return {data,duplicate:true};
  const existing=matchingCourse(data.learning.courses,item.course,'companion');
  const date=todayKey(data.settings.timezone,new Date(at));
  const selected=existing??makeCourse(item.course,'companion',at,date);
  const task=taskById.get(item.taskId);
  const course=existing?applyCourseCounts(selected,item.course,'companion',at):selected;
  let next=upsertCourse(data,course);
  if(item.session){
    const {id,at:recordedAt,minutes,videoMinutes,intervals,mode}=item.session;
    if(intervals.some(interval=>interval.end>Date.parse(recordedAt) || interval.end>Date.parse(at)))throw new Error('Review the session timestamps.');
    if(recordedAt>at)throw new Error('A submitted session needs a past or current timestamp.');
    const elapsed=intervals.reduce((sum,interval)=>sum+interval.end-interval.start,0);
    const measured=elapsed?Math.min(1440,Math.max(1,Math.floor(elapsed/60000))):0;
    if(minutes!==measured)throw new Error('The focused minutes do not match the recorded timer intervals.');
    const session:ExternalLearningSession={
      id,recordedAt,minutes,videoMinutes,intervals,courseId:course.id,source:'companion',
      learningMode:mode,category:learningCategory(mode),date:todayKey(data.settings.timezone,new Date(recordedAt)),
      title:course.title,taskId:task?.id??course.mapping.taskId,skillId:course.mapping.skillId,notes:'',
    };
    next=recordStudySession(next,session);
  }
  return {data:integrationEvent(next,{id:item.id,at,source:'companion',phase:'Accepted',message:course.title}),duplicate:false};
}

export function courseStats(data:Progress,course:ExternalCourse,day:string){
  const sessions=data.sessions.filter(item=>item.courseId===course.id);
  const progress=courseProgress(course);
  const start=weekStart(day);
  const weekly=sessions.filter(item=>item.date>=start&&item.date<=day);
  const durationLeft=progress.total&&course.durationMinutes?Math.ceil(course.durationMinutes*(progress.remaining??0)/progress.total):null;
  const lastActivity=[...sessions.map(item=>item.date),...course.snapshots.filter(item=>item.source!=='business').map(item=>item.at),course.providerActivityAt??''].filter(Boolean).sort().at(-1);
  const observations=course.snapshots.filter(item=>item.at.slice(0,10)>=shift(day,-28)&&item.at.slice(0,10)<=day);
  const first=observations[0],last=observations.at(-1);
  const elapsed=first&&last?daysBetween(first.at.slice(0,10),last.at.slice(0,10)):0;
  const advanced=first&&last&&first.total===last.total?last.completed-first.completed:0;
  const finish=elapsed>0&&advanced>0&&progress.remaining?shift(day,Math.ceil(progress.remaining*elapsed/advanced)):null;
  const planned=course.enrollment.targetDate&&progress.total
    ? Math.round(progress.total*Math.max(0,Math.min(1,daysBetween(course.enrollment.enrolledOn,day)/Math.max(1,daysBetween(course.enrollment.enrolledOn,course.enrollment.targetDate))))) :null;
  return {...progress,sessions,lastActivity,finish,planned,durationLeft,weeklyMinutes:weekly.reduce((n,item)=>n+item.minutes,0),
    focusedMinutes:sessions.reduce((n,item)=>n+item.minutes,0),videoMinutes:sessions.reduce((n,item)=>n+(item.videoMinutes??0),0)};
}

export function relatedCourseMilestone(mapping:CourseRoadmapMapping, day:string) {
  return roadmap.milestones.find(item=>mapping.projectId && item.projectId===mapping.projectId) ??
    roadmap.milestones.find(item=>item.date>=day&&item.date.startsWith(mapping.monthId||'unmapped'));
}

export function nextLearning(data:Progress,day:string){
  const month=activeMonth(day);
  const scheduled=data.events.filter(event=>event.date===day).reduce((n,event)=>n+event.minutes,0);
  const capacity=capacityFor(data,day);
  const dailyLimit=day<roadmap.starts?capacity.hours*60/capacity.days:targetMinutes(data,day);
  const available=Math.max(0,dailyLimit-Math.max(scheduled,aggregate(data,day,day)));
  return data.learning.courses.flatMap(course=>{
    if(course.enrollment.status==='Completed')return [];
    const next=courseProgress(course).next;
    const mapping=next?.section.mapping.skillId||next?.section.mapping.taskId
      ? normalizeMapping({...course.mapping,...Object.fromEntries(Object.entries(next.section.mapping).filter(([,value])=>!!value))})
      : course.mapping;
    const skill=skillById.get(mapping.skillId);
    const task=taskById.get(mapping.taskId);
    const active=mapping.monthId===month.id || !!skill&&month.skills.includes(skill.id);
    const overdueP0=!!skill&&mapping.priority==='P0'&&!!mapping.monthId&&mapping.monthId<month.id&&(!task||!isDone(data,task.id));
    const milestone=relatedCourseMilestone(mapping,day);
    const deadline=milestone?daysBetween(day,milestone.date):Infinity;
    if((!active&&!overdueP0&&(deadline<0||deadline>30))||(task&&isDone(data,task.id)))return [];
    if(!mapping.skillId&&!mapping.taskId&&!mapping.projectId&&mapping.monthId!==month.id)return [];
    const latest=[...data.assessments].filter(item=>skill?.domains.includes(item.domain)).sort((a,b)=>b.date.localeCompare(a.date))[0];
    if(latest&&levels.indexOf(latest.level)>=levels.indexOf('J')&&!task)return [];
    const prerequisites=skill?roadmap.nodes.filter(node=>node.skills.includes(skill.id))
      .flatMap(node=>roadmap.dependencies.filter(edge=>edge.target===node.id))
      .map(edge=>roadmap.nodes.find(node=>node.id===edge.source)).filter(node=>node&&!node.skills.some(id=>
        data.assessments.some(assessment=>skillById.get(id)?.domains.includes(assessment.domain)&&assessment.level!=='Unassessed'))) : [];
    const hasCapacity=available>=Math.max(15,next?.lecture.minutes??0);
    const reasons=[active?'Matches '+month.label:overdueP0?'Open P0 skill from an earlier phase':'A related milestone is approaching'];
    if(milestone&&deadline>=0&&deadline<=30)reasons.push(milestone.title+' in '+deadline+' days');
    if(latest)reasons.push('Recorded competency '+latest.level);
    if(prerequisites.length)reasons.push('Review prerequisite '+prerequisites[0]?.title+' first');
    if(!hasCapacity)reasons.push('Use the next available study block');
    const score=Number(active)*5+Number(overdueP0)*4+Number(mapping.priority==='P0')*3+
      Number(deadline>=0&&deadline<=30)*2+Number(course.enrollment.status==='Active')-Number(prerequisites.length>0)*2;
    return [{course,next,reasons,score,hasCapacity}];
  }).sort((a,b)=>b.score-a.score||a.course.title.localeCompare(b.course.title))[0];
}

function lectureAdvances(courses:ExternalCourse[], from:string, through:string){
  return courses.reduce((sum,course)=>sum+course.snapshots.reduce((count,snapshot,index)=>{
    const date=snapshot.at.slice(0,10);
    const prior=course.snapshots[index-1];
    if(date<from||date>through)return count;
    return count+Math.max(0,snapshot.completed-(prior?.completed??(snapshot.source==='manual'?0:snapshot.completed)));
  },0),0);
}
export function learningMetrics(data:Progress,day:string){
  const courses=data.learning.courses;
  const sessions=data.sessions.filter(item=>item.courseId);
  const start=weekStart(day);
  const weekly=sessions.filter(item=>item.date>=start&&item.date<=day);
  const lecturesByWeek=Array.from({length:4},(_,index)=>{
    const week=shift(start,(index-3)*7);
    return {week,completed:lectureAdvances(courses,week,index===3?day:shift(week,6))};
  });
  return {
    completed:courses.filter(course=>course.enrollment.status==='Completed'),
    active:courses.filter(course=>course.enrollment.status==='Active'),
    weekly:weekly.reduce((n,item)=>n+item.minutes,0),completions:lecturesByWeek[3].completed,lecturesByWeek,
    remaining:courses.filter(course=>course.enrollment.status!=='Completed').map(course=>courseProgress(course).remaining),
    coveredSkills:new Set(courses.flatMap(course=>[course.mapping.skillId,...course.sections.map(section=>section.mapping.skillId)]).filter(id=>skillById.has(id))),
    coveredTasks:new Set(courses.flatMap(course=>[course.mapping.taskId,...course.sections.map(section=>section.mapping.taskId)]).filter(id=>taskById.has(id))),
    sessions,weeklySessions:weekly,
  };
}

