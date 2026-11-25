'use client';
import Link from 'next/link';
import { ArrowUpRight, CalendarClock, ChevronRight, CircleDot, Goal, Layers3, Plus, Timer, Zap } from 'lucide-react';
import { roadmap } from '@/lib/roadmap';
import { levels } from '@/lib/progress-schema';
import { useCareer } from '@/lib/store';
import { forecastStudyPace } from '@/lib/forecast';
import { activeMonth, activity, aggregate, capacityFor, dateLabel, daysBetween, milestoneStatus, percent, progressFor, range, readiness, shift, shortHours, targetMinutes, weekStart } from '@/lib/logic';
import { ActivityChart } from './charts';
import { StudyCalendar } from './calendar';
import { ForecastSummary } from './forecast';
import { LearningWidget } from './learning-analytics';
import { IconButton, Panel, PanelHeader, Ring, useApp } from './ui';
import { Priorities } from './tasks';

const mastery = [
  ['Python','python','python'],['SQL','sql','sql'],['Math & statistics','math-and-stats','math'],
  ['Classical ML','classical-ml','classical'],['Deep learning','deep-learning','pytorch'],['LLM & RAG','llm-engineering','llm'],
  ['AI agents','agents','agents'],['Deployment & MLOps','deployment','deployment'],['System design','system-design','design'],
];
export function Overview(){
  const data=useCareer(state=>state.data);
  const {day,open}=useApp();
  const month=activeMonth(day);
  const capacity=capacityFor(data,day);
  const start=weekStart(day);
  const days=range(start,shift(start,6));
  const weekly=aggregate(data,start,shift(start,6));
  const previous=aggregate(data,shift(start,-7),shift(start,-1));
  const total=progressFor(data);
  const monthly=progressFor(data,roadmap.tasks.filter(task=>task.monthId===month.id));
  const ready=readiness(data);
  const forecast=forecastStudyPace(data,day);
  const weeklyTarget=capacity.hours*60;
  const points=activity(data,shift(day,-13),day);
  const missed=points.filter(point=>point.day<day&&point.planned>0);
  const consistency=missed.length?percent(missed.filter(point=>point.hours>0).length,missed.length):null;
  const skillAssessments=[...data.assessments].sort((a,b)=>b.date.localeCompare(a.date));
  const jobReadyDomains=roadmap.competencies.filter(domain=>['J','A'].includes(skillAssessments.find(a=>a.domain===domain.id)?.level??'')).length;
  const firstPhase=day<roadmap.starts?'Pre-launch':month.name+' phase';
  const left=Math.max(0,daysBetween(day,roadmap.ends));
  const scales=days.map((date,index)=>({date,index,actual:aggregate(data,date,date),target:date<roadmap.starts?(index<capacity.days?weeklyTarget/capacity.days:0):targetMinutes(data,date)}));
  const max=Math.max(60,...scales.flatMap(d=>[d.actual,d.target]));
  const milestones=roadmap.milestones.filter(m=>m.id!=='evaluation-release');
  return <div className="bento overview">
    <Panel dark className="identity">
      <div className="identity-head"><span className="identity-brand"><span className="identity-logo"><Layers3 size={14}/></span> AI Career OS</span><span className="year">2027</span></div>
      <div className="identity-content"><div><p>Primary track</p><h2>Applied AI<br/>Engineer</h2><span className="identity-secondary">Secondary · ML Engineer</span></div><div className="chrome-art" aria-hidden/></div>
      <div className="identity-foot"><div><small>{firstPhase}</small><span>{data.assessments.length?jobReadyDomains+' job-ready domains':'Unassessed'}</span></div><div><strong>{left}</strong><small> days left</small></div></div>
    </Panel>
    <Panel className="weekly">
      <PanelHeader title="Weekly learning" subtitle={dateLabel(start)+' – '+dateLabel(shift(start,6))} action={<Link className="icon-btn" aria-label="Open learning analytics" title="Open learning analytics" href="/analytics/"><ArrowUpRight size={15}/></Link>}/>
      <div className="weekly-stat"><strong>{shortHours(weekly)}<small>h</small></strong><span>/ {capacity.hours}h target</span><span className="weekly-remaining">{shortHours(Math.max(0,weeklyTarget-weekly))}h left</span></div>
      <div className="week-bars" aria-label="Seven-day study hours">
        {scales.map(({date,actual,target})=><button key={date} className={date===day?'selected':''} type="button" title={shortHours(actual)+'h recorded / '+shortHours(target)+'h target'} aria-label={dateLabel(date,'EEEE')+', '+shortHours(actual)+' hours recorded, '+shortHours(target)+' hours planned'} onClick={()=>open({kind:'day',id:date})}><span className="bar-space"><i className="bar-target" style={{height:(target?Math.max(8,target/max*100):5)+'%'}}/><i className="bar-actual" style={{height:(actual?actual/max*100:0)+'%'}}/></span><span className="bar-day">{dateLabel(date,'EEE')}</span></button>)}
      </div>
      <div className="mini-footer"><span><i className="legend-dot"/>Recorded <i className="legend-dot legend-target"/>Target</span><span>{previous===weekly?'Same as last week':(weekly>previous?'+':'−')+shortHours(Math.abs(weekly-previous))+'h vs last week'}</span></div>
    </Panel>
    <Panel className="progress">
      <PanelHeader title="Career progress" subtitle="Evidence and activity" action={<Link className="icon-btn" aria-label="Open career readiness" title="Open career readiness" href="/career/"><ArrowUpRight size={15}/></Link>}/>
      <div className="rings">
        <Link href="/roadmap/"><Ring value={total.percent} label="Roadmap"/></Link>
        <Link href="/roadmap/"><Ring value={monthly.percent} label={month.name}/></Link>
        <Link href="/analytics/"><Ring value={percent(weekly,weeklyTarget)} label="Weekly target"/></Link>
        <Link href="/career/"><Ring value={percent(ready.filter(item=>item.done).length,ready.length)} label="Internship"/></Link>
      </div>
      <ForecastSummary goals={forecast.goals}/>
    </Panel>
    <Panel dark className="mastery">
      <PanelHeader title="Skill mastery" subtitle="Competency scorecard" action={<Link className="icon-btn" aria-label="Open skill scorecard" title="Open skill scorecard" href="/skills/"><ArrowUpRight size={15}/></Link>}/>
      <div className="mastery-list">{mastery.map(([label,domain,skill])=>{
        const level=skillAssessments.find(entry=>entry.domain===domain)?.level??'Unassessed';
        return <button type="button" key={skill} onClick={()=>open({kind:'skill',id:skill})}><span>{label}</span><span className="master-track"><i style={{width:(levels.indexOf(level)*25)+'%'}}/></span><strong>{level==='Unassessed'?'—':level}</strong></button>;
      })}</div>
      <span className="mastery-foot"><CircleDot size={12}/> Based on recorded assessments</span>
    </Panel>
    <Panel className="priority">
      <PanelHeader title="Today’s priorities" subtitle={day<roadmap.starts?'First roadmap block · 1 Dec':dateLabel(day,'EEEE, d MMMM')} action={<Link className="icon-btn" aria-label="Open Today" title="Open Today" href="/today/"><ArrowUpRight size={15}/></Link>}/>
      <Priorities compact/>
      <div className="priority-foot"><Link href="/today/"><Timer size={14}/>Open study workspace <ChevronRight size={14}/></Link></div>
    </Panel>
    <Panel className="calendar"><StudyCalendar/></Panel>
    <Panel className="consistency">
      <PanelHeader title="Study consistency" subtitle="Focused hours · rolling 7-day average" action={<div className="inline"><IconButton label="Log energy and focus" onClick={()=>open({kind:'form',type:'energy',day})}><Zap size={15}/></IconButton><IconButton label="Log study time" onClick={()=>open({kind:'form',type:'session',day})}><Plus size={15}/></IconButton></div>}/>
      <div className="consistency-chart"><ActivityChart points={points} energy onDay={day=>open({kind:'day',id:day})}/><div className="consistency-stat"><strong>{consistency===null?'—':consistency+'%'}</strong><span>Study days active</span><small>{data.energy[day]?data.energy[day].energy+'/5 energy today':'No energy logged'}</small></div></div>
    </Panel>
    <Panel className="milestones">
      <PanelHeader title="Career milestones" subtitle="Roadmap targets" action={<Link className="icon-btn" aria-label="Open career milestones" href="/career/"><Goal size={16}/></Link>}/>
      <div className="milestone-grid">{milestones.map(milestone=>{
        const status=milestoneStatus(data,milestone,day);
        const title=milestone.id==='internship-gate'?'Internship readiness & CI gate':milestone.title;
        return <button key={milestone.id} type="button" onClick={()=>open({kind:'milestone',id:milestone.id})} title={title+' · '+status}><span><CalendarClock size={12}/>{dateLabel(milestone.date,'MMM yy')}{status==='Planned'?'':' · '+status}</span><strong>{title}</strong></button>;
      })}</div>
    </Panel>
    <LearningWidget data={data} day={day}/>
  </div>;
}

