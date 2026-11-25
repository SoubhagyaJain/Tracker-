import Link from 'next/link';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { courseLink, courseStats, learningMetrics, nextLearning, relatedCourseMilestone, sourceNames } from '@/lib/learning';
import { learningModes } from '@/lib/learning-schema';
import { dateLabel, shortHours } from '@/lib/logic';
import type { Progress } from '@/lib/progress-schema';
import { roadmap, skillById } from '@/lib/roadmap';
import { Empty, Panel, PanelHeader, useApp } from './ui';

export function LearningAnalytics({data,day}:{data:Progress;day:string}){
  const metrics=learningMetrics(data,day);
  if(!data.learning.courses.length)return <Panel><PanelHeader title="Udemy learning analytics"/><Empty>Add a course to see registrations, lecture progress and recorded study.</Empty></Panel>;
  const recent=metrics.completed.filter(course=>course.enrollment.completedAt).sort((a,b)=>
    (b.enrollment.completedAt??'').localeCompare(a.enrollment.completedAt??''));
  return <Panel className="span-full" >
    <PanelHeader title="Udemy learning analytics" subtitle="This calendar week · course progress and competency evidence are tracked independently"/>
    <dl className="course-metrics learning-rollup">
      <div><dt>Active courses</dt><dd>{metrics.active.length}</dd></div>
      <div><dt>Courses completed</dt><dd>{metrics.completed.length}</dd></div>
      <div><dt>Weekly focused study</dt><dd>{shortHours(metrics.weekly)}h</dd></div>
      <div><dt>Lectures advanced this week</dt><dd>{metrics.completions}</dd></div>
      <div><dt>Known lectures remaining</dt><dd>{metrics.remaining.reduce<number>((sum,item)=>sum+(item??0),0)}</dd></div>
      <div><dt>Roadmap coverage</dt><dd>{metrics.coveredSkills.size}/{roadmap.skills.length} skills · {metrics.coveredTasks.size} tasks</dd></div>
    </dl>
    {metrics.remaining.some(value=>value===null)&&<p className="muted">Some courses still need lecture totals.</p>}
    <p className="muted">Estimated video workload left for courses with a duration and lecture total · {shortHours(data.learning.courses.filter(course=>course.enrollment.status!=='Completed').reduce((sum,course)=>sum+(courseStats(data,course,day).durationLeft??0),0))}h</p>
    <div className="learning-analytics-grid">
      <div><h3>Weekly study by activity</h3><div className="list-stack">
        {learningModes.map(mode=><div className="line-row" key={mode}><span>{mode}</span><strong>{shortHours(metrics.weeklySessions.filter(item=>item.learningMode===mode).reduce((sum,item)=>sum+item.minutes,0))}h focused</strong></div>)}
        <div className="line-row"><span>Measured video playback</span><strong>{shortHours(metrics.weeklySessions.reduce((sum,item)=>sum+(item.videoMinutes??0),0))}h</strong></div>
      </div></div>
      <div><h3>Weekly study by skill</h3><div className="list-stack">
        {[...new Set(metrics.weeklySessions.map(item=>item.skillId))].map(id=><div className="line-row" key={id}>
          <span>{skillById.get(id)?.title??'Unmapped'}</span><strong>{shortHours(metrics.weeklySessions.filter(item=>item.skillId===id).reduce((sum,item)=>sum+item.minutes,0))}h</strong></div>)}
        {!metrics.weeklySessions.length&&<Empty>Record a linked study session to see time by skill.</Empty>}
      </div></div>
    </div>
    <div className="learning-analytics-grid">
      <div><h3>Planned vs. recorded lectures</h3>
        <div className="list-stack">{data.learning.courses.map(course=>{
          const stats=courseStats(data,course,day);
          return <div className="line-row" key={course.id}><Link href={courseLink(course.id)}>{course.title}</Link><span>{stats.completed} recorded · {stats.planned??'—'} planned</span></div>;
        })}</div>
      </div>
      <div><h3>Course completion history</h3>
        {recent.length?<div className="list-stack">{recent.map(course=><div className="line-row" key={course.id}>
          <Link href={courseLink(course.id)}>{course.title}</Link><time dateTime={course.enrollment.completedAt!}>{dateLabel(course.enrollment.completedAt!.slice(0,10),'d MMM yyyy')}</time>
        </div>)}</div>:<Empty>Completed courses appear here with their completion dates.</Empty>}
        <h3>Lecture progress by week</h3><div className="list-stack">{metrics.lecturesByWeek.map(item=>
          <div className="line-row" key={item.week}><span>Week of {dateLabel(item.week)}</span><strong>{item.completed}</strong></div>)}</div>
      </div>
    </div>
  </Panel>;
}
export function LearningWidget({data,day}:{data:Progress;day:string}){
  const {open}=useApp();
  const recommendation=nextLearning(data,day);
  const course=recommendation?.course??data.learning.courses.filter(item=>item.enrollment.status==='Active').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  const stats=course&&courseStats(data,course,day);
  const milestone=course&&relatedCourseMilestone(course.mapping,day);
  const sourceAt=course&&(course.snapshots.at(-1)?.at??course.updatedAt);
  return <Panel className="learning-widget">
    <PanelHeader title="Udemy learning" action={<Link href="/learning/" className="icon-btn" aria-label="Open My Learning"><ArrowUpRight size={16}/></Link>}/>
    {course&&stats?<div className="learning-widget-body">
      <div><Link className="link-button" href={courseLink(course.id)}>{course.title}</Link><p>{stats.next?.lecture.title?'Next · '+stats.next.lecture.title:'Next · Review the course plan'}</p>
        {milestone&&<p>{milestone.title} · {dateLabel(milestone.date)}</p>}<small>{sourceNames[course.progressSource]} · {sourceAt&&dateLabel(sourceAt.slice(0,10),'d MMM yyyy')}</small></div>
      <div><strong>{stats.percent===null?'—':stats.percent+'%'}</strong><p>Course completion</p></div>
      <div><strong>{shortHours(stats.weeklyMinutes)}h</strong><p>Focused study this week</p></div>
      <div className="button-row">{course.url&&<a className="button primary" href={course.url} target="_blank" rel="noopener noreferrer">Continue learning</a>}
        <button className="button" type="button" onClick={()=>open({kind:'course-edit',id:course.id,progressOnly:true})}>Update progress</button></div>
    </div>:<div className="line-row"><p className="muted">Track a course, connect it to your roadmap, and log focused study time.</p>
      <Link className="button" href="/learning/"><BookOpen size={15}/> My Learning</Link></div>}
  </Panel>;
}

