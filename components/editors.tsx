'use client';
import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { roadmap, projectById, taskById } from '@/lib/roadmap';
import { useCareer, upsert } from '@/lib/store';
import { reviewIntervals, shift } from '@/lib/logic';
import { learningCategory, recordStudySession } from '@/lib/learning';
import { learningModes } from '@/lib/learning-schema';
import {
  assessmentSchema, categories, energySchema, eventSchema, gateProgressSchema, interviewSchema,
  jobSchema, journalSchema, levels, marketSchema, projectProgressSchema, reviewSchema, scoreFields,
  sessionSchema, stages, timerSchema, type Progress, type StudySession,
} from '@/lib/progress-schema';
import { CheckField, DialogFrame, Field, Form, field, useApp, type Detail } from './ui';

type Editor = Extract<Detail,{kind:'form'}>;
const labels:Record<Editor['type'],string>={
  session:'Study session', event:'Calendar session', assessment:'Competency assessment',
  interview:'Mock interview',job:'Application',journal:'Journal entry',review:'Spaced review',
  energy:'Energy and focus',market:'Market research note',gate:'Monthly gate assessment',metric:'Evaluation measurement',timer:'Focus timer',
};
export const editorTitle=(state:Editor)=>((state.type==='session'||state.type==='interview'||state.type==='energy')&&!state.id?'Record ':state.id&&!['assessment','gate','metric','energy'].includes(state.type)?'Edit ':'')+labels[state.type];
const read = (form:FormData,keys:string[])=>Object.fromEntries(keys.map(key=>[key,field(form,key)]));
const num = (form:FormData,key:string)=>Number(field(form,key));
function beginTimer(form:FormData, courseId?:string, sectionId?:string){
  const learningMode=courseId?field(form,'learningMode') as StudySession['learningMode']:undefined;
  return timerSchema.parse({...read(form,['title','category','taskId','skillId','notes']),
    ...(courseId?{courseId,sectionId,learningMode,category:learningCategory(learningMode)}:{}),
    startedAt:Date.now(),elapsedMs:0,intervals:[]});
}
const taskOptions=[{value:'',label:'No linked task'},...roadmap.tasks.map(t=>({value:t.id,label:t.title}))];
const skillOptions=[{value:'',label:'No linked skill'},...roadmap.skills.map(s=>({value:s.id,label:s.title}))];
type Collection='sessions'|'events'|'assessments'|'interviews'|'jobs'|'journal'|'reviews'|'market';

export function Editors({state}:{state:Editor}){
  const data=useCareer(s=>s.data);
  const update=useCareer(s=>s.update);
  const {day,close,notify}=useApp();
  const [confirm,setConfirm]=useState(false);
  const when=state.day??day;
  function save(change:(before:Progress)=>Progress,message='Changes saved'){
    update(change);close();notify(message);
  }
  function remove(key:Collection,id:string){
    const old=data[key].find(record=>record.id===id);
    if(!old)return;
    const attached=key==='journal'?data.reviews.filter(review=>review.journalId===id):[];
    update(prev=>({...prev,[key]:prev[key].filter(row=>row.id!==id),reviews:key==='journal'?prev.reviews.filter(review=>review.journalId!==id):key==='reviews'?prev.reviews.filter(review=>review.id!==id):prev.reviews}));
    close();
    notify(labels[state.type]+' deleted',()=>update(prev=>({...prev,[key]:[...prev[key],old],...(key==='journal'?{reviews:[...prev.reviews,...attached]}:{})})));
  }
  function editor(fields:ReactNode,onSave:(form:FormData)=>void,collection?:Collection,recordId?:string,label?:string){
    return <>
      <Form onSave={onSave} label={label} secondary={collection&&recordId&&<button type="button" className="button subtle danger" onClick={()=>setConfirm(true)}><Trash2 size={15}/> Delete</button>}>{fields}</Form>
      {collection&&recordId&&confirm&&<DialogFrame open center title={'Delete '+labels[state.type].toLowerCase()+'?'} onClose={()=>setConfirm(false)} description="You can undo this action immediately after deleting."><div className="form-actions"><button type="button" className="button primary" onClick={()=>remove(collection,recordId)}>Delete record</button><button type="button" className="button" onClick={()=>setConfirm(false)}>Cancel</button></div></DialogFrame>}
    </>;
  }
  if(state.type==='session'){
    const record=data.sessions.find(r=>r.id===state.id);
    const courseId=record?.courseId??state.courseId;
    const sectionId=record?.sectionId??state.sectionId;
    const course=data.learning.courses.find(item=>item.id===courseId);
    const section=course?.sections.find(item=>item.id===sectionId);
    const taskLink=section?.mapping.taskId||course?.mapping.taskId;
    const skillLink=section?.mapping.skillId||course?.mapping.skillId;
    return editor(<>
      <Field label="Session title" name="title" value={record?.title??section?.title??course?.title??taskById.get(state.taskId??'')?.title} required/>
      <div className="form-grid"><Field label="Date" name="date" type="date" value={record?.date??when} required/><Field label="Focused minutes" name="minutes" type="number" value={record?.minutes??60} min={courseId?0:1} max={1440} required/></div>
      {courseId?<div className="form-grid">
        <Field label="Learning activity" name="learningMode" options={learningModes} value={record?.learningMode??'Implementation'}/>
        <Field label="Measured video minutes" name="videoMinutes" type="number" min={0} max={1440} value={record?.videoMinutes??0}/>
        {!record?.intervals?.length&&<Field label="Start time (device time, optional)" name="startTime" type="time"/>}
      </div>:<Field label="Activity" name="category" options={categories} value={record?.category??'Learning'}/>}
      <Field label="Roadmap task" name="taskId" value={record?.taskId??state.taskId??taskLink} options={taskOptions}/><Field label="Skill" name="skillId" options={skillOptions} value={record?.skillId??skillLink}/>
      <Field label="Notes" name="notes" type="textarea" value={record?.notes}/>
    </>,form=>{
      const learningMode=courseId?field(form,'learningMode') as StudySession['learningMode']:undefined;
      const minutes=num(form,'minutes');
      const videoMinutes=courseId?num(form,'videoMinutes'):undefined;
      const startTime=field(form,'startTime');
      const start=startTime?Date.parse(field(form,'date')+'T'+startTime):null;
      const intervalMinutes=Math.max(minutes,videoMinutes??0);
      const intervals=start!==null&&intervalMinutes>0?[{start,end:start+intervalMinutes*60000}]:record?.intervals;
      const item=sessionSchema.parse({...record,id:record?.id??crypto.randomUUID(),...read(form,['title','date','category','taskId','skillId','notes']),
        ...(courseId?{courseId,sectionId,learningMode,videoMinutes,category:learningCategory(learningMode)}:{}),
        minutes,intervals,source:record?.source??'manual',recordedAt:record?.recordedAt??new Date().toISOString()});
      save(prev=>recordStudySession(prev,item,!!record),'Study time saved');
    },'sessions',record?.id,'Save study time');
  }
  if(state.type==='timer'){
    const course=data.learning.courses.find(item=>item.id===state.courseId);
    const section=course?.sections.find(item=>item.id===state.sectionId);
    return editor(<><Field label="What are you studying?" name="title" value={section?.title??course?.title??taskById.get(state.taskId??'')?.title} required/>
      {course?<Field label="Learning activity" name="learningMode" value="Implementation" options={learningModes}/>:<Field label="Activity" name="category" value="Learning" options={categories}/>}
      <Field label="Roadmap task" name="taskId" value={state.taskId??(section?.mapping.taskId||course?.mapping.taskId)} options={taskOptions}/><Field label="Skill" name="skillId" value={section?.mapping.skillId||course?.mapping.skillId} options={skillOptions}/>
      <Field label="Notes" name="notes" type="textarea"/>
    </>,form=>{
      if(data.timer)throw new Error('A focus timer is already active. Open Today to stop or resume it.');
      const timer=beginTimer(form,course?.id,section?.id);
      save(prev=>({...prev,timer}),'Focus timer started');
    },undefined,undefined,'Start timer');
  }
  if(state.type==='event'){
    const record=data.events.find(r=>r.id===state.id);
    const course=data.learning.courses.find(item=>item.id===(record?.courseId??state.courseId));
    const section=course?.sections.find(item=>item.id===(record?.sectionId??state.sectionId));
    return editor(<><Field label="Session title" name="title" value={record?.title??section?.title??course?.title} required/>
      <div className="form-grid"><Field label="Date" name="date" type="date" value={record?.date??when} required/><Field label="Time" name="time" type="time" value={record?.time??'09:00'} required/><Field label="Minutes" name="minutes" type="number" value={record?.minutes??60} min={1} max={720} required/></div>
      <Field label="Activity" name="category" value={record?.category??'Learning'} options={categories}/>
      <Field label="Notes" name="notes" type="textarea" value={record?.notes}/>
    </>,form=>{
      const item=eventSchema.parse({id:record?.id??crypto.randomUUID(),...read(form,['title','date','time','category','notes']),minutes:num(form,'minutes'),courseId:course?.id,sectionId:section?.id});
      save(prev=>({...prev,events:upsert(prev.events,item)}),'Calendar session saved');
    },'events',record?.id);
  }
  if(state.type==='assessment'){
    const record=data.assessments.find(r=>r.id===state.id);
    return editor(<>
      <Field label="Competency domain" name="domain" options={roadmap.competencies.map(c=>({label:c.title,value:c.id}))} value={record?.domain??state.taskId??roadmap.competencies[0].id}/>
      <div className="form-grid"><Field label="Current level" name="level" options={levels} value={record?.level??'Unassessed'}/><Field label="Target level" name="target" options={levels} value={record?.target??'J'}/></div>
      <div className="form-grid"><Field label="Assessment date" name="date" type="date" value={record?.date??when} required/><Field label="Next assessment" name="next" type="date" value={record?.next}/></div>
      <Field label="Evidence" name="evidence" type="textarea" value={record?.evidence}/>
      <Field label="Repository or commit URL" name="link" type="url" value={record?.link}/>
      <Field label="Test results" name="tests" type="textarea" value={record?.tests}/>
      <Field label="Notes" name="notes" type="textarea" value={record?.notes}/>
      <Field label="Areas for improvement" name="improvement" type="textarea" value={record?.improvement}/>
    </>,form=>{
      const item=assessmentSchema.parse({id:record?.id??crypto.randomUUID(),...read(form,['domain','level','target','date','next','evidence','link','tests','notes','improvement'])});
      if(item.level!=='Unassessed'&&!item.evidence.trim()&&!item.link&&!item.tests.trim())throw new Error('Add evidence, a commit link, or test results to record a demonstrated level.');
      save(prev=>({...prev,assessments:upsert(prev.assessments,item)}),'Assessment recorded');
    },'assessments',record?.id);
  }
  if(state.type==='interview'){
    const record=data.interviews.find(r=>r.id===state.id);
    return editor(<><Field label="Prompt or scenario title" name="title" value={record?.title} required/>
      <div className="form-grid"><Field label="Domain" name="area" options={roadmap.interviewAreas.map(a=>a.title)} value={record?.area??roadmap.interviewAreas[0].title}/><Field label="Date" name="date" type="date" value={record?.date??when} required/></div>
      <Field label="Reviewer" name="reviewer" value={record?.reviewer}/>
      <p className="muted">0 absent · 1 heavy help · 2 partial or one hint · 3 correct independently · 4 strong trade-off reasoning</p>
      <div className="form-grid">{scoreFields.map((label,i)=><Field key={label} label={label} name={label} type="number" min={0} max={4} value={record?.scores[i]??0} required/>)}</div>
      <Field label="Notes and areas to practice" name="notes" type="textarea" value={record?.notes}/>
    </>,form=>{
      const item=interviewSchema.parse({id:record?.id??crypto.randomUUID(),...read(form,['title','area','date','reviewer','notes']),scores:scoreFields.map(key=>num(form,key))});
      save(prev=>({...prev,interviews:upsert(prev.interviews,item)}),'Mock interview recorded');
    },'interviews',record?.id);
  }
  if(state.type==='job'){
    const record=data.jobs.find(r=>r.id===state.id);
    return editor(<>
      <div className="form-grid"><Field label="Company" name="company" value={record?.company} required/><Field label="Role" name="role" value={record?.role} required/></div>
      <div className="form-grid"><Field label="Location" name="location" value={record?.location}/><Field label="Eligibility" name="eligibility" value={record?.eligibility}/></div>
      <Field label="Stage" name="stage" options={stages} value={record?.stage??'Saved'}/>
      <CheckField name="wellMatched" checked={record?.wellMatched}>Role fits my skills and eligibility</CheckField>
      <div className="form-grid"><Field label="Submission date" name="date" type="date" value={record?.date}/><Field label="Next follow-up" name="followup" type="date" value={record?.followup}/></div>
      <Field label="Job listing URL" name="job" type="url" value={record?.job}/><Field label="Evidence URL" name="evidence" type="url" value={record?.evidence}/>
      <div className="form-grid"><Field label="Referral" name="referral" value={record?.referral}/><Field label="Disclosed compensation" name="compensation" value={record?.compensation}/></div>
      <Field label="Notes" name="notes" type="textarea" value={record?.notes}/>
    </>,form=>{
      const item=jobSchema.parse({id:record?.id??crypto.randomUUID(),...read(form,['company','role','location','eligibility','stage','date','followup','job','evidence','referral','compensation','notes']),wellMatched:form.has('wellMatched'),stageHistory:[...new Set([...(record?.stageHistory??(record?[record.stage]:[])),field(form,'stage')])]});
      save(prev=>({...prev,jobs:upsert(prev.jobs,item)}),'Application saved');
    },'jobs',record?.id);
  }
  if(state.type==='journal'){
    const record=data.journal.find(r=>r.id===state.id);
    const steps=[['attempt','Independent attempt'],['problem','Problem or blocker'],['hypothesis','Hypothesis'],['hint','Smallest hint received'],['solution','Solution'],['verification','Verification'],['lessons','Lessons learned'],['next','Next actions']] as const;
    return editor(<><Field label="Entry title" name="title" value={record?.title} required/>
      <div className="form-grid"><Field label="Entry type" name="kind" options={['Learning','Reflection','No-AI challenge']} value={record?.kind??'Learning'}/><Field label="Date" name="date" type="date" value={record?.date??when} required/></div>
      <Field label="Roadmap task" name="taskId" options={taskOptions} value={record?.taskId??state.taskId}/>
      {steps.map(([key,label])=><Field key={key} name={key} label={label} value={record?.[key]} type="textarea"/>)}
      <CheckField name="usedAI" checked={record?.usedAI}>Used AI assistance</CheckField><CheckField name="independent" checked={record?.independent}>Reproduced independently</CheckField>
      {!record&&<CheckField name="review">Schedule reviews at 1, 3, 7, 14 and 30 days</CheckField>}
    </>,form=>{
      const item=journalSchema.parse({id:record?.id??crypto.randomUUID(),...read(form,['title','kind','date','taskId',...steps.map(([key])=>key)]),usedAI:form.has('usedAI'),independent:form.has('independent')});
      const queue=form.has('review')?reviewIntervals.map(interval=>reviewSchema.parse({id:item.id+'-'+interval,journalId:item.id,title:item.title,interval,date:shift(item.date,interval),status:'Scheduled',rating:'',notes:''})):[];
      save(prev=>({...prev,journal:upsert(prev.journal,item),reviews:[...prev.reviews,...queue]}),'Journal entry saved');
    },'journal',record?.id);
  }
  if(state.type==='review'){
    const record=data.reviews.find(r=>r.id===state.id);
    return editor(<><Field label="Review topic" name="title" value={record?.title} required/>
      <div className="form-grid"><Field label="Review date" name="date" type="date" value={record?.date??when} required/><Field label="Status" name="status" options={['Scheduled','Done']} value={record?.status??'Scheduled'}/></div>
      <Field label="Self-assessment" name="rating" options={[{value:'',label:'Unassessed'},'Again','Hard','Good','Easy']} value={record?.rating}/>
      <Field label="Retrieval notes" name="notes" type="textarea" value={record?.notes}/>
    </>,form=>{
      const item=reviewSchema.parse({id:record?.id??crypto.randomUUID(),interval:record?.interval??0,journalId:record?.journalId??'',...read(form,['title','date','status','rating','notes'])});
      save(prev=>({...prev,reviews:upsert(prev.reviews,item)}),'Review saved');
    },'reviews',record?.id);
  }
  if(state.type==='energy'){
    const record=data.energy[when];
    return editor(<><div className="form-grid"><Field label="Date" name="date" type="date" value={when} required/><Field label="Energy (1–5)" name="energy" type="number" value={record?.energy??3} min={1} max={5} required/><Field label="Focus (1–5)" name="focus" type="number" value={record?.focus??3} min={1} max={5} required/></div><Field label="Notes" name="notes" type="textarea" value={record?.notes}/></>,form=>{
      const item=energySchema.parse({energy:num(form,'energy'),focus:num(form,'focus'),notes:field(form,'notes')});
      save(prev=>({...prev,energy:{...prev.energy,[field(form,'date')]:item}}),'Energy and focus recorded');
    });
  }
  if(state.type==='market'){
    const record=data.market.find(r=>r.id===state.id);
    return editor(<><Field label="Title" name="title" value={record?.title} required/><Field label="Research date" name="date" type="date" value={record?.date??when} required/>
      <Field label="Source URL" name="link" type="url" value={record?.link}/><Field label="Observations" name="notes" type="textarea" value={record?.notes} required/>
    </>,form=>{
      const item=marketSchema.parse({id:record?.id??crypto.randomUUID(),...read(form,['title','date','link','notes'])});
      save(prev=>({...prev,market:upsert(prev.market,item)}),'Market research saved');
    },'market',record?.id);
  }
  if(state.type==='gate'){
    const gate=roadmap.gates.find(g=>g.id===state.id);
    if(!gate)return null;
    const mark=data.gates[gate.id];
    return editor(<><div className="callout"><strong>{gate.target}</strong><p>{gate.criteria}</p><p>{gate.evidenceAndCorrection}</p></div>
      <div className="form-grid"><Field label="Gate outcome" name="status" options={['Pending','Passed','Failed']} value={mark?.status??'Pending'}/><Field label="Assessment date" name="date" type="date" value={mark?.date??when} required/></div>
      <Field label="Evidence" name="evidence" type="textarea" value={mark?.evidence}/>
      <Field label="Corrective action" name="correction" type="textarea" value={mark?.correction??gate.evidenceAndCorrection.split('If ')[1]?.replace(/^[^,]+, /,'')}/>
    </>,form=>{
      const item=gateProgressSchema.parse({...read(form,['status','date','evidence','correction']),previousFailures:(mark?.previousFailures??0)+(mark?.status==='Failed'?1:0)});
      if(item.status==='Passed'&&!item.evidence.trim())throw new Error('Record the evidence that demonstrates the gate criteria.');
      if(item.status==='Failed'&&!item.correction.trim())throw new Error('Record a corrective action for this gate.');
      save(prev=>({...prev,gates:{...prev.gates,[gate.id]:item}}),'Gate outcome recorded');
    });
  }
  const project=projectById.get(state.projectId??'');
  const metric=project?.metrics.find(m=>m.id===state.id);
  if(!project||!metric)return null;
  const record=data.projects[project.id]?.metrics[metric.id];
  return editor(<><div className="callout"><strong>{metric.title}</strong><p>Record the result with the workload, evaluation split, or benchmark context.</p></div>
    <div className="form-grid"><Field label="Measured value" name="value" value={record?.value} required/><Field label="Unit" name="unit" value={record?.unit??(metric.unit==='ms'?'ms':'')}/><Field label="Measurement date" name="date" type="date" value={record?.date??when} required/></div>
    <Field label="Evaluation context" name="context" type="textarea" value={record?.context}/>
  </>,form=>{
    save(prev=>{
      const current=prev.projects[project.id]??{status:'Planned',repo:'',demo:'',notes:'',milestones:[],metrics:{}};
      const next=projectProgressSchema.parse({...current,metrics:{...current.metrics,[metric.id]:read(form,['value','unit','date','context'])}});
      return {...prev,projects:{...prev.projects,[project.id]:next}};
    },'Measurement saved');
  });
}

