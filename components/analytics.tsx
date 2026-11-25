'use client';
import { useState } from 'react';
import { CalendarClock, Clock3, Flame, Goal } from 'lucide-react';
import { roadmap } from '@/lib/roadmap';
import { categories, levels } from '@/lib/progress-schema';
import { useCareer } from '@/lib/store';
import { activity, aggregate, dateLabel, getTaskStatus, percent, planDay, range, shift, shortHours, weekStart } from '@/lib/logic';
import { ActivityChart } from './charts';
import { StudyForecast } from './forecast';
import { LearningAnalytics } from './learning-analytics';
import { Add, Disclosure, Empty, Panel, PanelHeader, Status, useApp } from './ui';

export function Analytics(){
  const data=useCareer(s=>s.data);
  const {day,open}=useApp();
  const [filter,setFilter]=useState('30 days');
  const [showEnergy,setShowEnergy]=useState(false);
  const [group,setGroup]=useState('Week');
  const days=filter==='7 days'?7:filter==='90 days'?90:30;
  const start=filter==='Roadmap'?roadmap.starts:shift(day,1-days);
  const end=filter==='Roadmap'?roadmap.ends:day;
  const points=activity(data,start,end);
  const sessions=data.sessions.filter(s=>s.date>=start&&s.date<=end);
  const totals=points.reduce((summary,p)=>({hours:summary.hours+p.hours,planned:summary.planned+p.planned,done:summary.done+p.done}),{hours:0,planned:0,done:0});
  const elapsed=points.filter(p=>p.planned>0&&p.day<day);
  const consistency=elapsed.length?percent(elapsed.filter(p=>p.hours>0).length,elapsed.length):null;
  const first=weekStart(roadmap.starts);
  const heatWeeks=Array.from({length:Math.ceil(range(first,roadmap.ends).length/7)},(_,i)=>range(shift(first,i*7),shift(first,i*7+6)));
  const onRoadmap=activity(data,roadmap.starts,roadmap.ends);
  const lookup=new Map(onRoadmap.map(p=>[p.day,p]));
  const bins = new Map<string, {label:string; actual:number; target:number; tasks:number; cumulative:number}>();
  let cumulative=0;
  for (const p of onRoadmap) {
    cumulative+=p.hours;
    if(p.day<start||p.day>end) continue;
    const key=group==='Day'?p.day:group==='Week'?weekStart(p.day):p.day.slice(0,7)+'-01';
    const existing=bins.get(key)??{label:dateLabel(key,group==='Month'?'MMM yyyy':'d MMM yyyy'),actual:0,target:0,tasks:0,cumulative:0};
    bins.set(key,{...existing,actual:existing.actual+p.hours,target:existing.target+p.planned,tasks:existing.tasks+p.done,cumulative});
  }
  for(const p of points.filter(p=>p.day<roadmap.starts||p.day>roadmap.ends)){
    const key=group==='Day'?p.day:group==='Week'?weekStart(p.day):p.day.slice(0,7)+'-01';
    const existing=bins.get(key)??{label:dateLabel(key,group==='Month'?'MMM yyyy':'d MMM yyyy'),actual:0,target:0,tasks:0,cumulative:p.day<roadmap.starts?0:cumulative};
    bins.set(key,{...existing,actual:existing.actual+p.hours,tasks:existing.tasks+p.done});
  }
  const gates=Object.values(data.gates).filter(gate=>gate.status!=='Pending'&&gate.date>=start&&gate.date<=end);
  const overdue=roadmap.tasks.filter(task=>getTaskStatus(data,task,day)==='Overdue');
  return <>
    <div className="workspace-toolbar"><div className="segmented">{['7 days','30 days','90 days','Roadmap'].map(name=><button type="button" aria-pressed={filter===name} onClick={()=>setFilter(name)} key={name}>{name}</button>)}</div><Add label="Log study time" onClick={()=>open({kind:'form',type:'session'})}/></div>
    <div className="metric-grid top-metrics">{[
      ['Focused hours',shortHours(totals.hours*60)+'h',Clock3],
      ['Planned hours',shortHours(totals.planned*60)+'h',CalendarClock],
      ['Study days active',consistency===null?'—':consistency+'%',Flame],
      ['Completed tasks',String(totals.done),Goal],
    ].map(([label,value,Icon])=>{const Type=Icon as typeof Clock3;return <Panel key={String(label)}><Type size={18}/><div className="big-stat">{String(value)}</div><p>{String(label)}</p></Panel>;})}</div>
    <div className="workspace-grid">
      <StudyForecast data={data} day={day}/>
      {data.learning.courses.length>0&&<LearningAnalytics data={data} day={day}/>}
      <Panel className="span-full analytics-chart"><PanelHeader title="Planned and recorded study" subtitle="Hours per day · planned targets reflect your current capacity" action={<label className="inline"><input type="checkbox" checked={showEnergy} onChange={e=>setShowEnergy(e.target.checked)}/> Energy and focus</label>}/>
        <ActivityChart points={points} planned energy={showEnergy} onDay={date=>open({kind:'day',id:date})}/>
        <div className="button-row"><button type="button" className="button" onClick={()=>open({kind:'form',type:'energy'})}>Log energy / focus</button></div>
      </Panel>
      <Panel className="span-full">
        <PanelHeader title="Consistency calendar" subtitle="December 2026 – December 2027 · scheduled rest and flex days are excluded from missed study"/>
        <div className="heatmap-scroll"><div className="heatmap" aria-label="Study consistency for every roadmap date">{heatWeeks.map((week,index)=><div key={index} className="heat-week">{week.map(date=>{
          const p=lookup.get(date);if(!p)return <i key={date}/>;
          const plan=planDay(date).type;
          const intensity=p.hours>0?Math.min(4,Math.ceil(p.hours/1.5)):0;
          const type=plan==='Rest'||plan==='Flex'||!p.planned?'off':date<day?'scheduled':'future';
          const label=dateLabel(date,'d MMM yyyy')+' · '+plan+' · '+shortHours(p.hours*60)+'h recorded';
          return <button type="button" key={date} className={'heat-cell heat-'+intensity+' '+type} aria-label={label} title={label} onClick={()=>open({kind:'day',id:date})}/>;
        })}</div>)}</div></div>
        <div className="mini-footer"><span>Recorded activity</span><span>{shortHours(aggregate(data,roadmap.starts,roadmap.ends))}h across the roadmap</span></div>
      </Panel>
      <Panel><PanelHeader title="Activity by category"/>
        <div className="list-stack">{categories.map(category=>{
          const minutes=sessions.filter(s=>s.category===category).reduce((m,s)=>m+s.minutes,0);
          return <div className="line-row" key={category}><span>{category}</span><strong>{shortHours(minutes)}h</strong></div>;
        })}</div>
        <Disclosure title="Time by skill">{roadmap.skills.filter(skill=>sessions.some(s=>s.skillId===skill.id)).map(skill=><div className="line-row" key={skill.id}><span>{skill.title}</span><strong>{shortHours(sessions.filter(s=>s.skillId===skill.id).reduce((m,s)=>m+s.minutes,0))}h</strong></div>)}{!sessions.some(s=>s.skillId)&&<Empty>Link a study session to a skill to see it here.</Empty>}</Disclosure>
      </Panel>
      <Panel><PanelHeader title="Gates and overdue work"/>
        <div className="list-stack"><div className="line-row"><span>Gate pass rate</span><strong>{gates.length?percent(gates.filter(g=>g.status==='Passed').length,gates.length)+'%':'Unassessed'}</strong></div>
          {roadmap.months.map(m=>({month:m,count:overdue.filter(t=>t.monthId===m.id).length})).filter(item=>item.count>0).map(({month,count})=><button type="button" className="line-row clickable" key={month.id} onClick={()=>open({kind:'week',id:month.weeks[0].id})}><span>{month.label} overdue</span><Status>{count}</Status></button>)}
          {!overdue.length&&<p className="muted">No overdue tasks.</p>}
        </div><Disclosure title="Project milestone progress">{roadmap.projects.map(project=><div key={project.id} className="line-row"><span>{project.name}</span><strong>{data.projects[project.id]?.milestones.length??0}/{project.milestones.length}</strong></div>)}</Disclosure>
        <Disclosure title="Recorded mastery progression">{data.assessments.length?[...data.assessments].sort((a,b)=>b.date.localeCompare(a.date)).map(a=><button type="button" className="line-row clickable" key={a.id} onClick={()=>open({kind:'form',type:'assessment',id:a.id})}><span>{roadmap.competencies.find(c=>c.id===a.domain)?.title} · {dateLabel(a.date)}</span><strong>{a.level} ({levels.indexOf(a.level)}/4)</strong></button>):<Empty>No assessments recorded.</Empty>}</Disclosure>
      </Panel>
      <Panel className="span-full"><PanelHeader title="Study totals and completion velocity" action={<select aria-label="Group study totals" value={group} onChange={e=>setGroup(e.target.value)}>{['Day','Week','Month'].map(g=><option key={g}>{g}</option>)}</select>}/>
        <div className="table-wrap"><table><thead><tr><th>Period</th><th>Recorded</th><th>Planned</th><th>Tasks completed</th><th>Cumulative roadmap hours</th></tr></thead><tbody>{[...bins.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([key,row])=><tr key={key}><th><button type="button" className="link-button" onClick={()=>open({kind:'day',id:key})}>{row.label}</button></th><td>{shortHours(row.actual*60)}h</td><td>{shortHours(row.target*60)}h</td><td>{row.tasks}</td><td>{shortHours(row.cumulative*60)}h</td></tr>)}</tbody></table></div>
      </Panel>
      <Panel className="span-full"><PanelHeader title="Recorded sessions" subtitle={sessions.length+' in the selected range'}/>{sessions.length?<div className="list-stack">{[...sessions].sort((a,b)=>b.date.localeCompare(a.date)).map(s=><button type="button" className="line-row clickable" key={s.id} onClick={()=>open({kind:'form',type:'session',id:s.id})}><div><strong>{s.title}</strong><p>{dateLabel(s.date)} · {s.category}</p></div><span>{s.minutes} min</span></button>)}</div>:<Empty>Log a session to add recorded activity.</Empty>}</Panel>
    </div>
  </>;
}

