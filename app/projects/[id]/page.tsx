import {notFound} from 'next/navigation';
import {projectById,roadmap} from '@/lib/roadmap';
export const dynamicParams=false;
export function generateStaticParams(){return roadmap.projects.map(project=>({id:project.id}));}
export default async function ProjectRoute({params}:{params:Promise<{id:string}>}){
  if(!projectById.has((await params).id))notFound();
  return null;
}
