'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleStop, Clock3, Maximize, Minimize, Pause, Play, Timer } from 'lucide-react';
import { capacityFor, dailySchedule, dateLabel, elapsedTimer, getTaskStatus, planDay, progressFor, shift, todayKey } from '@/lib/logic';
import { roadmap, taskById } from '@/lib/roadmap';
import { type Progress } from '@/lib/progress-schema';
import { courseLink, nextLearning, recordStudySession, timerIntervals } from '@/lib/learning';
import { useCareer } from '@/lib/store';
import { StudyCalendar } from './calendar';
import { Priorities, TaskRows } from './tasks';
import { Add, Disclosure, Empty, IconButton, Markdown, Panel, PanelHeader, Status, useApp } from './ui';

const formatTimer=(ms:number)=>[Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(n=>String(n).padStart(2,'0')).join(':');
export function FocusTimer(){
  const timer=useCareer(s=>s.data.timer);
  const update=useCareer(s=>s.update);
  const {open,notify}=useApp();
  const [clock,setClock]=useState(0);
  useEffect(()=>{
    if(timer?.startedAt==null)return;
    const token=setInterval(()=>setClock(Date.now()),250);
    return ()=>clearInterval(token);
  },[timer?.startedAt]);
  const ms=timer?elapsedTimer(timer,Math.max(timer.startedAt??0,clock)):0;
  function pause(){
    const now=Date.now();
    update(data=>data.timer?{...data,timer:{...data.timer,elapsedMs:elapsedTimer(data.timer,now),intervals:timerIntervals(data.timer,now),startedAt:null}}:data);
  }
  function resume(){
    const now=Date.now();setClock(now);
    update(data=>data.timer?{...data,timer:{...data.timer,startedAt:now}}:data);
  }
  function stop(){
    const now=Date.now();
    const current=useCareer.getState().data.timer;
    if(!current)return;
    const {title,category,taskId,skillId,notes,courseId,sectionId,learningMode}=current;
    const minutes=Math.max(1,Math.floor(elapsedTimer(current,now)/60000));
    try{
      update(data=>recordStudySession({...data,timer:null},{
        id:crypto.randomUUID(),date:todayKey(data.settings.timezone,new Date(now)),title,category,taskId,skillId,notes,
        courseId,sectionId,learningMode,minutes:Math.min(1440,minutes),intervals:timerIntervals(current,now),
        recordedAt:new Date(now).toISOString(),source:'dashboard-timer',
      }));
      notify('Focus session saved');
    }catch(error){
      update(data=>({...data,timer:null}));
      notify(error instanceof Error?error.message:'Focus session could not be saved.');
    }
  }
  return <Panel dark className="focus-timer">
    <PanelHeader title="Focus timer" subtitle={timer?.title??'Track a focused study block'} action={<Timer size={18}/>}/>
    <div className="timer-clock" aria-label="Elapsed focus time">{formatTimer(ms)}</div>
    <div className="inline">{!timer?<button type="button" className="button inverse" onClick={()=>open({kind:'form',type:'timer'})}><Play size={15}/>Start timer</button>:<>
      <button type="button" className="button inverse" onClick={timer.startedAt===null?resume:pause}>{timer.startedAt===null?<Play size={15}/>:<Pause size={15}/>} {timer.startedAt===null?'Resume':'Pause'}</button>
      <button type="button" className="button" onClick={stop}><CircleStop size={15}/>Stop and save</button></>}</div>
  </Panel>;
}
export function Today(){
  const data=useCareer(s=>s.data);
  const {day,open}=useApp();
  const [selected,setSelected]=useState<string|null>(null);
  const [focus,setFocus]=useState(false);
  const current=selected??day;
  const plan=planDay(current);
  const cap=capacityFor(data,current);
  const before=day<roadmap.starts&&current===day;
  const date=before?roadmap.starts:current;
  const tasks=roadmap.tasks.filter(task=>task.start<=date&&task.due>=date);
  const sessions=data.sessions.filter(session=>session.date===current);
  const courses=data.events.filter(event=>event.date===current&&event.courseId).sort((a,b)=>a.time.localeCompare(b.time));
  const recommendation=current===day?nextLearning(data,day):null;
  const available=plan.type==='Study'||before;
  return <div className={focus?'today-focus':''}>
    <div className="workspace-toolbar">
      <div className="inline"><IconButton label="Previous day" onClick={()=>setSelected(shift(current,-1))}><ChevronLeft size={16}/></IconButton><input type="date" aria-label="Study date" value={current} onChange={event=>{if(event.target.value)setSelected(event.target.value);}}/><IconButton label="Next day" onClick={()=>setSelected(shift(current,1))}><ChevronRight size={16}/></IconButton><button type="button" className="button" onClick={()=>setSelected(day)}>Today</button></div>
      <div className="inline"><button type="button" className="button" onClick={()=>setFocus(!focus)}>{focus?<Minimize size={16}/>:<Maximize size={16}/>} {focus?'Exit focus mode':'Focus mode'}</button><Add label="Log study time" onClick={()=>open({kind:'form',type:'session',day:current})}/></div>
    </div>
    <div className="workspace-grid today-grid">
      <FocusTimer/>
      <Panel className="today-priorities"><PanelHeader title={before?'First study block':'Daily priorities'} subtitle={before?'Roadmap starts Tuesday, 1 December 2026':dateLabel(current,'EEEE, d MMMM yyyy')}/><Priorities day={current}/></Panel>
      {!focus&&<><Panel><PanelHeader title={cap.hours===30?'Five-hour study day':'Study day template'} subtitle={`${cap.hours}h/week · ${cap.days} study days`}/>
        {!available&&<p className="callout">{plan.type==='Rest'?'Scheduled rest day.':plan.type==='Flex'?'Flex day for recovery, exams or review.':'This date is outside the roadmap.'}</p>}
        <div className="list-stack">{dailySchedule(data,current).map(block=><div className="line-row" key={block.title}><div><strong>{block.title}</strong><p>{block.detail}</p></div><span className="chip nowrap">{block.minutes} min</span></div>)}</div>
      </Panel>
      <Panel><PanelHeader title="Daily checklist" subtitle={before?'1 December 2026 preview':plan.month?.focus}/>
        {tasks.length?<TaskRows tasks={tasks}/>:<Empty>{plan.type==='Rest'?'Rest is scheduled for this date.':plan.type==='Flex'?'Use flex time for gate retakes, planning or recovery.':'No source task starts or runs on this day.'}</Empty>}
        {date.startsWith('2026-12')&&roadmap.decemberDays[String(Number(date.slice(-2)))]&&<div className="callout"><strong>Source daily plan</strong><p>{roadmap.decemberDays[String(Number(date.slice(-2)))]}</p></div>}
        {plan.week&&plan.month?.id!=='2026-12'&&<div className="callout"><strong>Suggested allocation</strong><p>Advance this block’s source objective with today’s study template. Use the implementation block to produce a testable artifact.</p><p>{plan.week.objective}</p></div>}
        <div className="button-row"><Add label="Write reflection" onClick={()=>open({kind:'form',type:'journal',day:current})}/><button type="button" className="button" onClick={()=>open({kind:'form',type:'energy',day:current})}>Log energy</button></div>
      </Panel></>}
      {!focus&&(courses.length>0||recommendation)&&<Panel className="span-full"><PanelHeader title="Course study"/>
        {courses.map(event=><div key={event.id} className="line-row"><span>{event.time} · {event.title}</span><div className="button-row">
          <button type="button" className="button" onClick={()=>open({kind:'form',type:'event',id:event.id})}>Edit plan</button>
          <button type="button" className="button" onClick={()=>open({kind:'form',type:'session',courseId:event.courseId,sectionId:event.sectionId,day:current})}>Log study</button>
        </div></div>)}
        {recommendation&&<div className="line-row"><div><strong>{recommendation.next?.lecture.title??recommendation.course.title}</strong><p>{recommendation.reasons.join(' · ')}</p></div><Link className="button" href={courseLink(recommendation.course.id)}>View course</Link></div>}
      </Panel>}
      <Panel className="span-full"><PanelHeader title="Session history" subtitle={dateLabel(current,'d MMMM yyyy')}/>
        {sessions.length?<div className="list-stack">{sessions.map(session=><button type="button" className="line-row clickable" key={session.id} onClick={()=>open({kind:'form',type:'session',id:session.id})}><div><strong>{session.title}</strong><p>{session.category}</p></div><span><Clock3 size={14}/> {session.minutes} min</span></button>)}</div>:<Empty>Saved study sessions for this date will appear here.</Empty>}
      </Panel>
    </div>
  </div>;
}

type Mode='Timeline'|'Calendar'|'List'|'Kanban';
const statuses=['Not started','In progress','Completed','Blocked','Overdue','Deferred'];
export function RoadmapPage(){
  const data=useCareer(s=>s.data);
  const {open,day}=useApp();
  const [mode,setMode]=useState<Mode>('Timeline');
  const [filters,setFilters]=useState({month:'',priority:'',skill:'',project:'',status:''});
  const months=filters.month?roadmap.months.filter(m=>m.id===filters.month):roadmap.months;
  const selected=roadmap.tasks.filter(task=>
    (!filters.month||task.monthId===filters.month) && (!filters.priority||task.priority===filters.priority) &&
    (!filters.skill||task.skills.includes(filters.skill)) && (!filters.project||task.projectId===filters.project) &&
    (!filters.status||getTaskStatus(data,task,day)===filters.status));
  const filtersOn=Object.values(filters).some(Boolean);
  function selector(key:keyof typeof filters,label:string,options:{id:string;label:string}[]){
    return <label className="filter"><span>{label}</span><select aria-label={label} value={filters[key]} onChange={e=>setFilters({...filters,[key]:e.target.value})}><option value="">All</option>{options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>;
  }
  return <>
    <div className="workspace-toolbar"><div className="segmented" aria-label="Roadmap view">{(['Timeline','Calendar','List','Kanban'] as const).map(name=><button type="button" key={name} onClick={()=>setMode(name)} aria-pressed={mode===name}>{name}</button>)}</div>
      <button type="button" className="button" onClick={()=>open({kind:'section',id:'6'})}><BookOpen size={16}/> Source roadmap</button>
    </div>
    <Panel className="filter-panel">{selector('month','Month',roadmap.months.map(m=>({id:m.id,label:m.label})))}{selector('priority','Priority',['P0','P1','P2','P3'].map(id=>({id,label:id})))}{selector('skill','Skill',roadmap.skills.map(s=>({id:s.id,label:s.title})))}{selector('project','Project',roadmap.projects.map(p=>({id:p.id,label:p.name})))}{selector('status','Status',statuses.map(id=>({id,label:id})))}</Panel>
    {mode==='Calendar'&&<Panel><StudyCalendar key={filters.month} monthId={filters.month||undefined} expanded taskIds={new Set(selected.map(t=>t.id))}/></Panel>}
    {mode==='List'&&<Panel><PanelHeader title="Roadmap tasks" subtitle={selected.length+' matching tasks'}/>{selected.length?<TaskRows tasks={selected}/>:<Empty>No tasks match these filters.</Empty>}</Panel>}
    {mode==='Kanban'&&<div className="kanban">{(filters.status?[filters.status]:statuses).map(status=><Panel className="kanban-column" key={status}><PanelHeader title={status} subtitle={selected.filter(task=>getTaskStatus(data,task,day)===status).length+' tasks'}/>{selected.some(task=>getTaskStatus(data,task,day)===status)?<TaskRows compact tasks={selected.filter(task=>getTaskStatus(data,task,day)===status)}/>:<Empty>No tasks</Empty>}</Panel>)}</div>}
    {mode==='Timeline'&&<div className="timeline">{months.filter(month=>!filtersOn||selected.some(task=>task.monthId===month.id)||Object.keys(filters).every(key=>key==='month'||!filters[key as keyof typeof filters])).map((month,index)=>{
      const monthTasks=roadmap.tasks.filter(task=>task.monthId===month.id);
      const progress=progressFor(data,monthTasks);
      const gate=roadmap.gates.find(gate=>gate.id===month.gateId)!;
      return <Panel className="timeline-month" key={month.id}><details open={index===0||undefined}>
        <summary><span className="month-number">{String(roadmap.months.indexOf(month)+1).padStart(2,'0')}</span><span className="month-summary"><span>{month.label}</span><strong>{month.focus}</strong></span><span className="sub-progress">{progress.done}/{progress.total} tasks</span><ChevronDown size={17}/></summary>
        <div className="timeline-body"><div className="week-cards">{month.weeks.map(week=><button type="button" key={week.id} onClick={()=>open({kind:'week',id:week.id})}><span><CalendarDays size={13}/> Week {week.number} · {dateLabel(week.start)} – {dateLabel(week.end)}</span><strong>{week.objective}</strong></button>)}</div>
          <Disclosure title="Deliverable, mock and competency gate" sub={<Status>{data.gates[gate.id]?.status??'Pending'}</Status>}><Markdown>{month.deliverable}</Markdown><p>{gate.target}</p><p>{gate.evidenceAndCorrection}</p><button type="button" className="button" onClick={()=>open({kind:'form',type:'gate',id:gate.id})}>Assess gate</button></Disclosure>
          <p className="muted">Source resources · {month.resourceText}</p>
          <div className="button-row">{month.resourceIds.map(id=><button type="button" className="chip" key={id} onClick={()=>open({kind:'resource',id})}>{roadmap.resources.find(r=>r.id===id)?.title}</button>)}</div>
          <TaskRows tasks={selected.filter(task=>task.monthId===month.id)}/>
        </div></details></Panel>;
    })}{!selected.length&&<Panel><Empty>No tasks match these filters.</Empty></Panel>}</div>}
  </>;
}
export function DayHistory({date,data}:{date:string;data:Progress}){
  const {open}=useApp();
  const sessions=data.sessions.filter(s=>s.date===date);
  const tasks=roadmap.tasks.filter(task=>task.start===date||data.tasks[task.id]?.completedOn===date);
  const events=data.events.filter(e=>e.date===date);
  return <>
    <div className="button-row"><Add label="Log study time" onClick={()=>open({kind:'form',type:'session',day:date})}/><button type="button" className="button" onClick={()=>open({kind:'form',type:'event',day:date})}>Schedule a session</button></div>
    <h3>Recorded activity</h3>
    {sessions.length?<div className="list-stack">{sessions.map(s=><button type="button" className="line-row clickable" key={s.id} onClick={()=>open({kind:'form',type:'session',id:s.id})}><span>{s.title}</span><span>{s.minutes} min</span></button>)}</div>:<Empty>No study hours recorded.</Empty>}
    <h3>Personal schedule</h3>{events.length?<div className="list-stack">{events.map(e=><button type="button" key={e.id} className="line-row clickable" onClick={()=>open({kind:'form',type:'event',id:e.id})}><span>{e.title}</span><span>{e.time}</span></button>)}</div>:<p className="muted">No personal sessions scheduled.</p>}
    <h3>Roadmap tasks · {planDay(date).type}</h3>{tasks.length?<TaskRows tasks={tasks}/>:<p className="muted">There are no source tasks starting on this date.</p>}
    {Object.keys(data.tasks).filter(id=>!taskById.has(id)&&data.tasks[id].completedOn===date).length>0&&<p className="muted">This date also includes completed tasks from an earlier source revision.</p>}
  </>;
}

