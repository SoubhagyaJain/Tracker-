'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { emptyProgress, migrateProgress, progressSchema, schemaVersion, type Progress } from './progress-schema';

interface CareerState {
  data: Progress;
  update: (change: (previous: Progress) => Progress) => void;
  replace: (data: Progress) => void;
}
let storageReadFailed=false;
let pendingSave=Promise.resolve(true);
export function persistedProgress(){return pendingSave;}
export const useCareer = create<CareerState>()(persist((set) => ({
  data:emptyProgress(),
  update:change=>set(state=>({data:change(state.data)})),
  replace:data=>{
    const validated=progressSchema.parse(data);
    storageReadFailed=false;
    useStorageFlags.setState({storageError:''});
    set({data:validated});
  },
}),{
  name:'ai-career-os-progress',
  version:schemaVersion,
  skipHydration:true,
  storage:createJSONStorage(()=>({
    getItem:async name=>(await get<string>(name))??null,
    setItem:(name,value)=>{
      pendingSave=pendingSave.then(async()=>{
        if(storageReadFailed)return false;
        try { await set(name,value);return true; }
        catch { useStorageFlags.setState({storageError:'Saving to this browser failed. Export a backup to keep your changes.'});return false; }
      });
      return pendingSave.then(()=>undefined);
    },
    removeItem:del,
  })),
  partialize:state=>({data:state.data}),
  migrate:(payload,version)=>({data:migrateProgress((payload as {data:unknown}).data,version)}),
  merge:(saved,current)=>({...current,data:migrateProgress((saved as {data:unknown}|undefined)?.data ?? current.data,schemaVersion)}),
  onRehydrateStorage:()=> (_state,error)=>{
    // Hydration metadata must never replace unreadable stored data.
    queueMicrotask(()=>setHydrationStatus(error));
  },
}));

// Zustand's persist wrapper writes on setState. Keep operational flags outside that wrapper.
const useStorageFlags = create<{ready:boolean;storageError:string}>(()=>({ready:false,storageError:''}));
function setHydrationStatus(error: unknown) {
  storageReadFailed=!!error;
  useStorageFlags.setState({ready:true,storageError:error?'Saved data could not be read. Changes are held in memory until you explicitly restore a backup or reset local data.':''});
}
export { useStorageFlags };

export function upsert<T extends {id:string}>(items: T[], item: T): T[] {
  return items.some(existing=>existing.id===item.id) ? items.map(existing=>existing.id===item.id?item:existing) : [...items,item];
}

