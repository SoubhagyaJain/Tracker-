'use client';
import { useEffect,useId,useState } from 'react';
import { Pin, Play, Timer } from 'lucide-react';
import { roadmap, taskById, skillById, projectById, monthById } from '@/lib/roadmap';
import { taskStatuses,taskProgressSchema } from '@/lib/progress-schema';
import { useCareer } from '@/lib/store';
import { dateLabel,daysBetween,getTaskStatus,milestoneStatus } from '@/lib/logic';
import { Editors,editorTitle } from './editors';
import { CourseEditor } from './learning';
import { ResourceDetails } from './library';
import { ProjectDetails } from './projects';
import { SkillDetails } from './skills';
import { DayHistory } from './study';
import { TaskRows } from './tasks';
import { Disclosure,DialogFrame,Field,Form,Markdown,Status,field,useApp,type Detail } from './ui';

const weeks=roadmap.months.flatMap(m=>m.weeks);
function getTitle(detail:Detail){
  if(detail.kind==='form')return editorTitle(detail);
  if(detail.kind==='course-edit')return detail.progressOnly?'Update course progress':detail.id?'Edit Udemy course':'Add Udemy course';
  const {kind,id}=detail;
  if(kind==='task')return 'Roadmap task';
  if(kind==='week')return 'Week '+(weeks.find(w=>w.id===id)?.number??'')+' · '+(monthById.get(id.slice(0,7))?.label??'');
  if(kind==='day')return dateLabel(id,'EEEE, d MMMM yyyy');
  if(kind==='section')return roadmap.sections.find(s=>s.number===Number(id))?.title??'Source roadmap';
  if(kind==='project')return projectById.get(id)?.name??'Project';
  if(kind==='skill')return skillById.get(id)?.title??'Skill';
  if(kind==='resource')return roadmap.resources.find(r=>r.id===id)?.title??'Resource';
  return roadmap.milestones.find(m=>m.id===id)?.title??'Career milestone';
}
export function Details({detail,onClose}:{detail:Detail|null;onClose:()=>void}){
  return <DialogFrame open={!!detail} title={detail?getTitle(detail):'Details'} onClose={onClose}>
    {detail&&<DetailBody key={JSON.stringify(detail)} detail={detail}/>}
  </DialogFrame>;
}
function TaskDetail({id}:{id:string}){
  const data=useCareer(s=>s.data);
  const update=useCareer(s=>s.update);
  const {day,notify,open}=useApp();
  const task=taskById.get(id);
  if(!task)return null;
  const record=data.tasks[task.id];
  const pinned=data.priorities[day]?.includes(task.id);
  return <>
    <div className="button-row"><Status>{task.priority}</Status><Status>{getTaskStatus(data,task,day)}</Status><span className="chip">{task.kind} · due {dateLabel(task.due,'d MMM yyyy')}</span></div>
    <h3>Source objective</h3><Markdown>{task.title}</Markdown>
    <div className="button-row">{task.skills.map(id=><button type="button" className="chip" key={id} onClick={()=>open({kind:'skill',id})}>{skillById.get(id)?.title}</button>)}</div>
    {task.projectId&&<button type="button" className="button" onClick={()=>open({kind:'project',id:task.projectId!})}>{projectById.get(task.projectId)?.name}</button>}
    <h3>Personal progress</h3>
    {task.kind==='Gate'&&<button type="button" className="button" onClick={()=>open({kind:'form',type:'gate',id:task.id})}>Assess this gate</button>}
    <Form onSave={form=>{
      const status=field(form,'status')||undefined;
      const item=taskProgressSchema.parse({status,notes:field(form,'notes'),completedOn:status==='Completed'?record?.completedOn??day:undefined});
      update(prev=>({...prev,tasks:{...prev.tasks,[task.id]:item}}));notify('Task updated');
    }}>
      {task.kind!=='Gate'&&<Field label="Task status" name="status" options={[{value:'',label:'Not started'},...taskStatuses]} value={record?.status}/>}
      <Field label="Task notes" name="notes" type="textarea" value={record?.notes}/>
    </Form>
    <div className="button-row">
      <button type="button" className="button" onClick={()=>open({kind:'form',type:'timer',taskId:task.id})}><Play size={15}/>Start focus timer</button>
      <button type="button" className="button" onClick={()=>open({kind:'form',type:'session',taskId:task.id})}><Timer size={15}/>Log study time</button>
      <button type="button" className="button" onClick={()=>open({kind:'form',type:'journal',taskId:task.id})}>Open journal entry</button>
      <button type="button" className="button" onClick={()=>{
        update(prev=>{const ids=prev.priorities[day]??[];return {...prev,priorities:{...prev.priorities,[day]:pinned?ids.filter(id=>id!==task.id):[task.id,...ids]}};});
        notify(pinned?'Removed from today’s priorities':'Pinned to today’s priorities');
      }}><Pin size={15}/>{pinned?'Unpin from Today':'Pin to Today'}</button>
    </div>
  </>;
}
function MilestoneDetail({id}:{id:string}){
  const data=useCareer(s=>s.data);
  const update=useCareer(s=>s.update);
  const {day,notify,open}=useApp();
  const milestone=roadmap.milestones.find(m=>m.id===id);
  if(!milestone)return null;
  const marked=!!data.milestones[id];
  const days=daysBetween(day,milestone.date);
  return <>
    <div className="button-row"><Status>{milestoneStatus(data,milestone,day)}</Status><span className="chip">{dateLabel(milestone.date,'d MMM yyyy')} · {days>=0?days+' days left':Math.abs(days)+' days past target'}</span></div>
    <h3>Completion criteria</h3><Markdown>{milestone.criteria}</Markdown>
    {milestone.taskIds.length>0&&<><h3>Roadmap dependencies</h3><TaskRows tasks={milestone.taskIds.map(id=>taskById.get(id)!)}/></>}
    {milestone.projectId&&<button type="button" className="button" onClick={()=>open({kind:'project',id:milestone.projectId!})}>View related project</button>}
    {id==='internship-gate'&&<button type="button" className="button" onClick={()=>open({kind:'milestone',id:'evaluation-release'})}>Open June CI evaluation gate release</button>}
    <button type="button" className="button primary" onClick={()=>{update(prev=>({...prev,milestones:{...prev.milestones,[id]:!marked}}));notify(marked?'Completion mark cleared':'Milestone recorded');}}>{marked?'Clear manual completion':'Record completion'}</button>
  </>;
}
function SourceDiagram({code}:{code:string}){
  const id=useId().replace(/[^a-z0-9]/gi,'');
  const [svg,setSVG]=useState('');
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let alive=true;
    async function render(){
      try{
        const {default:mermaid}=await import('mermaid');
        mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'neutral'});
        const result=await mermaid.render('roadmap-'+id,code);
        if(alive)setSVG(result.svg);
      }catch{if(alive)setFailed(true);}
    }
    void render();
    return ()=>{alive=false;};
  },[code,id]);
  // Code is from the build-time source and Mermaid uses its strict security mode.
  return failed?<pre>{code}</pre>:svg?<div className="source-diagram" dangerouslySetInnerHTML={{__html:svg}}/>:<p>Rendering dependency diagram…</p>;
}
function DetailBody({detail}:{detail:Detail}){
  const data=useCareer(s=>s.data);
  if(detail.kind==='form')return <Editors state={detail}/>;
  if(detail.kind==='course-edit')return <CourseEditor id={detail.id} progressOnly={detail.progressOnly}/>;
  const {kind,id}=detail;
  if(kind==='task')return <TaskDetail id={id}/>;
  if(kind==='project')return <ProjectDetails id={id} embedded/>;
  if(kind==='skill')return <SkillDetails id={id}/>;
  if(kind==='resource')return <ResourceDetails id={id}/>;
  if(kind==='milestone')return <MilestoneDetail id={id}/>;
  if(kind==='day')return <DayHistory date={id} data={data}/>;
  if(kind==='section'){
    const section=roadmap.sections.find(s=>s.number===Number(id));
    if(!section)return null;
    const parts=section.markdown.split(/```mermaid\s+([\s\S]+?)```/g);
    return <div className="source-render">{parts.map((part,index)=>index%2===0?<Markdown key={index}>{part}</Markdown>:<div key={index}><SourceDiagram code={part}/><Disclosure title="Original Mermaid source"><pre>{part}</pre></Disclosure></div>)}</div>;
  }
  const week=weeks.find(w=>w.id===id);
  if(!week)return null;
  return <>
    <p className="muted">{dateLabel(week.start,'d MMM yyyy')} – {dateLabel(week.end,'d MMM yyyy')}</p>
    <h3>Source weekly objective</h3><Markdown>{week.objective}</Markdown>
    {id.startsWith('2026-12')&&<div className="callout"><strong>Checkpoint</strong><p>{roadmap.decemberCheckpoints[week.number-1].checkpoint}</p></div>}
    <h3>Tasks</h3><TaskRows tasks={week.taskIds.map(id=>taskById.get(id)!)}/>
  </>;
}

