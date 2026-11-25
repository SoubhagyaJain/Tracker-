'use client';
import { useRef,useState } from 'react';
import { Bookmark, BookOpen, Check, CloudDownload, Download, FileJson, Upload } from 'lucide-react';
import { roadmap } from '@/lib/roadmap';
import { capacitySchema, emptyProgress, settingsSchema, type Progress } from '@/lib/progress-schema';
import { useCareer } from '@/lib/store';
import { capacityFor, dateLabel, makeBackup, readBackup, remainingPlannedMinutes, shortHours, toCSV, unmatchedProgress } from '@/lib/logic';
import { TaskRows } from './tasks';
import { Add, CheckField, DialogFrame, Disclosure, Empty, Field, Form, IconButton, Markdown, OpenLink, Panel, PanelHeader, Status, download, field, useApp } from './ui';

const emptyResource={bookmarked:false,completed:false,notes:''};
export function Resources(){
  const data=useCareer(s=>s.data);
  const update=useCareer(s=>s.update);
  const {open}=useApp();
  const [query,setQuery]=useState('');
  const [subject,setSubject]=useState('');
  const [priority,setPriority]=useState('');
  const [saved,setSaved]=useState(false);
  const list=roadmap.resources.filter(r=>(!subject||r.subject===subject)&&(!priority||r.priority===priority)&&
    (!saved||data.resources[r.id]?.bookmarked)&&(r.title+' '+r.scope+' '+r.subject).toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <div className="workspace-toolbar"><p className="muted">{list.length} of {roadmap.resources.length} source resources</p><button type="button" className="button" onClick={()=>open({kind:'section',id:'9'})}><BookOpen size={16}/> Source library</button></div>
    <Panel className="filter-panel"><label className="filter"><span>Search</span><input type="search" aria-label="Search resources" value={query} placeholder="Search titles or scope" onChange={e=>setQuery(e.target.value)}/></label>
      <label className="filter"><span>Subject</span><select aria-label="Resource subject" value={subject} onChange={e=>setSubject(e.target.value)}><option value="">All subjects</option>{[...new Set(roadmap.resources.map(r=>r.subject))].map(s=><option key={s}>{s}</option>)}</select></label>
      <label className="filter"><span>Priority</span><select aria-label="Resource priority" value={priority} onChange={e=>setPriority(e.target.value)}><option value="">All priorities</option>{['P0','P1','P2','P3'].map(p=><option key={p}>{p}</option>)}</select></label>
      <button className={'button '+(saved?'primary':'')} type="button" aria-pressed={saved} onClick={()=>setSaved(!saved)}><Bookmark size={15}/> Bookmarked</button>
    </Panel>
    <div className="workspace-grid resource-grid">{list.map(resource=>{
      const record=data.resources[resource.id]??emptyResource;
      return <Panel key={resource.id}><PanelHeader title={resource.title} subtitle={resource.subject} action={<IconButton label={record.bookmarked?'Remove bookmark':'Bookmark '+resource.title} onClick={()=>update(prev=>({...prev,resources:{...prev.resources,[resource.id]:{...record,bookmarked:!record.bookmarked}}}))}><Bookmark size={17} fill={record.bookmarked?'currentColor':'none'}/></IconButton>}/>
        <p>{resource.scope}</p><div className="button-row"><Status>{resource.priority}</Status>{record.completed&&<Status>Completed</Status>}<button type="button" className="button" onClick={()=>open({kind:'resource',id:resource.id})}>Notes and tasks</button><OpenLink href={resource.url}>Open resource</OpenLink></div>
      </Panel>;
    })}</div>
    {!list.length&&<Panel><Empty>No resources match these filters.</Empty></Panel>}
  </>;
}
export function ResourceDetails({id}:{id:string}){
  const data=useCareer(s=>s.data);
  const update=useCareer(s=>s.update);
  const {notify}=useApp();
  const r=roadmap.resources.find(r=>r.id===id);
  if(!r)return null;
  const record=data.resources[r.id]??emptyResource;
  const tasks=roadmap.tasks.filter(task=>task.skills.some(id=>r.skills.includes(id)));
  return <>
    <div className="button-row"><Status>{r.priority}</Status><OpenLink href={r.url}>Open official resource</OpenLink></div>
    <h3>Recommended scope</h3><Markdown>{r.scope}</Markdown>
    <Form onSave={form=>{update(prev=>({...prev,resources:{...prev.resources,[r.id]:{bookmarked:form.has('bookmarked'),completed:form.has('completed'),notes:field(form,'notes')}}}));notify('Resource updated');}}>
      <CheckField name="bookmarked" checked={record.bookmarked}>Bookmarked</CheckField><CheckField name="completed" checked={record.completed}>Completed</CheckField><Field label="Personal notes" type="textarea" name="notes" value={record.notes}/>
    </Form>
    <h3>Related roadmap tasks</h3>{tasks.length?<TaskRows tasks={tasks}/>:<Empty>No scheduled task directly links to this elective resource.</Empty>}
  </>;
}
export function Journal(){
  const data=useCareer(s=>s.data);
  const {day,open}=useApp();
  const [tab,setTab]=useState('Entries');
  const nowReviews=[...data.reviews].sort((a,b)=>a.date.localeCompare(b.date));
  const challenges=data.journal.filter(j=>j.kind==='No-AI challenge');
  return <>
    <div className="workspace-toolbar"><div className="segmented">{['Entries','Review queue','No-AI challenges'].map(t=><button type="button" key={t} onClick={()=>setTab(t)} aria-pressed={tab===t}>{t}</button>)}</div><Add label={tab==='Review queue'?'Schedule review':'New journal entry'} onClick={()=>open({kind:'form',type:tab==='Review queue'?'review':'journal'})}/></div>
    <div className="workspace-grid">
      <Panel><PanelHeader title={tab==='Entries'?'Learning journal':tab} subtitle={tab==='Review queue'?'1, 3, 7, 14 and 30-day retrieval intervals':tab==='No-AI challenges'?'Independent implementations and debugging drills':'Independent attempts, verification and weekly reflections'}/>
        {tab==='Review queue'?nowReviews.length?<div className="list-stack">{nowReviews.map(review=><button className="line-row clickable" type="button" key={review.id} onClick={()=>open({kind:'form',type:'review',id:review.id})}><div><strong>{review.title}</strong><p>{dateLabel(review.date,'d MMM yyyy')}{review.interval>0?' · '+review.interval+'-day interval':''}</p></div><Status>{review.status==='Done'?(review.rating||'Completed'):review.date<=day?'Due':'Scheduled'}</Status></button>)}</div>:<Empty>Schedule a review or add intervals to a journal entry.</Empty>
          :<>{(tab==='Entries'?data.journal:challenges).length?<div className="list-stack">{[...(tab==='Entries'?data.journal:challenges)].sort((a,b)=>b.date.localeCompare(a.date)).map(entry=><button className="line-row clickable" type="button" key={entry.id} onClick={()=>open({kind:'form',type:'journal',id:entry.id})}><div><strong>{entry.title}</strong><p>{entry.kind} · {dateLabel(entry.date)}{entry.independent?' · Reproduced independently':''}</p></div><span>{entry.usedAI?'AI assisted':''}</span></button>)}</div>:<Empty>{tab==='Entries'?'Record what you attempted, what you learned and what you will do next.':'Choose No-AI challenge as the entry type to log an independent drill.'}</Empty>}</>}
      </Panel>
      <Panel dark><PanelHeader title="Independent learning method" subtitle="Section 8 · practice before assistance"/>
        <p>Attempt the problem, ask for the smallest useful hint, rebuild it from memory, and verify your result.</p>
        <div className="list-stack"><div className="line-row"><span>Reviews due</span><strong>{nowReviews.filter(r=>r.status==='Scheduled'&&r.date<=day).length}</strong></div><div className="line-row"><span>No-AI challenges</span><strong>{challenges.length}</strong></div><div className="line-row"><span>Weekly reflections recorded</span><strong>{data.journal.filter(j=>j.kind==='Reflection').length}</strong></div></div>
        <button type="button" className="button" onClick={()=>open({kind:'section',id:'8'})}>Read the source method</button>
      </Panel>
    </div>
  </>;
}
export function Settings(){
  const data=useCareer(s=>s.data);
  const update=useCareer(s=>s.update);
  const replace=useCareer(s=>s.replace);
  const {day,notify,open}=useApp();
  const [pending,setPending]=useState<{data:Progress;sourceChanged:boolean}|null>(null);
  const [reset,setReset]=useState(false);
  const [error,setError]=useState('');
  const upload=useRef<HTMLInputElement>(null);
  const mode=capacityFor(data,day);
  function exportBackup(snapshot:Progress=data){
    download('ai-career-os-'+day+'.json',JSON.stringify(makeBackup(snapshot),null,2),'application/json');
  }
  return <div className="workspace-grid settings-grid">
    <Panel className="span-full"><PanelHeader title="Study capacity" subtitle="Source allocations · review, rest and competency gates stay in the plan"/>
      <div className="capacity-cards">{roadmap.capacity.map(plan=>{
        const name=plan.hours===20?'Sustainable':plan.hours===40?'Intensive':'Standard';
        return <button key={plan.hours} className={'capacity-card '+(plan.hours===data.settings.capacity?'active':'')} aria-pressed={plan.hours===data.settings.capacity} type="button" onClick={()=>{
          update(prev=>({...prev,settings:{...prev.settings,capacity:capacitySchema.parse(plan.hours)}}));notify(name+' capacity selected');
        }}><span>{name}{plan.hours===data.settings.capacity&&<Check size={16}/>}</span><strong>{plan.hours}<small> h/week</small></strong><span>{plan.total.toLocaleString('en')} scheduled hours</span><p>{plan.rules}</p></button>;
      })}</div>
      <div className="allocation-grid">{['Learning','Build','Interview','Career','Review & buffer'].map((label,index)=><div key={label}><strong>{mode.allocations[index]}h</strong><span>{label}</span></div>)}</div>
      <p>{shortHours(remainingPlannedMinutes(data,day))}h remaining in the calendar{mode.exam?' · exam mode active':''}</p>
    </Panel>
    <Panel><PanelHeader title="Preferences"/><Form onSave={form=>{
      const settings=settingsSchema.parse({...data.settings,solid:form.has('solid'),examUntil:field(form,'examUntil'),timezone:field(form,'timezone'),specialization:field(form,'specialization')});
      update(prev=>({...prev,settings}));notify('Preferences saved');
    }}>
      <CheckField name="solid" checked={data.settings.solid}>Use a solid background</CheckField>
      <Field label="Time zone" name="timezone" value={data.settings.timezone} required/>
      <Field label="Specialization" name="specialization" options={['Applied AI','Machine learning','Data science','ML systems']} value={data.settings.specialization}/>
      <Field label="Exam mode through" name="examUntil" type="date" value={data.settings.examUntil}/>
      <p className="muted">Exam mode uses the 20-hour allocation through the selected date.</p>
    </Form></Panel>
    <Panel><PanelHeader title="Backups and exports" subtitle="Your records are saved in this browser’s IndexedDB"/>
      <div className="export-list">
        <button type="button" className="button" onClick={()=>exportBackup()}><FileJson size={16}/> Export JSON backup</button>
        <button type="button" className="button" onClick={()=>upload.current?.click()}><Upload size={16}/> Import JSON backup</button>
        <input ref={upload} type="file" accept=".json,application/json" aria-label="Choose backup file" className="sr-only" tabIndex={-1} onChange={async event=>{
          const file=event.target.files?.[0];
          event.target.value='';
          if(!file)return;
          try { if(file.size>30_000_000)throw new Error('Backup exceeds 30 MB.');setPending(readBackup(JSON.parse(await file.text())));setError(''); }
          catch(err){setError('Could not read this backup. '+(err instanceof Error?err.message:'Choose a valid JSON export.'));}
        }}/>
        <button type="button" className="button" onClick={()=>download('study-sessions-'+day+'.csv',toCSV([['Date','Title','Minutes','Category','Task','Skill','Notes'],...data.sessions.map(s=>[s.date,s.title,s.minutes,s.category,s.taskId,s.skillId,s.notes])]),'text/csv;charset=utf-8')}><Download size={16}/> Export study sessions CSV</button>
        <button type="button" className="button" onClick={()=>download('applications-'+day+'.csv',toCSV([['Company','Role','Location','Eligibility','Submission date','Job URL','Evidence URL','Referral','Compensation','Stage','Follow-up','Notes'],...data.jobs.map(j=>[j.company,j.role,j.location,j.eligibility,j.date,j.job,j.evidence,j.referral,j.compensation,j.stage,j.followup,j.notes])]),'text/csv;charset=utf-8')}><Download size={16}/> Export applications CSV</button>
        <button type="button" className="button danger" onClick={()=>setReset(true)}>Reset personal data</button>
      </div>
      {error&&<p className="error" role="alert">{error}</p>}
      {unmatchedProgress(data).length>0&&<Disclosure title="Records from an earlier roadmap"><p>Your records remain in backups. These task IDs do not appear in the current source.</p><ul>{unmatchedProgress(data).map(id=><li key={id}>{id}</li>)}</ul></Disclosure>}
    </Panel>
    <Panel className="span-full"><PanelHeader title="Original roadmap document" subtitle="All 16 source sections" action={<button type="button" className="button" onClick={()=>download('AI_ML_Career_Roadmap_2027.md',roadmap.markdown,'text/markdown;charset=utf-8')}><CloudDownload size={16}/> Download Markdown</button>}/>
      <div className="source-grid">{roadmap.sections.map(section=><button type="button" className="line-row clickable" key={section.number} onClick={()=>open({kind:'section',id:String(section.number)})}><span>{section.number}. {section.title}</span><BookOpen size={14}/></button>)}</div>
    </Panel>
    {pending&&<DialogFrame center open title="Restore this backup?" onClose={()=>setPending(null)} description={(pending.sourceChanged?'This backup uses a different roadmap revision. Existing backup IDs will be retained. ':'')+'Restoring replaces the current browser’s personal records.'}>
      <div className="form-actions"><button type="button" className="button" onClick={()=>exportBackup()}>Export current records</button><button type="button" className="button primary" onClick={()=>{
        const before=data;replace(pending.data);setPending(null);notify('Backup restored',()=>replace(before));
      }}>Restore backup</button></div>
    </DialogFrame>}
    {reset&&<DialogFrame center open title="Reset personal data?" onClose={()=>setReset(false)} description="This clears sessions, timer, notes, progress and preferences from this browser.">
      <div className="form-actions"><button type="button" className="button" onClick={()=>exportBackup()}>Export a backup</button><button type="button" className="button primary" onClick={()=>{const before=data;replace(emptyProgress());setReset(false);notify('Personal data reset',()=>replace(before));}}>Reset data</button></div>
    </DialogFrame>}
  </div>;
}

