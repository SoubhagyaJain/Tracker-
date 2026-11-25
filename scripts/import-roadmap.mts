import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { unified } from 'unified';
import parse from 'remark-parse';
import gfm from 'remark-gfm';
import type { Nodes, Table } from 'mdast';
import { roadmapSchema, type LearningTask, type RoadmapSource } from '../lib/roadmap-schema';

const filename = process.argv[2] ?? 'content/roadmap.md';
const output = 'content/roadmap.generated.json';
const raw = readFileSync(filename,'utf8');
const md = raw.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const ast = unified().use(parse).use(gfm).parse(md);
const extract = (node: Nodes) => md.slice(node.position!.start.offset, node.position!.end.offset);
const heading = (node: Nodes) => extract(node).replace(/^#+\s+/, '');
const plain = (s: string) => s.replace(/\*\*/g,'').trim();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const refs = ast.children.filter((node) => node.type === 'heading' && node.depth === 2);
const sections = refs.map((node,index) => ({
  number:index+1, title:heading(node).replace(/^\d+\.\s*/, ''),
  markdown:md.slice(node.position!.end.offset,refs[index+1]?.position!.start.offset).trim(),
}));
function tables(section: number) {
  return (ast.children.filter((n) => n.type === 'table' && n.position!.start.offset! > refs[section-1].position!.start.offset! && n.position!.start.offset! < (refs[section]?.position!.start.offset ?? md.length)) as Table[])
    .map((table) => table.children.slice(1).map((row) => row.children.map((cell) => extract(cell).replace(/^\||\|$/g,'').trim())));
}
function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

const catalog = [
  ['python','python'], ['software','software-engineering'], ['sql','sql'], ['data','sql'],
  ['math','math-and-stats'], ['classical','classical-ml'], ['api','software-engineering'],
  ['deployment','deployment'], ['llm','llm-engineering'], ['dsa','python'],
  ['stats','math-and-stats'], ['features','classical-ml'], ['pytorch','deep-learning'],
  ['transformers','deep-learning,llm-engineering'], ['agents','agents'], ['cloud','deployment'],
  ['design','system-design'], ['advanced-rag','llm-engineering'], ['serving','deployment,system-design'],
  ['workflows','agents,deployment'], ['electives',''],
] as const;
const skills = tables(5)[0].map(([label,criteria,hours,prerequisite,interview],index) => {
  const [id,domain] = requireValue(catalog[index], 'Unmapped skill matrix row');
  const [,priority,title] = requireValue(label.match(/^(P[0-3]) (.+)$/) ?? undefined, 'Missing skill priority');
  return {id,priority,title,criteria,hours,prerequisite,interview,domains:domain.split(',').filter(Boolean)};
});
const resourceMap = [
  'python,software','software','sql','data','math','math,stats','classical','dsa',
  'pytorch','transformers','llm','llm','agents,workflows','llm','api','deployment',
  'cloud','cloud','serving',
];
const resources = tables(9)[0].flatMap(([subject,...cells],index) => cells.flatMap((cell) =>
  [...cell.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\s*·\s*(.*)/g)].map(([,title,url,scope]) => {
    const linked = requireValue(resourceMap[index],'Unmapped resource subject').split(',');
    return {id:slug(title),subject,title,url,scope,priority:skills.find((s)=>s.id===linked[0])!.priority,skills:linked};
  }),
));
const nodeLinks: Record<string,string[]> = {
  P:['python','software'],D:['sql','data'],A:['api','software'],M:['math','classical','stats'],
  T:['pytorch'],L:['transformers','llm'],R:['deployment','cloud'],G:['agents','workflows'],S:['serving','design'],
};
const graph = requireValue(sections[3].markdown.match(/```mermaid\s+([\s\S]+?)```/)?.[1], 'Missing Mermaid dependency graph');
const nodes = [...graph.matchAll(/(\w+)\["([^"]+)"\]/g)].map(([,id,title]) => ({id,title,skills:requireValue(nodeLinks[id],'Unmapped graph node')}));
const dependencies = [...graph.matchAll(/^\s*(\w+)(?:\["[^"]+"\])?\s*-->\s*(\w+)/gm)].map(([,source,target]) => ({source,target}));

const allSkillMonths = [
  'python,software,sql,api','math,stats,data,sql,classical','classical,features,api,deployment',
  'pytorch,transformers,llm','llm,advanced-rag,deployment','agents,workflows,software,dsa,sql',
  'agents,deployment,design','serving,transformers,design','serving,cloud,deployment,design',
  'sql,stats,design','dsa,design,software,llm','design,deployment,software','python,sql,design,software',
];
const focus = [
  'Python, Git, Linux, testing & SQL','Mathematics, statistics & data analysis','Classical ML & deployment',
  'Deep learning & RAG fundamentals','Production RAG & document intelligence','Agent workflows & evaluation',
  'CI evaluation gates & internship readiness','Model serving & inference benchmarks','Production reliability & systems',
  'Advanced SQL & experimentation','Interviews & system design','Portfolio & applications','Final gates & job acquisition',
];
const monthlyResourceIds = [
  [0,2,3,1],[6,5,9,7],[9,20,21],[11,12,13],[13,12,19],[17,18,21,22],
  [22,23,13],[25,11,22],[4,24,23],[9,4,8],[10,25,13],[],[],
];
const projectMonths = [[],[],['complaint'],['aperture'],['aperture'],['agentgate'],['agentgate'],['ridgepoint','aperture'],['ridgepoint','events'],['ridgepoint','events'],[],[],[]];
const projectIds = ['complaint','aperture','agentgate','ridgepoint','events'];
const projectAliases = ['', 'Aperture RAG','AgentGate','Ridgepoint',''];
const stacks = [
  ['Python','DuckDB or SQLite','pandas','scikit-learn','FastAPI','Docker'],
  ['PyMuPDF or equivalent','Sparse and dense retrieval','CPU embeddings','Small local model'],
  ['Python','Pydantic','pytest','Structured JSON','GitHub Actions','SQLite optional'],
  ['RTX 4050','PyTorch or Ridgepoint','vLLM if supported'],
  ['PostgreSQL','Python','Docker Compose','Optional Redis or AWS'],
];
const projectMetricLabels = [
  ['Macro-F1','Per-class recall','Coverage','Accepted-item accuracy','Cost-weighted errors','p95 API latency (ms)'],
  ['Evidence hit rate at k','MRR','nDCG','Citation correctness','Unsupported-claim rate','Unanswerable false-answer rate','OCR word error rate','p50 TTFT (ms)','p95 TTFT (ms)','p50 response latency (ms)','p95 response latency (ms)'],
  ['Task success','Policy compliance','Unnecessary calls','Duplicate side effects','Review rate','p95 duration (ms)','Tokens','Cost'],
  ['Throughput','TTFT (ms)','Inter-token latency (ms)','p50 end-to-end latency (ms)','p95 latency (ms)','Peak allocated VRAM','Peak reserved VRAM','Timeouts','Output correctness'],
  ['Throughput','Backlog age','p95 arrival-to-score latency (ms)','Duplicate final records','Failed-event recovery','Consistency after restart','Observed recovery time'],
];
const projectRaw = sections[9].markdown.split(/^### Project \d+ · /m).slice(1);
const projects = projectRaw.map((source,index) => {
  const [header,...rest] = source.split('\n');
  const [title,hours,release] = header.split(' · ');
  const sections = [...rest.join('\n').split(/^### Local hardware plan/m)[0].matchAll(/^- \*\*([^*]+)\*\* (.+)$/gm)].map(([,title,body])=>({title:title.replace(/\.$/,''),body}));
  const id = projectIds[index];
  const architecture = requireValue(sections[0].body.split(/(?<=\.)\s+/).find((line)=>line.includes('→')),'Missing project architecture').replace(/\.$/,'').split(' → ');
  const milestones = [...sections[1].body.matchAll(/\bM([1-4])\s+([\s\S]*?)(?=, M[1-4]\b|\.(?:\s|$)|$)/g)].map(([,number,title])=>({id:id+'-m'+number,title:title.trim()}));
  return {id,number:index+1,title,name:projectAliases[index] || title,hours,release,core:index<3,sections,milestones,architecture,stack:stacks[index],
    metrics:projectMetricLabels[index].map((title)=>({ id:id+'-'+slug(title),title,unit:title.includes('(ms)')?'ms':'Recorded unit' })),
  };
});

const decemberRows = tables(7)[0];
const decemberDays: Record<string,string> = Object.fromEntries(decemberRows.flatMap(([,actions]) =>
  [...actions.matchAll(/\bD(\d+) (.+?)(?= D\d+ |$)/g)].map(([,number,description])=>[number,description]),
));
decemberDays['29'] = decemberRows[4][1];
decemberDays['30'] = decemberRows[4][1];
const decemberCheckpoints = decemberRows.map(([days,,checkpoint])=>({days:plain(days),checkpoint}));
const schedule = tables(6);
const targets = tables(14)[1];
const capacity = schedule[0].map(([hours, allocations,total,rules])=>({
  hours:Number(plain(hours).match(/\d+/)![0]),total:Number(plain(total).replace(/[^\d]/g,'')),
  allocations:[...allocations.matchAll(/(\d+)h/g)].map(([,amount])=>Number(amount)),rules,
}));
const tasks: LearningTask[] = [];
const gates: RoadmapSource['gates'] = [];
const months = schedule[1].map(([label, objectives, deliverable],index) => {
  const anchor = new Date(Date.UTC(2026,11+index,1));
  const id = anchor.toISOString().slice(0,7);
  const day = (n: number) => id+'-'+String(n).padStart(2,'0');
  const monthSkills = allSkillMonths[index].split(',');
  const linkedProjects = projectMonths[index];
  const monthEnd = new Date(Date.UTC(2026,12+index,0)).toISOString().slice(0,10);
  const gateId = id+'-gate';
  gates.push({id:gateId,monthId:id,criteria:deliverable,target:targets[index][1],evidenceAndCorrection:targets[index][2],due:day(28)});
  const weeks = [...objectives.matchAll(/\*\*W([1-4])\*\* (.+?)(?= \*\*W[1-4]\*\* |$)/g)].map(([,ordinal,objective]) => {
    const number = Number(ordinal);
    const weekId = id+'-w'+number;
    const first = (number-1)*7+1;
    const last = first+6;
    const base = {monthId:id,weekId,skills:monthSkills,projectId:linkedProjects[0],priority:'P0' as const};
    const items: LearningTask[] = index===0
      ? Array.from({length:6},(_,n)=>{
          const d=first+n;
          return {...base,id:id+'-day-'+d,title:decemberDays[d],start:day(d),due:day(d),kind:n===5?'Interview':number===3?'Study':'Build',suggested:false};
        })
      : [{...base,id:weekId+'-objective',title:objective,start:day(first),due:day(last-1),
          priority:index===7&&number<4?'P2':[3,5,8,9,10,11].includes(index)?'P1':'P0',
          kind:index===12?'Career':number===1?'Study':'Build',suggested:false}];
    if(number===4) {
      items.push({...base,id:gateId,title:deliverable,start:day(last-1),due:day(last),kind:'Gate',suggested:false});
      if(index>0) {
        const mock = deliverable.match(/\bMock\s+.*?\.(?=\s|$)/)?.[0];
        if(mock) items.push({...base,id:id+'-mock',title:mock,start:day(last-2),due:day(last-1),kind:'Interview',suggested:false});
      }
    }
    tasks.push(...items);
    return {id:weekId,number,start:day(first),end:day(last),objective,taskIds:items.map((t)=>t.id)};
  });
  const name=anchor.toLocaleDateString('en-GB',{month:'long',timeZone:'UTC'});
  return {id,name,label:name+' '+anchor.getUTCFullYear(),start:day(1),end:monthEnd,focus:focus[index],
    resourceText:label.split('** · ')[1],resourceIds:monthlyResourceIds[index].map((i)=>resources[i].id),
    deliverable,skills:monthSkills,projectIds:linkedProjects,weeks,gateId};
});
const milestones = [
  {id:'complaint-release',title:'Complaint routing ML service',date:'2027-02-28',criteria:months[2].deliverable,taskIds:['2027-02-gate'],projectId:'complaint'},
  {id:'internship-search',title:'Begin internship applications',date:'2027-03-01',criteria:tables(11)[0][1][1],taskIds:[]},
  {id:'rag-release',title:'Document intelligence & RAG release',date:'2027-04-28',criteria:months[4].deliverable,taskIds:['2027-04-gate'],projectId:'aperture'},
  {id:'internship-gate',title:'Internship readiness',date:'2027-06-07',criteria:tables(11)[0][4][1],taskIds:['2027-05-gate']},
  {id:'evaluation-release',title:'CI evaluation gate release',date:'2027-06-28',criteria:months[6].deliverable,taskIds:['2027-06-gate'],projectId:'agentgate'},
  {id:'full-time-search',title:'Begin targeted full-time applications',date:'2027-07-01',criteria:tables(13)[0][0][2],taskIds:[]},
  {id:'deadline',title:'Career roadmap deadline',date:'2027-12-31',criteria:months[12].deliverable,taskIds:['2027-12-gate']},
];
const roadmap = roadmapSchema.parse({
  title: heading(ast.children[0]), digest:hash(md), markdown:md, sections, starts:months[0].start, ends:months[12].end,
  identity:'Soubhagya Jain', snapshot:'2026-11-25', months,tasks,gates,skills,nodes,dependencies,resources,projects,
  competencies:tables(14)[0].map(([title,...levels])=>({id:slug(title),title,levels})),
  capacity,dailyBlocks:tables(8)[0].map(([title,time,detail])=>({title,minutes:parseInt(time,10),detail})),
  decemberDays,decemberCheckpoints,milestones,
  interviewAreas:tables(12)[0].map(([title,format,bar])=>({title,format,bar})),
});
const unique = (list: {id:string}[]) => new Set(list.map(({id})=>id)).size === list.length;
const entityLists = [roadmap.months, roadmap.months.flatMap(m=>m.weeks), roadmap.tasks,roadmap.gates,roadmap.skills,roadmap.nodes,roadmap.resources,roadmap.projects,roadmap.competencies,roadmap.milestones];
if (!entityLists.every(unique) || roadmap.dependencies.some(edge=>![edge.source,edge.target].every(id=>roadmap.nodes.some(n=>n.id===id)))) throw new Error('Duplicate IDs or invalid dependency edges');
const skillIds = new Set(roadmap.skills.map(s=>s.id));
const resourceIds = new Set(roadmap.resources.map(r=>r.id));
const definedProjects = new Set(roadmap.projects.map(p=>p.id));
const taskIds = new Set(roadmap.tasks.map(t=>t.id));
for (const month of roadmap.months) {
  if (!month.skills.every(id=>skillIds.has(id)) || !month.resourceIds.every(id=>resourceIds.has(id)) ||
      !month.projectIds.every(id=>definedProjects.has(id)) || !month.weeks.every(w=>w.taskIds.every(id=>taskIds.has(id)))) {
    throw new Error('Invalid month relationships for '+month.id);
  }
}
const old = existsSync(output) ? JSON.parse(readFileSync(output,'utf8')) as RoadmapSource : null;
if (old && old.digest !== roadmap.digest) {
  const report = Object.fromEntries((['months','tasks','gates','skills','nodes','resources','projects','competencies','milestones'] as const).map(key=>{
    const before=new Map<string,string>(old[key].map(item=>[item.id,JSON.stringify(item)]));
    const after=new Map<string,string>(roadmap[key].map(item=>[item.id,JSON.stringify(item)]));
    return [key,{unmatched:[...before.keys()].filter(id=>!after.has(id)),changed:[...after.keys()].filter(id=>before.has(id)&&before.get(id)!==after.get(id)),added:[...after.keys()].filter(id=>!before.has(id))}];
  }));
  writeFileSync('content/roadmap-reconciliation.json',JSON.stringify({from:old.digest,to:roadmap.digest,...report},null,2)+'\n');
  console.log('Reconciliation report written. Existing personal records are keyed separately and retained.');
}
writeFileSync(output, JSON.stringify(roadmap,null,2)+'\n');
console.log(`Validated ${roadmap.sections.length} sections, ${roadmap.months.length} months, ${roadmap.tasks.length} tasks, ${roadmap.resources.length} resources and ${roadmap.dependencies.length} dependency edges.`);
