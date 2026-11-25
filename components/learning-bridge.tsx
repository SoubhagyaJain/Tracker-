'use client';
import { useEffect } from 'react';
import { acceptCompanion, integrationEvent } from '@/lib/learning';
import { roadmap } from '@/lib/roadmap';
import { persistedProgress, useCareer } from '@/lib/store';
import { useApp } from './ui';

const requestType='career-os-learning-request';
const responseType='career-os-learning-response';
const loopback=new Set(['127.0.0.1','localhost']);
export function LearningBridge(){
  const {notify}=useApp();
  useEffect(()=>{
    if(location.protocol!=='http:'||!loopback.has(location.hostname))return;
    function receive(event:MessageEvent){
      if(event.source!==window||event.origin!==location.origin||event.data?.type!==requestType)return;
      const {nonce,action,entry}=event.data;
      if(typeof nonce!=='string'||!/^[-a-f0-9]{36}$/i.test(nonce)||!['ping','send'].includes(action))return;
      const reply=(body:object)=>window.postMessage({type:responseType,nonce,...body},location.origin);
      const state=useCareer.getState();
      if(!state.data.learning.integration.companion){reply({ok:false,error:'Enable the companion in My Learning → Integrations.'});return;}
      if(action==='ping'){
        reply({ok:true,tasks:roadmap.tasks.map(task=>({id:task.id,title:task.title}))});
        return;
      }
      const at=new Date().toISOString();
      try{
        const result=acceptCompanion(state.data,entry,at);
        if(!result.duplicate)state.update(()=>result.data);
        void persistedProgress().then(async saved=>{
          if(result.duplicate&&!saved){
            state.update(current=>({...current}));
            saved=await persistedProgress();
          }
          if(!saved){reply({ok:false,error:'Local storage failed. Keep this record queued and retry.'});return;}
          if(!result.duplicate)notify('Udemy companion record saved');
          reply({ok:true,duplicate:result.duplicate});
        });
      }catch(error){
        const message=error instanceof Error&&error.message.length<250?error.message:'The companion record is invalid.';
        state.update(data=>integrationEvent(data,{at,source:'companion',phase:'Error',message}));
        reply({ok:false,error:message});
      }
    }
    window.addEventListener('message',receive);
    return ()=>window.removeEventListener('message',receive);
  },[notify]);
  return null;
}

