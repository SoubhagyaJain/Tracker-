'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';
import { useCareer } from '@/lib/store';
import { activeMonth, dateLabel, planDay, range, shift, weekStart } from '@/lib/logic';
import { roadmap } from '@/lib/roadmap';
import { IconButton, useApp } from './ui';

export function StudyCalendar({expanded=false,monthId,taskIds}:{expanded?:boolean;monthId?:string;taskIds?:Set<string>}){
  const {open,day,notify}=useApp();
  const data=useCareer(s=>s.data);
  const update=useCareer(s=>s.update);
  const initial=monthId?monthId+'-01':day<roadmap.starts?roadmap.starts:day;
  const [chosen,setChosen]=useState<string|null>(null);
  const start=chosen??planDay(initial).week?.start??weekStart(initial);
  const days=range(start,shift(start,6));
  const month=activeMonth(start);
  function reschedule(eventId:string,date:string){
    const original=data.events.find(event=>event.id===eventId);
    if(!original||original.date===date)return;
    update(prev=>({...prev,events:prev.events.map(event=>event.id===eventId?{...event,date}:event)}));
    notify('Session rescheduled',()=>update(prev=>({...prev,events:prev.events.map(event=>event.id===eventId?{...event,date:original.date}:event)})));
  }
  return <>
    <div className="calendar-head">
      <div className="inline"><CalendarDays size={16}/><h2>Study calendar</h2></div>
      <div className="inline calendar-controls">
        <IconButton label="Previous week" onClick={()=>setChosen(shift(start,-7))}><ChevronLeft size={15}/></IconButton>
        <select aria-label="Calendar month" value={month.id} onChange={event=>setChosen(event.target.value+'-01')}>{roadmap.months.map(month=><option key={month.id} value={month.id}>{month.label}</option>)}</select>
        <IconButton label="Next week" onClick={()=>setChosen(shift(start,7))}><ChevronRight size={15}/></IconButton>
        <IconButton label="Schedule a session" onClick={()=>open({kind:'form',type:'event',day:start})}><Plus size={15}/></IconButton>
      </div>
    </div>
    <div className={'calendar-grid '+(expanded?'calendar-expanded':'')}>
      {days.map(date=>{
        const plan=planDay(date);
        const planned=roadmap.tasks.filter(task=>task.start===date&&(!taskIds||taskIds.has(task.id)));
        const personal=data.events.filter(event=>event.date===date).sort((a,b)=>a.time.localeCompare(b.time));
        return <div key={date} className={'calendar-day '+(date===day?'calendar-current':'')} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();reschedule(event.dataTransfer.getData('text/career-event'),date);}}>
          <button type="button" className="date-tile" aria-label={'Open '+dateLabel(date,'EEEE, d MMMM yyyy')} onClick={()=>open({kind:'day',id:date})}><span>{dateLabel(date,'EEE')}</span><strong>{dateLabel(date,'dd')}</strong></button>
          {plan.type==='Rest'&&<span className="cal-item cal-rest">Rest</span>}
          {plan.type==='Flex'&&<span className="cal-item cal-rest">Flex</span>}
          {planned.slice(0,expanded?10:2).map((task,index)=><button key={task.id} type="button" className={'cal-item cal-'+task.kind.toLowerCase()} title={task.title} onClick={()=>open({kind:'task',id:task.id})}>{expanded?task.title:task.kind==='Gate'?'Gate':task.kind==='Interview'?'Mock':plan.month?.id==='2026-12'?['Diagnostic','Functions','Collections','Debugging','pytest','Mock'][((plan.number-1)%7)]||task.kind:task.kind+(index?' '+(index+1):'')}</button>)}
          {personal.map(event=><button type="button" key={event.id} draggable onDragStart={e=>e.dataTransfer.setData('text/career-event',event.id)} onClick={()=>open({kind:'form',type:'event',id:event.id})} className={'cal-item personal'+(event.courseId?' course-event':'')} title={event.time+' '+event.title}>{expanded?event.time+' '+event.title:event.title}</button>)}
        </div>;
      })}
    </div>
    <div className="calendar-foot"><span><i/>Roadmap plan</span><span><i/>Personal sessions</span><span><i/>Rest / flex</span><span className="calendar-range">{dateLabel(start)} – {dateLabel(shift(start,6))}</span></div>
  </>;
}

