'use client';
import { useMemo,useState } from 'react';
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Plus } from 'lucide-react';
import { roadmap, skillById } from '@/lib/roadmap';
import { levels } from '@/lib/progress-schema';
import { useCareer } from '@/lib/store';
import { dateLabel } from '@/lib/logic';
import { Add, Disclosure, Empty, Markdown, OpenLink, Panel, PanelHeader, Status, useApp } from './ui';
import { TaskRows } from './tasks';

const dependencies=roadmap.dependencies;
function depth(id:string):number {
  const parents=dependencies.filter(edge=>edge.target===id);
  return parents.length?1+Math.max(...parents.map(edge=>depth(edge.source))):0;
}
function related(id:string,direction:'source'|'target'):Set<string>{
  const other=direction==='source'?'target':'source';
  const neighbors=dependencies.filter(edge=>edge[direction]===id).map(edge=>edge[other]);
  return new Set(neighbors.flatMap(node=>[node,...related(node,direction)]));
}
const graphPosition=Object.fromEntries(roadmap.nodes.map(node=>{
  const d=depth(node.id);
  const column=roadmap.nodes.filter(group=>depth(group.id)===d);
  return [node.id,{x:column.length===1?205:36+column.indexOf(node)*335,y:d*79+16}];
}));
const tinyNames=['Python','Math & stats','SQL','Classical ML','Deep learning','Software','LLM','Agents','Deploy','Systems','Interviews'];
export function Skills(){
  const data=useCareer(s=>s.data);
  const {open}=useApp();
  const [search,setSearch]=useState('');
  const [priority,setPriority]=useState('');
  const [selected,setSelected]=useState('');
  const [isolate,setIsolate]=useState(false);
  const [tab,setTab]=useState('Dependencies');
  const assessments=[...data.assessments].sort((a,b)=>b.date.localeCompare(a.date));
  const competencies=roadmap.competencies.map((domain,index)=>{
    const actual=assessments.find(a=>a.domain===domain.id);
    const achieved=levels.indexOf(actual?.level??'Unassessed');
    const target=levels.indexOf(actual?.target??'J');
    return {...domain,actual,achieved,target,axis:tinyNames[index]};
  });
  const skillMatches=roadmap.skills.filter(s=>(!priority||s.priority===priority)&&(!search||s.title.toLowerCase().includes(search.toLowerCase())));
  const {nodes,edges}=useMemo(()=>{
    const prerequisites=selected?related(selected,'target'):new Set<string>();
    const downstream=selected?related(selected,'source'):new Set<string>();
    const highlighted=new Set([...prerequisites,...downstream,selected]);
    const nodes:Node[]=roadmap.nodes.filter(node=>!isolate||!selected||highlighted.has(node.id)).map(node=>{
      const skills=node.skills.map(id=>skillById.get(id)!);
      const matches=(!priority||skills.some(skill=>skill.priority===priority))&&(!search||[node.title,...skills.map(skill=>skill.title)].some(t=>t.toLowerCase().includes(search.toLowerCase())));
      const mastered=skills.some(skill=>skill.domains.some(domain=>{
        const assessment=[...data.assessments].sort((a,b)=>b.date.localeCompare(a.date)).find(a=>a.domain===domain);
        return assessment?.level==='J'||assessment?.level==='A';
      }));
      return {id:node.id,position:graphPosition[node.id],data:{label:<>{mastered?'✓ ':''}{node.title}</>},draggable:false,
        className:'dependency-node '+(node.id===selected?'node-selected ':prerequisites.has(node.id)?'node-prerequisite ':'')+(!matches||selected&&!highlighted.has(node.id)?'node-muted':'')};
    });
    const edges:Edge[]=dependencies.filter(edge=>nodes.some(node=>node.id===edge.source)&&nodes.some(node=>node.id===edge.target)).map(edge=>({...edge,id:edge.source+'-'+edge.target,markerEnd:{type:MarkerType.ArrowClosed},style:{stroke:selected&&highlighted.has(edge.source)&&highlighted.has(edge.target)?'#222':'#999389'}}));
    return {nodes,edges};
  },[data.assessments,isolate,priority,search,selected]);
  const selectedNode=roadmap.nodes.find(node=>node.id===selected);
  return <>
    <div className="workspace-toolbar"><div className="segmented">{['Dependencies','Scorecard','Gates'].map(name=><button type="button" aria-pressed={tab===name} key={name} onClick={()=>setTab(name)}>{name}</button>)}</div><Add label="Record assessment" onClick={()=>open({kind:'form',type:'assessment'})}/></div>
    {tab==='Dependencies'&&<div className="workspace-grid skills-grid">
      <Panel className="skill-graph"><PanelHeader title="Skill dependency graph" subtitle="Select a node to highlight its prerequisites and downstream skills"/>
        <div className="graph-controls"><label className="inline"><input type="checkbox" checked={isolate} onChange={e=>setIsolate(e.target.checked)}/> Focus on selected path</label><button type="button" className="button" onClick={()=>setSelected('')}>Clear selection</button></div>
        <div className="graph-canvas"><ReactFlow nodes={nodes} edges={edges} fitView minZoom={.28} maxZoom={2} nodesConnectable={false} onNodeClick={(_,node)=>setSelected(node.id)} proOptions={{hideAttribution:true}}><Background color="#a29d91" gap={19} size={1}/><Controls showInteractive={false}/></ReactFlow></div>
        {selectedNode&&<div className="selection-panel"><strong>{selectedNode.title}</strong><p>Direct prerequisites · {dependencies.filter(e=>e.target===selected).map(e=>roadmap.nodes.find(n=>n.id===e.source)?.title).join(', ')||'Foundational'}</p><div className="button-row">{selectedNode.skills.map(id=><button type="button" key={id} className="chip" onClick={()=>open({kind:'skill',id})}>{skillById.get(id)?.title}</button>)}</div></div>}
      </Panel>
      <Panel><PanelHeader title="Skill priority matrix" subtitle={skillMatches.length+' domains and topics'}/>
        <div className="filter-row"><input type="search" placeholder="Search skills" aria-label="Search skills" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Skill priority" value={priority} onChange={e=>setPriority(e.target.value)}><option value="">All priorities</option>{['P0','P1','P2','P3'].map(p=><option key={p}>{p}</option>)}</select></div>
        <div className="list-stack skill-list">{skillMatches.map(skill=><button type="button" className="line-row clickable" key={skill.id} onClick={()=>open({kind:'skill',id:skill.id})}><div><strong>{skill.title}</strong><p>{skill.hours}h</p></div><Status>{skill.priority}</Status></button>)}</div>
        {!skillMatches.length&&<Empty>No matching skills.</Empty>}
      </Panel>
    </div>}
    {tab==='Scorecard'&&<div className="workspace-grid">
      <Panel><PanelHeader title="Target versus demonstrated mastery" subtitle="B 1 · I 2 · J 3 · A 4"/><div className="radar"><ResponsiveContainer width="100%" height="100%" initialDimension={{width:460,height:300}}><RadarChart data={competencies} outerRadius="65%"><PolarGrid/><PolarAngleAxis dataKey="axis" tick={{fontSize:11,fill:'#45423d'}}/><Radar name="Target" dataKey="target" stroke="#8b8478" fill="#8b8478" fillOpacity={.14} isAnimationActive={false}/><Radar name="Demonstrated" dataKey="achieved" stroke="#242321" fill="#242321" fillOpacity={.35} isAnimationActive={false}/><Tooltip/></RadarChart></ResponsiveContainer></div></Panel>
      <Panel><PanelHeader title="Skill-gap heatmap" subtitle="Latest evidence against your target · J is the default goal"/><div className="list-stack">{competencies.map(domain=><button className="line-row clickable" type="button" key={domain.id} onClick={()=>open({kind:'form',type:'assessment',taskId:domain.id})}><strong>{domain.title}</strong><span className={'chip gap-'+Math.max(0,domain.target-domain.achieved)}>{domain.actual?.level??'Unassessed'} → {levels[domain.target]}</span></button>)}</div></Panel>
      <Panel className="span-full"><PanelHeader title="Competency criteria"/>{competencies.map(domain=><Disclosure key={domain.id} title={domain.title} sub={<Status>{domain.actual?.level??'Unassessed'}</Status>}><div className="criteria-grid">{domain.levels.map((text,index)=><div key={text}><strong>{levels[index+1]}</strong><p>{text}</p></div>)}</div><button type="button" className="button" onClick={()=>open({kind:'form',type:'assessment',taskId:domain.id})}><Plus size={15}/> Record evidence</button></Disclosure>)}</Panel>
      <Panel className="span-full"><PanelHeader title="Assessment history" subtitle="Dated demonstrations and next assessments"/>{assessments.length?<div className="list-stack">{assessments.map(a=><button className="line-row clickable" type="button" key={a.id} onClick={()=>open({kind:'form',type:'assessment',id:a.id})}><div><strong>{roadmap.competencies.find(c=>c.id===a.domain)?.title??a.domain}</strong><p>{a.evidence||a.tests||a.notes}</p></div><span>{a.level} · {dateLabel(a.date,'d MMM yyyy')}</span></button>)}</div>:<Empty>Record a demonstration to begin assessment history.</Empty>}</Panel>
      <Panel className="span-full"><PanelHeader title="Monthly mastery history" subtitle="Latest evidence available by each month’s end"/>
        <div className="table-wrap"><table><thead><tr><th>Month</th>{competencies.map(c=><th key={c.id}>{c.axis}</th>)}</tr></thead><tbody>{roadmap.months.map(month=><tr key={month.id}><th>{month.label}</th>{competencies.map(c=>{
          const result=assessments.find(a=>a.domain===c.id&&a.date<=month.end);
          return <td key={c.id}>{result&&month.start<=result.date?<button type="button" className="link-button" onClick={()=>open({kind:'form',type:'assessment',id:result.id})}>{result.level}</button>:result?.level??'—'}</td>;
        })}</tr>)}</tbody></table></div>
      </Panel>
    </div>}
    {tab==='Gates'&&<Panel><PanelHeader title="Monthly competency gates" subtitle="Source targets, evidence and corrective actions"/>{roadmap.gates.map(gate=><Disclosure key={gate.id} title={roadmap.months.find(m=>m.id===gate.monthId)!.label} sub={<Status>{data.gates[gate.id]?.status??'Pending'}</Status>}>
      <strong>{gate.target}</strong><Markdown>{gate.criteria}</Markdown><p>{gate.evidenceAndCorrection}</p>{data.gates[gate.id]&&<p className="callout">{data.gates[gate.id].correction||data.gates[gate.id].evidence}</p>}
      <button type="button" className="button" onClick={()=>open({kind:'form',type:'gate',id:gate.id})}>Assess this gate</button>
    </Disclosure>)}</Panel>}
  </>;
}
export function SkillDetails({id}:{id:string}){
  const skill=skillById.get(id);
  const {open}=useApp();
  const data=useCareer(s=>s.data);
  if(!skill)return null;
  const domains=roadmap.competencies.filter(domain=>skill.domains.includes(domain.id));
  const nodes=roadmap.nodes.filter(node=>node.skills.includes(id));
  const prerequisites=[...new Set(nodes.flatMap(node=>dependencies.filter(edge=>edge.target===node.id).map(edge=>edge.source)))];
  const tasks=roadmap.tasks.filter(task=>task.skills.includes(id));
  return <>
    <div className="inline"><Status>{skill.priority}</Status><span className="chip">{skill.hours} focused hours</span></div>
    <h3>Prerequisites</h3><p>{skill.prerequisite}</p><div className="button-row">{prerequisites.map(nodeId=>roadmap.nodes.find(node=>node.id===nodeId)).filter(Boolean).map(node=><button className="chip" key={node!.id} type="button" onClick={()=>open({kind:'skill',id:node!.skills[0]})}>{node!.title}</button>)}</div>
    <h3>Demonstrable proficiency</h3><Markdown>{skill.criteria}</Markdown>
    <h3>Interview relevance</h3><p>{skill.interview}</p>
    {domains.map(domain=><Disclosure key={domain.id} title={domain.title+' scorecard'}><div className="list-stack">{domain.levels.map((value,index)=><div className="line-row" key={value}><strong>{levels[index+1]}</strong><span>{value}</span></div>)}</div>
      {data.assessments.filter(a=>a.domain===domain.id).map(assessment=><div className="callout" key={assessment.id}><strong>{assessment.level} · {dateLabel(assessment.date)}</strong><p>{assessment.evidence}</p>{assessment.link&&<OpenLink href={assessment.link}>Evidence link</OpenLink>}</div>)}
      <Add label="Record assessment" onClick={()=>open({kind:'form',type:'assessment',taskId:domain.id})}/>
    </Disclosure>)}
    <h3>Related roadmap tasks</h3>{tasks.length?<TaskRows tasks={tasks}/>:<Empty>This is an elective without a dedicated source block.</Empty>}
  </>;
}

