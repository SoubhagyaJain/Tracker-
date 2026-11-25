'use client';

import { createContext, useContext, useState, type FormEvent, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, Check, ChevronDown, Plus, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { z } from 'zod';

export type FormName = 'session'|'event'|'assessment'|'interview'|'job'|'journal'|'review'|'energy'|'market'|'gate'|'metric'|'timer';
export type Detail =
  | {kind:'task'|'skill'|'project'|'milestone'|'section'|'day'|'week'|'resource'; id:string}
  | {kind:'course-edit'; id?:string; progressOnly?:boolean}
  | {kind:'form'; type:FormName; id?:string; day?:string; taskId?:string; projectId?:string; courseId?:string; sectionId?:string};
export interface AppActions {
  open: (detail: Detail) => void;
  close: () => void;
  notify: (message: string, undo?:()=>void) => void;
  day: string;
}
export const AppContext=createContext<AppActions | null>(null);
export function useApp(){return useContext(AppContext)!;}

export function Panel({children,dark=false,className=''}:{children:ReactNode;dark?:boolean;className?:string}){
  return <section className={`panel ${dark?'dark':''} ${className}`}>{children}</section>;
}
export function PanelHeader({title,subtitle,action}:{title:string;subtitle?:string;action?:ReactNode}){
  return <div className="panel-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>;
}
export function IconButton({label,onClick,children,className=''}:{label:string;onClick:()=>void;children:ReactNode;className?:string}){
  return <button type="button" className={'icon-btn '+className} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}
export function Add({label,onClick}:{label:string;onClick:()=>void}){
  return <button type="button" className="button primary" onClick={onClick}><Plus size={16}/>{label}</button>;
}
export function Status({children}:{children:ReactNode}){
  return <span className={`status status-${String(children).toLowerCase().replaceAll(' ','-')}`}>{children}</span>;
}
export function Empty({children}:{children:ReactNode}){return <p className="empty">{children}</p>;}
export function OpenLink({href,children}:{href:string;children:ReactNode}){
  if (!/^https?:\/\//i.test(href)) return <>{children}</>;
  return <a className="external" href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={13}/></a>;
}
export function Markdown({children}:{children:string}){
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a:({href,children})=>href?<OpenLink href={href}>{children}</OpenLink>:<>{children}</>,
    img:({alt})=><span>{alt}</span>,
  }}>{children}</ReactMarkdown></div>;
}
export function Disclosure({title,sub,children,initial=false}:{title:string;sub?:ReactNode;children:ReactNode;initial?:boolean}){
  return <details className="disclosure" open={initial||undefined}><summary><span>{title}</span><span className="disclosure-end">{sub}<ChevronDown size={16}/></span></summary><div className="disclosure-body">{children}</div></details>;
}
export function Ring({value,label}:{value:number;label:string}){
  const reduced=useReducedMotion();
  return <div className="progress-ring"><div className="ring-face" role="img" aria-label={label+': '+value+' percent'}><svg viewBox="0 0 64 64" aria-hidden><circle cx="32" cy="32" r="27" className="ring-track"/><motion.circle cx="32" cy="32" r="27" className="ring-fill" pathLength={100} transform="rotate(-90 32 32)" strokeDasharray="100 100" initial={false} animate={{strokeDashoffset:100-Math.min(100,Math.max(0,value)),opacity:value?1:0}} transition={{duration:reduced?0:.55}}/></svg><span aria-hidden>{value}<small>%</small></span></div><span>{label}</span></div>;
}
export function DialogFrame({open,title,onClose,children,center=false,description}:{open:boolean;title:string;onClose:()=>void;children:ReactNode;center?:boolean;description?:string}){
  return <Dialog.Root open={open} onOpenChange={value=>{if(!value)onClose();}}><Dialog.Portal>
    <Dialog.Overlay className="overlay"/>
    <Dialog.Content className={center?'dialog dialog-center':'dialog drawer'}>
      <div className="dialog-title"><Dialog.Title>{title}</Dialog.Title><Dialog.Close asChild><button type="button" className="icon-btn" aria-label="Close"><X size={19}/></button></Dialog.Close></div>
      <Dialog.Description className={description?'muted':'sr-only'}>{description??title}</Dialog.Description>
      {children}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
export function Form({children,onSave,label='Save changes',secondary}:{children:ReactNode;onSave:(data:FormData)=>void;label?:string;secondary?:ReactNode}){
  const [error,setError]=useState('');
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    try { onSave(new FormData(event.currentTarget));setError(''); }
    catch(err){setError(err instanceof z.ZodError?err.issues.map(i=>i.path.join('.')+' '+i.message).join(' · '):err instanceof Error?err.message:'Check the form and try again.');}
  }
  return <form className="editor-form" onSubmit={submit}>{children}{error&&<p role="alert" className="error">{error}</p>}<div className="form-actions"><button className="button primary"><Check size={16}/>{label}</button>{secondary}</div></form>;
}
export type Choice = string | {value:string;label:string};
export function Field({label,name,value='',type='text',options,required=false,min,max,placeholder}:{label:string;name:string;value?:string|number;type?:string;options?:readonly Choice[];required?:boolean;min?:number;max?:number;placeholder?:string}){
  return <label className="field"><span>{label}</span>{options?<select name={name} defaultValue={value} required={required}>{options.map(option=>typeof option==='string'?<option key={option}>{option}</option>:<option key={option.value} value={option.value}>{option.label}</option>)}</select>
    :type==='textarea'?<textarea name={name} defaultValue={value} required={required} rows={3} placeholder={placeholder}/>
    :<input type={type} name={name} defaultValue={value} required={required} min={min} max={max} placeholder={placeholder}/>}</label>;
}
export const field = (form:FormData,key:string) => String(form.get(key)??'');
export function CheckField({name,checked=false,children}:{name:string;checked?:boolean;children:ReactNode}){
  return <label className="check-field"><input type="checkbox" name={name} defaultChecked={checked}/>{children}</label>;
}
export function download(filename:string,value:string,type:string){
  const url=URL.createObjectURL(new Blob([value],{type}));
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

