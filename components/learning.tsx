'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { BookOpen, Bookmark, ExternalLink } from 'lucide-react';
import { courseLink, courseProgress, courseStats, integrationEvent, matchingCourse, nextLearning, relatedCourseMilestone, sourceNames, trackedUpdate, upsertCourse, makeCourse, applyCourseCounts, normalizeMapping } from '@/lib/learning';
import { blankMapping, canonicalCourseUrl, courseThumbnail, enrollmentStates, learnerMappingSchema, sectionScopes, type CourseRoadmapMapping, type ExternalCourse, type LearningEntry } from '@/lib/learning-schema';
import { applyCourseImport, FileImportProvider, ManualCourseProvider, parseLearningFile, UdemyBusinessProvider } from '@/lib/learning-providers';
import { dateLabel, shortHours } from '@/lib/logic';
import { roadmap, skillById, taskById } from '@/lib/roadmap';
import { useCareer } from '@/lib/store';
import { Add, CheckField, DialogFrame, Disclosure, Empty, Field, Form, OpenLink, Panel, PanelHeader, Ring, Status, field, useApp } from './ui';
import { LearningAnalytics } from './learning-analytics';

const modeChoices=['All courses','Active','Completed','Bookmarked'] as const;
const options=(items:{id:string;title:string}[],empty:string)=>[{value:'',label:empty},...items.map(item=>({value:item.id,label:item.title}))];
const updateLabel=(at:string)=>dateLabel(at.slice(0,10),'d MMM yyyy')+' · '+at.slice(11,16)+' UTC';
const now=()=>new Date().toISOString();
const integer=(form:FormData,key:string)=>field(form,key)===''?undefined:Number(field(form,key));
const formatTime=(minutes:number)=>shortHours(minutes)+'h';
const handleError=(error:unknown)=>error instanceof Error?error.message:'Try again.';
function Thumbnail({course}:{course:ExternalCourse}){
  const [failed,setFailed]=useState(false);
  let src='';
  try { src=courseThumbnail(course.thumbnail); } catch {}
  return <div className="course-image">{src&&!failed?
    // The instructor-supplied Udemy image is loaded directly from its permitted CDN.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:
    <BookOpen size={24} aria-hidden="true"/>}</div>;
}
function ContinueCourse({course}:{course:ExternalCourse}){
  return course.url?<a className="button primary" href={course.url} target="_blank" rel="noopener noreferrer">Continue learning <ExternalLink size={14}/></a>:null;
}

export function MappingFields({mapping}:{mapping:CourseRoadmapMapping}){
  return <div className="form-grid learning-mapping">
    <Field label="Roadmap month" name="monthId" value={mapping.monthId} options={options(roadmap.months.map(month=>({id:month.id,title:month.label})),'No month')}/>
    <Field label="Roadmap week" name="weekId" value={mapping.weekId} options={options(roadmap.months.flatMap(month=>month.weeks.map(week=>({id:week.id,title:month.label+' · Week '+week.number}))),'No week')}/>
    <Field label="Learning task" name="taskId" value={mapping.taskId} options={options(roadmap.tasks,'No task')}/>
    <Field label="Roadmap skill" name="skillId" value={mapping.skillId} options={options(roadmap.skills,'No skill')}/>
    <Field label="Skill priority" name="priority" value={mapping.priority} options={[{value:'',label:'Use skill priority'},'P0','P1','P2','P3']}/>
    <Field label="Related project" name="projectId" value={mapping.projectId} options={options(roadmap.projects.map(project=>({id:project.id,title:project.name})),'No project')}/>
    <Field label="Interview topic" name="interviewTopic" value={mapping.interviewTopic} options={[{value:'',label:'No topic'},...roadmap.interviewAreas.map(area=>area.title)]}/>
  </div>;
}
function parseMapping(form:FormData){
  return normalizeMapping(learnerMappingSchema.parse(Object.fromEntries(Object.keys(blankMapping).map(key=>[key,field(form,key)]))));
}
function MappingSummary({mapping}:{mapping:CourseRoadmapMapping}){
  const {open}=useApp();
  const month=roadmap.months.find(m=>m.id===mapping.monthId);
  const task=taskById.get(mapping.taskId);
  const skill=skillById.get(mapping.skillId);
  const project=roadmap.projects.find(p=>p.id===mapping.projectId);
  const week=month?.weeks.find(w=>w.id===mapping.weekId);
  return <div className="button-row">
    {month&&<Link className="chip" href="/roadmap/">{month.label}{week?' · Week '+week.number:''}</Link>}
    {task&&<button type="button" className="chip" onClick={()=>open({kind:'task',id:task.id})}>{task.title}</button>}
    {skill&&<button type="button" className="chip" onClick={()=>open({kind:'skill',id:skill.id})}>{skill.title}{mapping.priority?' · '+mapping.priority:''}</button>}
    {!skill&&mapping.priority&&<span className="chip">{mapping.priority}</span>}
    {project&&<Link className="chip" href={'/projects/'+project.id+'/'}>{project.name}</Link>}
    {mapping.interviewTopic&&<span className="chip">{mapping.interviewTopic}</span>}
  </div>;
}

export function CourseEditor({id,progressOnly=false}:{id?:string;progressOnly?:boolean}){
  const courses=useCareer(s=>s.data.learning.courses);
  const update=useCareer(s=>s.update);
  const {day,close,notify}=useApp();
  const course=courses.find(item=>item.id===id);
  const progress=course&&courseProgress(course);
  if(id&&!course)return <Empty>This course could not be found.</Empty>;
  return <Form label={progressOnly?'Save progress':course?'Save course':'Add course'} onSave={form=>{
    const at=now();
    if(progressOnly&&course){
      const [entry]=ManualCourseProvider.parse({
        title:course.title,url:course.url,completedLectures:integer(form,'completedLectures'),
        totalLectures:integer(form,'totalLectures'),percent:integer(form,'percent'),
      });
      update(data=>upsertCourse(data,applyCourseCounts(course,entry,'manual',at)));
      close();notify('Course progress saved');
      return;
    }
    const [entry]=ManualCourseProvider.parse({
      title:field(form,'title'),url:field(form,'url'),instructor:field(form,'instructor'),
      durationMinutes:integer(form,'durationMinutes'),thumbnail:field(form,'thumbnail'),certificateUrl:field(form,'certificateUrl'),
    });
    const duplicate=matchingCourse(courses.filter(item=>item.id!==course?.id),entry,'manual');
    if(duplicate)throw new Error('This course is already in My Learning.');
    const base=course??makeCourse(entry,'manual',at,day);
    const status=field(form,'status') as ExternalCourse['enrollment']['status'];
    const updated=trackedUpdate(base,{
      title:entry.title,url:canonicalCourseUrl(entry.url),instructor:entry.instructor,thumbnail:courseThumbnail(entry.thumbnail),
      durationMinutes:entry.durationMinutes,notes:field(form,'notes'),practice:field(form,'practice'),
      enrollment:{...base.enrollment,status,bookmarked:form.has('bookmarked'),targetDate:field(form,'targetDate'),
        completedAt:status==='Completed'?base.enrollment.completedAt??at:null},
      certificate:{url:entry.certificateUrl,earnedOn:field(form,'earnedOn')},
    },base.progressSource,at);
    update(data=>upsertCourse(data,updated));
    close();notify(course?'Course updated':'Course added to My Learning');
  }}>
    {progressOnly?<><p>Use the total and completed lecture counts you can see in Udemy. Include any lectures already checked in this dashboard.</p>
      <div className="form-grid">
        <Field name="completedLectures" label="Completed lectures" type="number" min={0} max={10000} value={progress?.completed??0}/>
        <Field name="totalLectures" label="Total lectures" type="number" min={0} max={10000} value={course?.declaredLectures||progress?.total||''}/>
        <Field name="percent" label="Percent complete (when lecture total is unknown)" type="number" min={0} max={100} value={!progress?.total?Math.floor(progress?.percent??0):''}/>
      </div></>:<>
      <Field name="title" label="Course title" required value={course?.title}/>
      <div className="form-grid">
        <Field name="url" label="Udemy course URL" type="url" value={course?.url}/>
        <Field name="instructor" label="Instructor" value={course?.instructor}/>
        <Field name="durationMinutes" label="Course duration in minutes" type="number" min={0} value={course?.durationMinutes}/>
        <Field name="thumbnail" label="Udemy thumbnail URL" type="url" value={course?.thumbnail}/>
        <Field name="status" label="Enrollment status" options={enrollmentStates} value={course?.enrollment.status??'Enrolled'}/>
        <Field name="targetDate" label="Target completion date" type="date" value={course?.enrollment.targetDate}/>
      </div>
      <CheckField name="bookmarked" checked={course?.enrollment.bookmarked}>Bookmark course</CheckField>
      <Field name="notes" label="Personal notes" type="textarea" value={course?.notes}/>
      <Field name="practice" label="Practice exercises" type="textarea" value={course?.practice}/>
      <div className="form-grid">
        <Field name="certificateUrl" label="Certificate URL" type="url" value={course?.certificate.url}/>
        <Field name="earnedOn" label="Certificate earned on" type="date" value={course?.certificate.earnedOn}/>
      </div>
      {!course&&<p className="muted">Add the title and course URL. My Learning will suggest a roadmap mapping from the title.</p>}
    </>}
  </Form>;
}

export function LearningHub(){
  const data=useCareer(s=>s.data);
  const update=useCareer(s=>s.update);
  const {open,notify,day}=useApp();
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<typeof modeChoices[number]>('All courses');
  const [sort,setSort]=useState('Last updated');
  const [tab,setTab]=useState('Courses');
  const [pending,setPending]=useState<{entries:LearningEntry[];source:'file'|'business'}|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const input=useRef<HTMLInputElement>(null);
  const recommendation=nextLearning(data,day);
  const list=data.learning.courses.filter(course=>
    (filter==='All courses'||(filter==='Bookmarked'?course.enrollment.bookmarked:course.enrollment.status===filter))&&
    [course.title,course.instructor,skillById.get(course.mapping.skillId)?.title??''].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a,b)=>sort==='Title'?a.title.localeCompare(b.title):sort==='Completion'?(courseProgress(b).percent??-1)-(courseProgress(a).percent??-1):b.updatedAt.localeCompare(a.updatedAt));
  async function business(action:'test'|'pull'){
    setBusy(true);setMessage('');
    try {
      const response=await fetch('/api/learning/business',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,consent:data.learning.integration.businessConsent}),
      });
      if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('The Business adapter is available through npm start.');
      const body=await response.json();
      if(!response.ok)throw new Error(body.error??'Udemy Business could not connect.');
      setMessage(action==='test'?'Connected to the authorized reporting endpoint.':body.partial?'Preview has a bounded subset of the available records.':'Business snapshot ready for review.');
      if(action==='pull')setPending({source:'business',entries:UdemyBusinessProvider.parse(body)});
      else update(data=>integrationEvent(data,{at:now(),source:'business',phase:'Connected',message:'Authorized reporting connection tested'}));
    }catch(error){
      setMessage(handleError(error));
      update(data=>integrationEvent(data,{at:now(),source:'business',phase:'Error',message:handleError(error).slice(0,1000)}));
    }
    finally {setBusy(false);}
  }
  return <>
    <div className="workspace-toolbar"><div className="segmented">{['Courses','Analytics','Integrations'].map(value=>
      <button key={value} type="button" onClick={()=>setTab(value)} aria-pressed={tab===value}>{value}</button>)}</div>
      <div className="button-row"><button type="button" className="button" onClick={()=>input.current?.click()}>Import courses</button><Add label="Add Udemy course" onClick={()=>open({kind:'course-edit'})}/></div>
    </div>
    <input ref={input} type="file" accept=".csv,.json,text/csv,application/json" aria-label="Choose a course file" className="sr-only" tabIndex={-1} onChange={async event=>{
      const file=event.target.files?.[0];event.target.value='';if(!file)return;
      try {if(file.size>5_000_000)throw new Error('Choose a file under 5 MB.');setPending({source:'file',entries:parseLearningFile(file.name,await file.text())});setMessage('');}
      catch(error){setMessage(handleError(error));}
    }}/>
    {message&&<p className="callout" role="status">{message}</p>}
    {tab==='Analytics'&&<LearningAnalytics data={data} day={day}/>}
    {tab==='Integrations'&&<div className="workspace-grid">
      <Panel><PanelHeader title="Chrome companion" subtitle="Course URLs, progress you enter, and timed study sessions"/>
        <label className="check-field"><input type="checkbox" checked={data.learning.integration.companion} onChange={event=>{
          const companion=event.target.checked;
          update(prev=>({...prev,learning:{...prev.learning,integration:{...prev.learning.integration,companion}}}));
        }}/> Allow the companion on this local dashboard</label>
        <p>Use the extension’s connection test, then review its queue before sending sessions.</p>
      </Panel>
      <Panel><PanelHeader title="Udemy Business" subtitle="Authorized reporting snapshots"/>
        <label className="check-field"><input type="checkbox" checked={data.learning.integration.businessConsent} onChange={event=>{
          const businessConsent=event.target.checked;
          update(prev=>({...prev,learning:{...prev.learning,integration:{...prev.learning.integration,businessConsent}}}));
        }}/> Allow requests for the configured Business learner</label>
        <p>Configure Business credentials on the local server and launch with npm start. Imported snapshots display their source and retrieval time.</p>
        <div className="button-row"><button type="button" className="button" disabled={busy||!data.learning.integration.businessConsent} onClick={()=>void business('test')}>Test Business connection</button>
        <button type="button" className="button" disabled={busy||!data.learning.integration.businessConsent} onClick={()=>void business('pull')}>Review Business snapshot</button></div>
      </Panel>
      <Panel className="span-full"><PanelHeader title="Sync history"/>
        {data.learning.sync.length?<div className="list-stack">{data.learning.sync.slice(-15).reverse().map(event=>
          <div key={event.id} className="line-row"><div><strong>{event.message}</strong><p>{sourceNames[event.source]} · {updateLabel(event.at)}</p></div><Status>{event.phase}</Status></div>)}</div>:<Empty>Imported and companion records will appear here.</Empty>}
      </Panel>
    </div>}
    {tab==='Courses'&&<>
      {recommendation&&<Panel dark className="course-recommendation"><PanelHeader title="Recommended next" subtitle={recommendation.reasons.join(' · ')}/>
        <strong>{recommendation.course.title}</strong>
        <p>{recommendation.next?.lecture.title??'Review the planned topic, then implement or test it independently.'}</p>
        <div className="button-row"><Link className="button" href={courseLink(recommendation.course.id)}>Open course</Link>
        {recommendation.hasCapacity&&<button className="button" type="button" onClick={()=>open({kind:'form',type:'event',courseId:recommendation.course.id,sectionId:recommendation.next?.section.id})}>Schedule practice</button>}</div>
      </Panel>}
      <div className="workspace-toolbar course-filters">
        <input type="search" aria-label="Search courses" placeholder="Search courses, instructors or skills" value={query} onChange={event=>setQuery(event.target.value)}/>
        <div className="segmented">{modeChoices.map(value=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value}</button>)}</div>
        <label className="inline">Sort <select aria-label="Sort courses" value={sort} onChange={event=>setSort(event.target.value)}>{['Last updated','Title','Completion'].map(value=><option key={value}>{value}</option>)}</select></label>
      </div>
      {list.length?<div className="course-grid">{list.map(course=>{
        const stats=courseStats(data,course,day);
        return <Panel key={course.id} className="course-card">
          <div className="course-card-head"><Thumbnail key={course.thumbnail} course={course}/><div><Link href={courseLink(course.id)}><h2>{course.title}</h2></Link><p>{course.instructor||'Instructor unspecified'}</p></div></div>
          <div className="course-card-meta"><Status>{course.enrollment.status}</Status><button className="icon-btn" type="button" title="Bookmark course" aria-label="Bookmark course" aria-pressed={course.enrollment.bookmarked} onClick={()=>update(prev=>upsertCourse(prev,{...course,updatedAt:now(),enrollment:{...course.enrollment,bookmarked:!course.enrollment.bookmarked}}))}><Bookmark size={15} fill={course.enrollment.bookmarked?'currentColor':'none'}/></button></div>
          <dl className="course-metrics"><div><dt>Completion</dt><dd>{stats.percent===null?'—':stats.percent+'%'}</dd></div><div><dt>Lectures remaining</dt><dd>{stats.remaining??'—'}</dd></div><div><dt>Focused study</dt><dd>{formatTime(stats.focusedMinutes)}</dd></div></dl>
          <p className="muted">{stats.completed} completed · {course.durationMinutes?formatTime(course.durationMinutes)+' course duration':'Duration unknown'}</p>
          <p className="muted">Last activity {stats.lastActivity?dateLabel(stats.lastActivity.slice(0,10),'d MMM yyyy'):'—'}</p>
          <p className="muted">{sourceNames[course.progressSource]} · {updateLabel(course.snapshots.at(-1)?.at??course.updatedAt)}</p>
          <p className="muted">Course updated {updateLabel(course.updatedAt)}</p>
          <div className="button-row"><Link className="button" href={courseLink(course.id)}>Course details</Link><ContinueCourse course={course}/>{course.certificate.url&&<OpenLink href={course.certificate.url}>Certificate</OpenLink>}</div>
        </Panel>;
      })}</div>:<Panel><PanelHeader title={data.learning.courses.length?'No courses match':'Your Udemy courses'}/><Empty>{data.learning.courses.length?'Change the search or filter.':'Add a course or import a list to track lectures, study time, and roadmap skills.'}</Empty></Panel>}
    </>}
    {pending&&<DialogFrame open center title="Review course import" onClose={()=>setPending(null)}>
      <p>{pending.entries.length} courses from {pending.source==='file'?'a local file':'Udemy Business reporting'}. Existing local records keep their notes, mappings and manual progress.</p>
      <ul className="learning-import-preview">{pending.entries.slice(0,40).map((entry,index)=><li key={index}>{entry.title}</li>)}</ul>
      <Form label="Import reviewed courses" onSave={form=>{
        const provider=pending.source==='business'?UdemyBusinessProvider:FileImportProvider;
        const result=applyCourseImport(data,pending.entries,provider,now(),day,form.has('refresh'));
        update(()=>result.data);setPending(null);
        notify(result.added+' courses added, '+result.refreshed+' updated, '+result.skipped+' skipped');
      }}>
        {pending.source==='business'&&<CheckField name="refresh">Refresh progress on existing Business-synced courses</CheckField>}
      </Form>
    </DialogFrame>}
  </>;
}

function CourseDetail(){
  const params=useSearchParams();
  const data=useCareer(s=>s.data);
  const update=useCareer(s=>s.update);
  const {open,day,notify}=useApp();
  const course=data.learning.courses.find(item=>item.id===params.get('id'));
  if(!course)return <Panel><Empty>Choose a course from My Learning.</Empty><Link className="button" href="/learning/">My Learning</Link></Panel>;
  const stats=courseStats(data,course,day);
  const milestone=relatedCourseMilestone(course.mapping,day);
  function save(changes:Partial<ExternalCourse>,message:string){
    const result=trackedUpdate(course!,changes,'manual',now());
    update(prev=>upsertCourse(prev,result));notify(message);
  }
  return <>
    <div className="workspace-toolbar"><Link className="button" href="/learning/">My Learning</Link><div className="button-row">
      <button type="button" className="button" onClick={()=>open({kind:'course-edit',id:course.id})}>Edit course</button>
      <button type="button" className="button" onClick={()=>open({kind:'course-edit',id:course.id,progressOnly:true})}>Update progress</button>
      <ContinueCourse course={course}/>
    </div></div>
    <div className="workspace-grid">
      <Panel className="span-full">
        <div className="course-detail-head"><Thumbnail key={course.thumbnail} course={course}/><div><h2>{course.title}</h2><p>{course.instructor||'Instructor unspecified'} · {course.enrollment.status}</p>
          <p>{sourceNames[course.progressSource]} · {updateLabel(course.snapshots.at(-1)?.at??course.updatedAt)}</p></div>
          {stats.percent===null?<span className="chip">Progress unknown</span>:<div className="course-ring"><Ring value={stats.percent} label="Course completion"/></div>}
        </div>
        <dl className="course-metrics"><div><dt>Completed lectures</dt><dd>{stats.completed}{stats.total?' / '+stats.total:''}</dd></div>
          <div><dt>Recorded focus</dt><dd>{formatTime(stats.focusedMinutes)}</dd></div><div><dt>Recorded video</dt><dd>{formatTime(stats.videoMinutes)}</dd></div></dl>
        {course.providerVideoMinutes!==undefined&&<p>Business report · {formatTime(course.providerVideoMinutes)} total video consumed</p>}
        <p>{course.enrollment.completedAt?'Completed '+dateLabel(course.enrollment.completedAt.slice(0,10),'d MMM yyyy')
          :stats.finish?'Estimated completion '+dateLabel(stats.finish,'d MMM yyyy'):'A completion estimate uses lecture progress recorded on different days.'}
          {course.enrollment.targetDate?' · Target '+dateLabel(course.enrollment.targetDate,'d MMM yyyy'):''}</p>
        <div className="button-row">
          <Add label="Log course study" onClick={()=>open({kind:'form',type:'session',courseId:course.id})}/>
          {data.timer?<Link href="/today/" className="button">Open focus timer</Link>:<button type="button" className="button" onClick={()=>open({kind:'form',type:'timer',courseId:course.id})}>Start focus timer</button>}
          <button type="button" className="button" onClick={()=>open({kind:'form',type:'event',courseId:course.id})}>Schedule course study</button>
        </div>
      </Panel>
      <Panel><PanelHeader title="Roadmap mapping"/>
        <MappingSummary mapping={course.mapping}/>
        {milestone&&<button type="button" className="button" onClick={()=>open({kind:'milestone',id:milestone.id})}>{milestone.title}</button>}
        <Disclosure title="Edit course mapping">
          <p className="muted">A selected task supplies its roadmap week and month.</p>
          <Form label="Save course mapping" onSave={form=>save({mapping:parseMapping(form)},'Course mapping saved')}><MappingFields key={JSON.stringify(course.mapping)} mapping={course.mapping}/></Form>
        </Disclosure>
      </Panel>
      <Panel><PanelHeader title="Notes, practice and certificate"/>
        <div className="course-notes"><p>{course.notes||'Add notes as you learn.'}</p><p>{course.practice||'Add an independent implementation or assessment exercise.'}</p></div>
        {course.certificate.url&&<OpenLink href={course.certificate.url}>Open certificate</OpenLink>}
        {course.certificate.earnedOn&&<p>Earned {dateLabel(course.certificate.earnedOn,'d MMM yyyy')}</p>}
      </Panel>
      <Panel className="span-full"><PanelHeader title="Curriculum" subtitle="Add your own lecture checklist"/>
        <label className="check-field"><input type="checkbox" checked={!!course.curriculumComplete}
          onChange={event=>save({curriculumComplete:event.target.checked},'Curriculum coverage updated')}/> Checklist covers the full course</label>
        {course.sections.map(section=>{
          const saveSection=(patch:Partial<typeof section>,message:string)=>save({sections:course.sections.map(item=>item.id===section.id?{...item,...patch}:item)},message);
          return <Disclosure key={section.id} title={section.title} sub={<Status>{section.scope}</Status>}>
            {section.lectures.length>0&&<div className="list-stack">{section.lectures.map(lecture=>
              <label key={lecture.id} className="check-field"><input type="checkbox" checked={!!lecture.completedAt} onChange={event=>saveSection({lectures:section.lectures.map(item=>item.id===lecture.id?{...item,completedAt:event.target.checked?now():null}:item)},'Lecture progress saved')}/>
                {lecture.title}{lecture.minutes?' · '+lecture.minutes+' min':''}</label>)}</div>}
            <Form label="Add lecture" onSave={form=>{
              saveSection({lectures:[...section.lectures,{id:crypto.randomUUID(),title:field(form,'lecture'),minutes:integer(form,'duration')??0,completedAt:null}]},'Lecture added');
            }}><div className="form-grid"><Field name="lecture" label="Lecture title" required/><Field name="duration" label="Lecture minutes" type="number" min={0}/></div></Form>
            <MappingSummary mapping={section.mapping}/>
            <div className="button-row"><button type="button" className="button" onClick={()=>open({kind:'form',type:'session',courseId:course.id,sectionId:section.id})}>Log section study</button>
              <button type="button" className="button" onClick={()=>open({kind:'form',type:'event',courseId:course.id,sectionId:section.id})}>Schedule section</button></div>
            <Disclosure title="Section scope and mapping">
              <Form label="Save section" onSave={form=>saveSection({
                title:field(form,'title'),scope:field(form,'scope') as typeof section.scope,notes:field(form,'notes'),practice:field(form,'practice'),mapping:parseMapping(form),
              },'Section saved')}>
                <div className="form-grid"><Field name="title" label="Section title" value={section.title} required/><Field name="scope" label="Section scope" options={sectionScopes} value={section.scope}/></div>
                <Field name="notes" label="Section notes" type="textarea" value={section.notes}/><Field name="practice" label="Section practice" type="textarea" value={section.practice}/>
                <MappingFields key={JSON.stringify(section.mapping)} mapping={section.mapping}/>
              </Form>
            </Disclosure>
          </Disclosure>;
        })}
        <Disclosure title="Add curriculum section">
          <Form label="Add section" onSave={form=>save({sections:[...course.sections,{
            id:crypto.randomUUID(),title:field(form,'title'),scope:field(form,'scope') as typeof sectionScopes[number],notes:'',practice:'',mapping:{...blankMapping},lectures:[],
          }]},'Section added')}>
            <div className="form-grid"><Field name="title" label="New section title" required/><Field name="scope" label="New section scope" options={sectionScopes} value="Required"/></div>
          </Form>
        </Disclosure>
      </Panel>
      <Panel className="span-full"><PanelHeader title="Course study history"/>
        {stats.sessions.length?<div className="list-stack">{[...stats.sessions].reverse().map(session=><button type="button" key={session.id} className="line-row clickable" onClick={()=>open({kind:'form',type:'session',id:session.id})}>
          <div><strong>{session.title}</strong><p>{dateLabel(session.date,'d MMM yyyy')} · {session.learningMode??session.category}</p></div>
          <span>{session.minutes} min focused{session.videoMinutes?' · '+session.videoMinutes+' min video':''}</span>
        </button>)}</div>:<Empty>Log a study block to start your history.</Empty>}
      </Panel>
    </div>
  </>;
}
export function LearningDetail(){return <Suspense fallback={<Panel>Opening course…</Panel>}><CourseDetail/></Suspense>;}

