'use client';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Circle, Layers3 } from 'lucide-react';
import { projectById,roadmap } from '@/lib/roadmap';
import { projectProgressSchema, projectStatuses, type Progress } from '@/lib/progress-schema';
import { useCareer } from '@/lib/store';
import { capacityFor, dateLabel, progressFor } from '@/lib/logic';
import { Disclosure, Field, Form, Markdown, OpenLink, Panel, PanelHeader, Status, field, useApp } from './ui';
import { TaskRows } from './tasks';

const defaultProject:Progress['projects'][string]={status:'Planned',repo:'',demo:'',notes:'',milestones:[],metrics:{}};
export function Projects(){
  const data=useCareer(s=>s.data);
  const {day,open}=useApp();
  const plan=capacityFor(data,day);
  return <>
    <Panel className="project-intro"><PanelHeader title={plan.hours+'h portfolio plan'} subtitle={plan.hours===20?'Core releases and a compact CI gate':'Three core systems · evidence before electives'} action={<button type="button" className="button" onClick={()=>open({kind:'section',id:'10'})}>Source portfolio</button>}/><p>{plan.rules}</p></Panel>
    <div className="workspace-grid project-grid">{roadmap.projects.map(project=>{
      const record=data.projects[project.id]??defaultProject;
      return <Panel key={project.id} dark={project.number===1}><div className="project-card-top"><div className="identity-logo"><Layers3 size={18}/></div><Status>{record.status}</Status></div><small className="muted">{project.core?'Core project':'Elective'} · {project.hours}</small><h2>{project.name}</h2>{project.name!==project.title&&<p>{project.title}</p>}
        <p>{project.release} · {record.milestones.length}/{project.milestones.length} milestones</p><div className="thin-progress"><i style={{width:(record.milestones.length/project.milestones.length*100)+'%'}}/></div><Link className="button" href={'/projects/'+project.id+'/'}>Open project <ArrowUpRight size={15}/></Link>
      </Panel>;
    })}</div>
  </>;
}
export function ProjectDetails({id,embedded=false}:{id:string;embedded?:boolean}){
  const data=useCareer(s=>s.data);
  const update=useCareer(s=>s.update);
  const {open,notify}=useApp();
  const project=projectById.get(id);
  if(!project)return null;
  const record=data.projects[id]??defaultProject;
  const tasks=roadmap.tasks.filter(task=>task.projectId===id);
  const progress=progressFor(data,tasks);
  function updateProject(change:(record:typeof defaultProject)=>typeof defaultProject){
    update(data=>({...data,projects:{...data.projects,[id]:change(data.projects[id]??defaultProject)}}));
  }
  return <div className={embedded?'detail-stack':'workspace-grid'}>
    <Panel className="span-full" dark={!embedded}>
      <PanelHeader title={project.title} subtitle={project.hours+' · '+project.release} action={<Status>{record.status}</Status>}/>
      <div className="architecture" aria-label="Project architecture">{project.architecture.map((step,index)=><span key={step}><i>{step}</i>{index<project.architecture.length-1&&<ArrowRight size={15}/>}</span>)}</div>
      <div className="button-row">{project.stack.map(item=><span key={item} className="chip">{item}</span>)}</div>
    </Panel>
    <Panel><PanelHeader title="Implementation checklist" subtitle={progress.done+' linked roadmap tasks complete'}/>
      <div className="list-stack">{project.milestones.map(milestone=>{
        const done=record.milestones.includes(milestone.id);
        return <button type="button" className="line-row clickable" key={milestone.id} onClick={()=>updateProject(r=>({...r,milestones:done?r.milestones.filter(id=>id!==milestone.id):[...r.milestones,milestone.id]}))}><div className="inline">{done?<Check size={16}/>:<Circle size={16}/>}<span>{milestone.title}</span></div><span className="sr-only">{done?'Complete':'Incomplete'}</span></button>;
      })}</div>{tasks.length>0&&<Disclosure title="Linked roadmap tasks"><TaskRows tasks={tasks}/></Disclosure>}
    </Panel>
    <Panel><PanelHeader title="Release and links"/>
      <Form onSave={form=>{const parsed=projectProgressSchema.parse({...record,status:field(form,'status'),repo:field(form,'repo'),demo:field(form,'demo'),notes:field(form,'notes')});updateProject(current=>({...current,status:parsed.status,repo:parsed.repo,demo:parsed.demo,notes:parsed.notes}));notify('Project updated');}}>
        <Field name="status" label="Project status" options={projectStatuses} value={record.status}/><Field name="repo" label="Repository URL" type="url" value={record.repo}/><Field name="demo" label="Demo URL" type="url" value={record.demo}/><Field name="notes" label="Project notes" type="textarea" value={record.notes}/>
      </Form><div className="button-row">{record.repo&&<OpenLink href={record.repo}>Repository</OpenLink>}{record.demo&&<OpenLink href={record.demo}>Demo</OpenLink>}</div>
    </Panel>
    <Panel className="span-full"><PanelHeader title="Evaluation and benchmarks" subtitle="Record measured results with evaluation context"/><div className="metric-grid">{project.metrics.map(metric=>{
      const measurement=record.metrics[metric.id];
      return <button type="button" className="metric" key={metric.id} onClick={()=>open({kind:'form',type:'metric',id:metric.id,projectId:id})}><span>{metric.title}</span><strong>{measurement?measurement.value+' '+measurement.unit:'Unmeasured'}</strong>{measurement&&<small>{dateLabel(measurement.date)} {measurement.context}</small>}</button>;
    })}</div></Panel>
    <Panel className="span-full"><PanelHeader title="Source specifications"/>{project.sections.map((section,index)=><Disclosure key={section.title} title={section.title} initial={index===0}><Markdown>{section.body}</Markdown></Disclosure>)}
      <button type="button" className="button" onClick={()=>open({kind:'section',id:'10'})}>Repository standards and hardware plan</button>
    </Panel>
  </div>;
}

