'use client';
import { ArrowDown, ArrowUp, Check, Circle, Pin, X } from 'lucide-react';
import type { LearningTask } from '@/lib/roadmap-schema';
import { useCareer } from '@/lib/store';
import { dateLabel, getTaskStatus, isDone, priorityTasks } from '@/lib/logic';
import { IconButton, Empty, Status, useApp } from './ui';

export function TaskRows({tasks,reasons,compact=false}:{tasks:LearningTask[];reasons?:string[];compact?:boolean}){
  const data=useCareer(state=>state.data);
  const update=useCareer(state=>state.update);
  const {open,day,notify}=useApp();
  return <div className={compact?'task-list compact':'task-list'}>{tasks.map((task,i)=>{
    const done=isDone(data,task.id);
    const status=getTaskStatus(data,task,day);
    function toggle(){
      const original=data.tasks[task.id];
      update(prev=>{
        const record={...prev.tasks,[task.id]:{...original,notes:original?.notes??'',status:done?undefined:'Completed' as const,completedOn:done?undefined:day}};
        return {...prev,tasks:record};
      });
      notify(done?'Task reopened':'Task completed',()=>update(prev=>{
        const next={...prev.tasks};
        if(original) next[task.id]=original;
        else delete next[task.id];
        return {...prev,tasks:next};
      }));
    }
    return <div key={task.id} className="task-row">
      <button type="button" className={'check-button '+(done?'checked':'')} onClick={task.kind==='Gate'?()=>open({kind:'form',type:'gate',id:task.id}):toggle} aria-label={task.kind==='Gate'?'Assess gate: '+task.title:done?'Reopen '+task.title:'Complete '+task.title}>{done?<Check size={14}/>:<Circle size={16}/>}</button>
      <button type="button" className="task-open" onClick={()=>open({kind:'task',id:task.id})}><strong>{task.title}</strong><small>{reasons?.[i]??task.kind+' · '+dateLabel(task.due)}</small></button>
      {!compact&&<Status>{status}</Status>}
    </div>;
  })}</div>;
}

export function Priorities({day:date,compact=false}:{day?:string;compact?:boolean}){
  const {day:today,notify}=useApp();
  const day=date??today;
  const data=useCareer(state=>state.data);
  const update=useCareer(state=>state.update);
  const priorities=priorityTasks(data,day);
  const dueReviews=data.reviews.filter(review=>review.status==='Scheduled'&&review.date<=day).sort((a,b)=>a.date.localeCompare(b.date));
  const {open}=useApp();
  if (!priorities.length&&!dueReviews.length) return <Empty>No open priorities for this date. Pin a task from its detail panel to plan your next block.</Empty>;
  const ids=priorities.map(item=>item.task.id);
  function move(index:number,direction:number){
    const order=[...ids];
    [order[index],order[index+direction]]=[order[index+direction],order[index]];
    update(data=>({...data,priorities:{...data.priorities,[day]:order}}));
    notify('Priority order saved');
  }
  return <><TaskRows tasks={priorities.map(item=>item.task)} reasons={priorities.map(item=>item.reason)} compact={compact}/>
    {dueReviews.slice(0,compact?1:3).map(review=><button type="button" key={review.id} className="line-row clickable" onClick={()=>open({kind:'form',type:'review',id:review.id})}><span>{review.title}</span><Status>Review due</Status></button>)}
    {!compact&&<div className="list-stack priority-controls">{priorities.map((item,index)=><div key={item.task.id} className="line-row"><span>{item.task.title}</span><div className="inline">
      {index>0&&<IconButton label={'Move priority '+(index+1)+' up'} onClick={()=>move(index,-1)}><ArrowUp size={15}/></IconButton>}
      {index<ids.length-1&&<IconButton label={'Move priority '+(index+1)+' down'} onClick={()=>move(index,1)}><ArrowDown size={15}/></IconButton>}
      <IconButton label={(data.priorities[day]?.includes(item.task.id)?'Unpin ':'Pin ')+item.task.title} onClick={()=>update(previous=>{
        const before=previous.priorities[day]??[];
        const next=before.includes(item.task.id)?before.filter(id=>id!==item.task.id):[item.task.id,...before];
        return {...previous,priorities:{...previous.priorities,[day]:next}};
      })}>{data.priorities[day]?.includes(item.task.id)?<X size={14}/>:<Pin size={14}/>}</IconButton>
    </div></div>)}</div>}</>;
}

