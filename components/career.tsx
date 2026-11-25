'use client';
import { useState } from 'react';
import { CalendarClock, Check, Circle, ClipboardCheck } from 'lucide-react';
import { roadmap } from '@/lib/roadmap';
import { stages } from '@/lib/progress-schema';
import { useCareer } from '@/lib/store';
import { dateLabel, daysBetween, distinctPasses, hasScreen, interviewPass, interviewTotal, isSubmitted, milestoneStatus, percent, readiness } from '@/lib/logic';
import { Add, Disclosure, Empty, Markdown, OpenLink, Panel, PanelHeader, Ring, Status, useApp } from './ui';
import { StudyForecast } from './forecast';

export function Interviews(){
  const data=useCareer(s=>s.data);
  const {open}=useApp();
  const [area,setArea]=useState('');
  const attempts=[...data.interviews].filter(attempt=>!area||attempt.area===area).sort((a,b)=>b.date.localeCompare(a.date));
  const passes=distinctPasses(data.interviews);
  return <>
    <div className="workspace-toolbar"><p className="muted">Five dimensions, each scored from 0 to 4.</p><Add label="Record mock interview" onClick={()=>open({kind:'form',type:'interview'})}/></div>
    <div className="workspace-grid">
      <Panel dark><PanelHeader title="Mock interview readiness" action={<ClipboardCheck size={19}/>}/><div className="big-stat">{Math.min(2,passes)}<small> / 2</small></div><p>Passing prompts · ≥15/20 and every dimension ≥2</p><p>{passes>=2?'Source rubric met across separate prompts.':'Practice on separate prompts and use at least one human reviewer when possible.'}</p></Panel>
      <Panel><PanelHeader title="Scoring rubric" subtitle="Correctness, independence, reasoning, communication and verification"/><div className="list-stack">{['Absent','Heavy help','Partial or one targeted hint','Correct independently','Correct with strong edge cases and trade-offs'].map((text,index)=><div key={text} className="line-row"><strong>{index}</strong><span>{text}</span></div>)}</div></Panel>
      <Panel className="span-full"><PanelHeader title="Mock history" action={<select aria-label="Filter interviews by domain" value={area} onChange={e=>setArea(e.target.value)}><option value="">All domains</option>{roadmap.interviewAreas.map(a=><option key={a.title}>{a.title}</option>)}</select>}/>{attempts.length?<div className="list-stack">{attempts.map(a=><button type="button" key={a.id} className="line-row clickable" onClick={()=>open({kind:'form',type:'interview',id:a.id})}><div><strong>{a.title}</strong><p>{a.area} · {dateLabel(a.date,'d MMM yyyy')}{a.reviewer?' · '+a.reviewer:''}</p></div><div className="inline"><strong>{interviewTotal(a)}/20</strong><Status>{interviewPass(a)?'Passed':'Practice'}</Status></div></button>)}</div>:<Empty>Record your first mock to compare scores and review notes.</Empty>}</Panel>
      <Panel className="span-full"><PanelHeader title="Practice by domain" subtitle="Formats and readiness criteria from Section 12"/>{roadmap.interviewAreas.map(area=><Disclosure key={area.title} title={area.title}><p>{area.format}</p><p><strong>Readiness bar</strong> · {area.bar}</p></Disclosure>)}</Panel>
    </div>
  </>;
}
export function Career(){
  const data=useCareer(s=>s.data);
  const update=useCareer(s=>s.update);
  const {day,open,notify}=useApp();
  const [tab,setTab]=useState('Readiness');
  const checks=readiness(data);
  const done=checks.filter(x=>x.done).length;
  const applied=data.jobs.filter(isSubmitted);
  const screens=applied.filter(hasScreen);
  const matched=applied.filter(job=>job.wellMatched);
  const offers=applied.filter(j=>j.stage==='Offer'||j.stageHistory?.includes('Offer'));
  const rejectedFinal=applied.filter(job=>job.stage==='Rejected'&&job.stageHistory?.includes('Final round'));
  const rejectedTechnical=applied.filter(job=>job.stage==='Rejected'&&job.stageHistory?.includes('Technical interview')&&!job.stageHistory?.includes('Final round'));
  function move(id:string,stage:typeof stages[number]){
    if(!data.jobs.some(j=>j.id===id&&j.stage!==stage))return;
    update(prev=>({...prev,jobs:prev.jobs.map(j=>j.id===id?{...j,stage,stageHistory:[...new Set([...(j.stageHistory??[]),j.stage,stage])]}:j)}));
    notify('Application moved to '+stage);
  }
  return <>
    <div className="workspace-toolbar"><div className="segmented">{['Readiness','Applications','Market research'].map(name=><button key={name} type="button" onClick={()=>setTab(name)} aria-pressed={tab===name}>{name}</button>)}</div><Add label={tab==='Market research'?'Add research note':'Add application'} onClick={()=>open({kind:'form',type:tab==='Market research'?'market':'job'})}/></div>
    {tab==='Readiness'&&<div className="workspace-grid">
      <Panel><PanelHeader title="June internship readiness" subtitle={done+' of '+checks.length+' requirements met'}/><div className="readiness-ring"><Ring value={percent(done,checks.length)} label="Requirements met"/></div><div className="list-stack">{checks.map(check=>{
        const content=<><div className="inline">{check.done?<Check size={16}/>:<Circle size={16}/>}<span>{check.label}</span></div><span className="muted">{check.done?'Met':'Open'}</span></>;
        return 'manual' in check?<button type="button" className="line-row clickable" key={check.id} aria-pressed={check.done} onClick={()=>update(prev=>({...prev,readiness:{...prev.readiness,[check.id]:!check.done}}))}>{content}</button>:<div className="line-row" key={check.id}>{content}</div>;
      })}</div></Panel>
      <Panel><PanelHeader title="Career milestones" subtitle="Planned dates and recorded evidence"/>
        <div className="list-stack">{roadmap.milestones.map(m=>{
          const days=daysBetween(day,m.date);
          return <button type="button" className="line-row clickable" key={m.id} onClick={()=>open({kind:'milestone',id:m.id})}><div><strong>{m.title}</strong><p><CalendarClock size={13}/> {dateLabel(m.date,'d MMM yyyy')} · {days>0?days+' days left':days===0?'Due today':Math.abs(days)+' days since target'}</p></div><Status>{milestoneStatus(data,m,day)}</Status></button>;
        })}</div></Panel>
      <StudyForecast data={data} day={day}/>
      <Panel className="span-full"><PanelHeader title="Search strategy"/>{roadmap.sections.slice(10,13).filter(s=>s.number!==12).map(s=><Disclosure key={s.number} title={s.title}><Markdown>{s.markdown}</Markdown></Disclosure>)}</Panel>
    </div>}
    {tab==='Applications'&&<>
      <div className="metric-grid top-metrics"><Panel><strong className="big-stat">{applied.length}</strong><p>Applications submitted</p></Panel><Panel><strong className="big-stat">{applied.length?percent(screens.length,applied.length)+'%':'—'}</strong><p>Recruiter-screen conversion</p></Panel><Panel><strong className="big-stat">{applied.length?percent(offers.length,applied.length)+'%':'—'}</strong><p>Offer conversion</p></Panel></div>
      {matched.length>=25&&matched.filter(hasScreen).length<=1&&<p className="callout">Recruiter-screen conversion triggered the source intervention. Review résumé, role titles, location and eligibility targeting.</p>}
      {rejectedTechnical.length>=2&&<p className="callout">{rejectedTechnical.length} applications ended after a technical round. Use feedback and mock scores to identify the gap to practice.</p>}
      {rejectedFinal.length>=2&&<p className="callout">{rejectedFinal.length} applications ended after a final round. Review design communication, project credibility and behavioral depth.</p>}
      <div className="kanban application-board">{stages.map(stage=>{
        const jobs=data.jobs.filter(j=>j.stage===stage);
        return <Panel className="kanban-column" key={stage}>
          <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();move(e.dataTransfer.getData('text/career-job'),stage);}} className="kanban-drop">
            <PanelHeader title={stage} subtitle={jobs.length+' applications'}/>
            {jobs.length?jobs.map(job=><button type="button" draggable key={job.id} onDragStart={e=>e.dataTransfer.setData('text/career-job',job.id)} onClick={()=>open({kind:'form',type:'job',id:job.id})} className="application-card"><strong>{job.company}</strong><span>{job.role}</span>{job.followup&&<small>Follow up {dateLabel(job.followup)}</small>}</button>):<Empty>Drop or edit an application into this stage.</Empty>}
          </div>
        </Panel>;
      })}</div>
      <Panel className="after-board"><PanelHeader title="Pipeline interventions"/><div className="list-stack"><p>After 25 well-matched applications, zero or one recruiter screen triggers résumé, title and location repair.</p><p>Repeated practical failures trigger targeted skill drills and a pause on low-fit volume.</p><p>Repeated final rounds without offers call for review of design communication, project credibility and behavioral depth.</p></div></Panel>
    </>}
    {tab==='Market research'&&<div className="workspace-grid">
      <Panel className="span-full"><PanelHeader title="Source research snapshot" subtitle={dateLabel(roadmap.snapshot,'d MMMM yyyy')}/>
        <p>Historical posting examples show eligibility and responsibilities at the snapshot date. The compensation planning bands and disclosed listing pay are labeled in the source tables.</p>
        {roadmap.sections.slice(0,3).map(s=><Disclosure key={s.number} title={s.title} initial={s.number===1}><Markdown>{s.markdown}</Markdown></Disclosure>)}
      </Panel>
      <Panel className="span-full"><PanelHeader title="Your market notes"/>{data.market.length?<div className="list-stack">{[...data.market].sort((a,b)=>b.date.localeCompare(a.date)).map(note=><div className="line-row" key={note.id}><div><button type="button" className="link-button" onClick={()=>open({kind:'form',type:'market',id:note.id})}>{note.title}</button><p>{dateLabel(note.date)} · {note.notes}</p></div>{note.link&&<OpenLink href={note.link}>Source</OpenLink>}</div>)}</div>:<Empty>Add a dated observation from your own research.</Empty>}</Panel>
    </div>}
  </>;
}

