'use client';
import Link from 'next/link';
import { usePathname,useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Component,useCallback,useEffect,useMemo,useState,type ReactNode } from 'react';
import { Activity, BookMarked, BookOpen, BriefcaseBusiness, CalendarDays, Check, ChevronRight, CirclePlus, Command, Focus, GitFork, Layers3, LayoutGrid, ListChecks, Search, Settings2, X } from 'lucide-react';
import { projectById, roadmap } from '@/lib/roadmap';
import { courseLink } from '@/lib/learning';
import { useCareer,useStorageFlags } from '@/lib/store';
import { dateLabel, todayKey } from '@/lib/logic';
import { Overview } from './overview';
import { LearningBridge } from './learning-bridge';
import { AppContext, DialogFrame, Empty, type Detail } from './ui';

const loading=()=> <div className="panel workspace-loading" aria-live="polite">Opening workspace…</div>;
const Today=dynamic(()=>import('./study').then(m=>m.Today),{loading});
const Roadmap=dynamic(()=>import('./study').then(m=>m.RoadmapPage),{loading});
const Skills=dynamic(()=>import('./skills').then(m=>m.Skills),{loading,ssr:false});
const Projects=dynamic(()=>import('./projects').then(m=>m.Projects),{loading});
const Project=dynamic(()=>import('./projects').then(m=>m.ProjectDetails),{loading});
const Analytics=dynamic(()=>import('./analytics').then(m=>m.Analytics),{loading});
const Interviews=dynamic(()=>import('./career').then(m=>m.Interviews),{loading});
const Career=dynamic(()=>import('./career').then(m=>m.Career),{loading});
const Resources=dynamic(()=>import('./library').then(m=>m.Resources),{loading});
const Journal=dynamic(()=>import('./library').then(m=>m.Journal),{loading});
const Settings=dynamic(()=>import('./library').then(m=>m.Settings),{loading});
const Learning=dynamic(()=>import('./learning').then(m=>m.LearningHub),{loading});
const Course=dynamic(()=>import('./learning').then(m=>m.LearningDetail),{loading});
const Details=dynamic(()=>import('./details').then(m=>m.Details),{ssr:false});

const navigation = [
  {id:'',label:'Overview',title:'Career Dashboard',description:'December 2026 – December 2027',icon:LayoutGrid},
  {id:'today',label:'Today',title:'Today',description:'Plan a study block, track focused time and record what you learned.',icon:Focus},
  {id:'learning',label:'My Learning',title:'My Learning',description:'Track Udemy courses, connect them to your roadmap and log focused study.',icon:BookOpen},
  {id:'roadmap',label:'Roadmap',title:'Roadmap',description:'Four learning blocks each month, from December 2026 through December 2027.',icon:CalendarDays},
  {id:'skills',label:'Skills',title:'Skills',description:'Inspect dependencies and record evidence for each competency.',icon:GitFork},
  {id:'projects',label:'Projects',title:'Projects',description:'Build, measure and release the systems in your portfolio.',icon:Layers3},
  {id:'analytics',label:'Analytics',title:'Analytics',description:'Compare recorded study with your plan and inspect the work behind each total.',icon:Activity},
  {id:'interviews',label:'Interviews',title:'Interviews',description:'Score mocks and revisit the practice formats in the roadmap.',icon:ListChecks},
  {id:'career',label:'Career',title:'Career',description:'Track internship requirements, applications and dated market research.',icon:BriefcaseBusiness},
  {id:'resources',label:'Resources',title:'Resources',description:'Find the original material and the sections worth studying.',icon:BookOpen},
  {id:'journal',label:'Journal',title:'Journal',description:'Record attempts, verify solutions and schedule retrieval practice.',icon:BookMarked},
  {id:'settings',label:'Settings',title:'Settings',description:'Adjust capacity and appearance, read the source and back up progress.',icon:Settings2},
];
const dockIds=['','today','roadmap','projects','analytics'];
const views:Record<string,()=>ReactNode>={
  '':()=> <Overview/>,today:()=> <Today/>,roadmap:()=> <Roadmap/>,skills:()=> <Skills/>,projects:()=> <Projects/>,analytics:()=> <Analytics/>,
  interviews:()=> <Interviews/>,career:()=> <Career/>,resources:()=> <Resources/>,journal:()=> <Journal/>,settings:()=> <Settings/>,learning:()=> <Learning/>,
};
const url=(id:string)=>id?'/'+id+'/':'/';

class WorkspaceBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    return this.state.failed?<section className="panel" role="alert"><h2>This workspace could not open</h2><button className="button" type="button" onClick={()=>this.setState({failed:false})}>Try again</button></section>:this.props.children;
  }
}

type CommandItem={key:string;label:string;group:string;href?:string;detail?:Detail};
const commands:CommandItem[]=[
  ...navigation.map(item=>({key:'page-'+item.id,label:item.label,group:'Page',href:url(item.id)})),
  ...(['session','event','interview','journal'] as const).map((type,i)=>({key:'action-'+type,label:['Log study time','Schedule a session','Record mock interview','Write journal entry'][i],group:'Action',detail:{kind:'form' as const,type}})),
  {key:'action-course',label:'Add Udemy course',group:'Action',detail:{kind:'course-edit'}},
  ...roadmap.tasks.map(item=>({key:item.id,label:item.title,group:'Task',detail:{kind:'task' as const,id:item.id}})),
  ...roadmap.skills.map(item=>({key:'skill-'+item.id,label:item.title,group:'Skill',detail:{kind:'skill' as const,id:item.id}})),
  ...roadmap.projects.map(item=>({key:'project-'+item.id,label:item.name,group:'Project',href:'/projects/'+item.id+'/'})),
  ...roadmap.resources.map(item=>({key:'resource-'+item.id,label:item.title,group:'Resource',detail:{kind:'resource' as const,id:item.id}})),
];

function CommandPalette({close,onChoose}:{close:()=>void;onChoose:(item:CommandItem)=>void}){
  const courses=useCareer(state=>state.data.learning.courses);
  const [query,setQuery]=useState('');
  const [index,setIndex]=useState(0);
  const entries=query.trim()?[...commands,...courses.map(course=>({key:course.id,label:course.title,group:'Udemy course',href:courseLink(course.id)}))].filter(item=>(item.label+' '+item.group).toLowerCase().includes(query.trim().toLowerCase())).slice(0,15)
    :[...commands.filter(i=>i.group==='Action'),...commands.filter(i=>i.group==='Page')];
  return <DialogFrame open title="Search and actions" onClose={close} center>
    <form className="command-form" onSubmit={event=>{event.preventDefault();if(entries[index])onChoose(entries[index]);}}>
      <div className="command-input"><Search size={18}/><input type="search" aria-label="Search tasks, skills and resources" placeholder="Search tasks, skills, projects or resources" value={query} onChange={event=>{setQuery(event.target.value);setIndex(0);}}
        onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const next=Math.max(0,Math.min(entries.length-1,index+(event.key==='ArrowDown'?1:-1)));setIndex(next);document.getElementById('command-'+next)?.scrollIntoView({block:'nearest'});}}}/></div>
      <div className="command-results">{entries.length?entries.map((item,i)=><button type="button" id={'command-'+i} key={item.key} className={'line-row clickable '+(i===index?'command-active':'')} onMouseEnter={()=>setIndex(i)} onClick={()=>onChoose(item)}><span>{item.label}</span><small>{item.group}</small></button>):<Empty>No matching tasks, skills, projects or resources.</Empty>}</div>
      <small className="muted">↑ ↓ to navigate · Enter to open · Esc to close</small>
    </form>
  </DialogFrame>;
}
export function CareerShell({children}:{children:ReactNode}){
  const route=usePathname();
  const router=useRouter();
  const [active='',product]=route.split('/').filter(Boolean);
  const known=Object.hasOwn(views,active);
  const nav=navigation.find(item=>item.id===active)??navigation[0];
  const currentProject=active==='projects'&&product?projectById.get(product):undefined;
  const coursePage=active==='learning'&&product==='course';
  const timezone=useCareer(s=>s.data.settings.timezone);
  const solid=useCareer(s=>s.data.settings.solid);
  const ready=useStorageFlags(s=>s.ready);
  const storageError=useStorageFlags(s=>s.storageError);
  const [clock,setClock]=useState<Date|null>(null);
  const [detail,setDetail]=useState<Detail|null>(null);
  const [palette,setPalette]=useState(false);
  const [toast,setToast]=useState<{text:string;undo?:()=>void}|null>(null);
  const day=clock?todayKey(timezone,clock):roadmap.snapshot;
  const close=useCallback(()=>setDetail(null),[]);
  const notify=useCallback((text:string,undo?:()=>void)=>setToast({text,undo}),[]);
  const context=useMemo(()=>({open:setDetail,close,notify,day}),[close,notify,day]);
  useEffect(()=>{
    void useCareer.persist.rehydrate();
    const sync=()=>setClock(new Date());
    const first=setTimeout(sync,0);
    const interval=setInterval(sync,30000);
    return ()=>{clearTimeout(first);clearInterval(interval);};
  },[]);
  useEffect(()=>{
    function keyboard(event:KeyboardEvent){
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();setDetail(null);setPalette(value=>!value);
      }
    }
    window.addEventListener('keydown',keyboard);
    return ()=>window.removeEventListener('keydown',keyboard);
  },[]);
  useEffect(()=>{if(!toast)return;const timeout=setTimeout(()=>setToast(null),toast.undo?10000:4400);return ()=>clearTimeout(timeout);},[toast]);
  function onCommand(item:CommandItem){
    setPalette(false);
    if(item.href)router.push(item.href);
    if(item.detail)setDetail(item.detail);
  }
  return <AppContext.Provider value={context}>
    <div className={'environment '+(solid?'solid':'')} aria-hidden/>
    <div className="site-frame">
      <header className="site-header">
        <Link href="/" className="wordmark" aria-label="AI Career OS overview"><span><Layers3 size={17}/></span><strong>AI Career OS</strong><small>2027</small></Link>
        <div className="header-actions">{clock&&<span className="header-date"><CalendarDays size={14}/>{dateLabel(day,'EEE, d MMM yyyy')}</span>}<button className="search-trigger" type="button" onClick={()=>setPalette(true)}><Search size={16}/><span>Search</span><kbd><Command size={11}/> K</kbd></button></div>
      </header>
      <nav className="side-rail" aria-label="All workspaces">{navigation.map(item=><Link href={url(item.id)} key={item.id} aria-label={item.label} aria-current={item.id===active?'page':undefined} title={item.label}><item.icon size={17}/><span className="rail-label">{item.label}</span></Link>)}</nav>
      <main className={'app-main '+(active===''?'main-overview':'')}>
        <div className={'hero '+(active===''?'hero-overview':'')}>
          {currentProject&&<div className="breadcrumb"><Link href="/projects/">Projects</Link><ChevronRight size={13}/><span>{currentProject.core?'Core project':'Elective'}</span></div>}
          <h1>{currentProject?.name??(known?nav.title:'Page unavailable')}</h1>
          {!currentProject&&<p>{known?nav.description:'Open a workspace using the navigation.'}</p>}
        </div>
        {storageError&&<div className="storage-error" role="alert">{storageError}</div>}
        <div className={'workspace '+(active===''?'overview-workspace':'')} key={route}>
          <WorkspaceBoundary>{known?(ready?(coursePage?<Course/>:currentProject?<Project id={currentProject.id}/>:views[active]()):loading()):children}</WorkspaceBoundary>
        </div>
      </main>
      <nav className="dock" aria-label="Quick navigation">{dockIds.map(id=>{
        const item=navigation.find(item=>item.id===id)!;
        return <Link href={url(item.id)} aria-current={id===active?'page':undefined} key={id} title={item.label}><item.icon size={15}/><span>{item.label}</span></Link>;
      })}<span className="dock-divider"/><button className="dock-action" type="button" aria-label="Quick actions" title="Quick actions" onClick={()=>setPalette(true)}><CirclePlus size={22}/></button><button className="mobile-workspaces" type="button" aria-label="Browse all workspaces" onClick={()=>setPalette(true)}><LayoutGrid size={14}/>All</button></nav>
    </div>
    {detail&&<WorkspaceBoundary><Details detail={detail} onClose={close}/></WorkspaceBoundary>}
    {ready&&<LearningBridge/>}
    {palette&&<CommandPalette close={()=>setPalette(false)} onChoose={onCommand}/>}
    {toast&&<div className="toast" role="status"><Check size={17}/><span>{toast.text}</span>{toast.undo&&<button type="button" className="button inverse" onClick={()=>{toast.undo?.();setToast(null);}}>Undo</button>}<button type="button" className="icon-btn" aria-label="Dismiss notification" onClick={()=>setToast(null)}><X size={16}/></button></div>}
  </AppContext.Provider>;
}

