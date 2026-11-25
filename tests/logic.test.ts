import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {roadmap} from '../lib/roadmap';
import {roadmapSchema} from '../lib/roadmap-schema';
import {emptyProgress,interviewSchema,migrateProgress} from '../lib/progress-schema';
import {
  activity, aggregate, capacityFor, dailySchedule, distinctPasses, elapsedTimer, getTaskStatus, interviewPass, makeBackup, planDay,
  priorityTasks, progressFor, readBackup, remainingPlannedMinutes, targetMinutes, todayKey, toCSV, unmatchedProgress,
} from '../lib/logic';

test('the extracted source preserves the complete Markdown and all original dependency edges',()=>{
  const raw=readFileSync('content/roadmap.md','utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
  assert.equal(roadmap.markdown,raw);
  assert.equal(roadmap.digest,createHash('sha256').update(raw).digest('hex'));
  assert.equal(roadmapSchema.parse(roadmap).sections.length,16);
  assert.equal(roadmap.months.length,13);
  assert.equal(roadmap.months.flatMap(m=>m.weeks).length,52);
  assert.equal(roadmap.dependencies.map(e=>e.source+e.target).join(','),'PD,PA,DM,MT,TL,AR,LR,RG,RS');
  assert.equal(roadmap.resources.length,27);
  assert.equal(roadmap.projects.length,5);
  assert.ok(roadmap.projects.every(project=>project.milestones.length===4));
  assert.match(roadmap.decemberDays['1'],/closed-book Python\/SQL diagnostic/);
  assert.equal(roadmap.decemberDays['28'],'rest.');
});

test('calendar uses four seven-day blocks, roadmapped rest days and flex beyond day 28',()=>{
  assert.equal(planDay('2026-11-30').type,'Outside roadmap');
  assert.equal(planDay('2026-12-01').week?.number,1);
  assert.equal(planDay('2026-12-07').type,'Rest');
  assert.equal(planDay('2027-02-28').type,'Rest');
  assert.equal(planDay('2027-12-29').type,'Flex');
  assert.equal(planDay('2027-08-01').week?.number,1);
  assert.equal(todayKey('Asia/Kolkata',new Date('2026-11-30T21:00Z')),'2026-12-01');
});
test('capacity changes update sustained hours, template and exam allocations',()=>{
  const data=emptyProgress();
  assert.deepEqual(dailySchedule(data,'2026-12-01').map(p=>p.minutes),[20,50,120,40,50,20]);
  assert.equal(remainingPlannedMinutes(data,'2026-11-25'),1560*60);
  for(const [capacity,daily,total] of [[20,240,1040],[30,300,1560],[40,400,2080]] as const){
    data.settings.capacity=capacity;
    assert.equal(dailySchedule(data,'2026-12-01').reduce((sum,p)=>sum+p.minutes,0),daily);
    assert.equal(capacityFor(data,'2026-12-01').total,total);
    assert.equal(remainingPlannedMinutes(data,'2026-11-25'),total*60);
    assert.equal(targetMinutes(data,'2026-12-06'),capacity===20?0:daily);
  }
  data.settings.examUntil='2026-12-07';
  assert.equal(capacityFor(data,'2026-12-07').hours,20);
  assert.equal(capacityFor(data,'2026-12-08').hours,40);
});
test('task progress, upcoming priority, and competency gate are calculated independently',()=>{
  const data=emptyProgress();
  const initial=priorityTasks(data,'2026-11-25');
  assert.equal(initial.length,1);
  assert.equal(initial[0].task.id,'2026-12-day-1');
  data.tasks[initial[0].task.id]={notes:'',status:'Completed',completedOn:'2026-11-25'};
  assert.equal(progressFor(data).done,1);
  assert.deepEqual(data.assessments,[]);
  assert.equal(priorityTasks(data,'2026-11-25').length,0);
  const gate=roadmap.tasks.find(t=>t.id==='2026-12-gate')!;
  data.gates[gate.id]={status:'Failed',date:'2026-12-25',evidence:'',correction:'Rebuild CLI'};
  assert.equal(progressFor(data).done,1);
  assert.equal(getTaskStatus(data,gate,'2027-01-01'),'Blocked');
  data.gates[gate.id].previousFailures=1;
  assert.match(priorityTasks(data,'2027-01-02')[0].reason,/gate failed twice/);
  data.gates[gate.id].status='Passed';
  assert.equal(getTaskStatus(data,gate,'2027-01-01'),'Completed');
  assert.equal(progressFor(data).done,2);
});
test('recorded sessions aggregate by date and the rolling average includes prior days',()=>{
  const data=emptyProgress();
  data.sessions=[{id:'example',title:'SQL',date:'2026-12-01',minutes:120,category:'Learning',taskId:'',skillId:'sql',notes:''}];
  assert.equal(aggregate(data,'2026-12-01','2026-12-07'),120);
  assert.equal(aggregate(data,'2026-12-02','2026-12-07'),0);
  const point=activity(data,'2026-12-02','2026-12-02')[0];
  assert.equal(point.average,2/7);
  assert.equal(point.planned,5);
  assert.equal(point.energy,undefined);
  assert.equal(elapsedTimer({title:'Test',startedAt:1000,elapsedMs:3000,category:'Learning',taskId:'',skillId:'',notes:''},4000),6000);
});
test('interview threshold and distinct mock prompts match the source rubric',()=>{
  const first=interviewSchema.parse({id:'one',title:'Join fan-out',date:'2027-05-01',area:'SQL',reviewer:'Peer',notes:'',scores:[3,3,3,3,3]});
  assert.equal(interviewPass(first),true);
  assert.equal(interviewPass({...first,scores:[4,4,4,4,1]}),false);
  assert.equal(interviewPass({...first,scores:[3,3,3,3,2]}),false);
  assert.equal(distinctPasses([first,{...first,id:'two',title:'  JOIN FAN-OUT '},{...first,id:'three',title:'CTE drill'}]),2);
});
test('backup round-trip validates data, retains unmatched IDs, and migrates older settings',()=>{
  const data=emptyProgress();
  data.tasks['previous-source-task']={notes:'Keep attached evidence',status:'Completed'};
  const backup=makeBackup(data,new Date('2026-11-25T12:00Z'));
  assert.deepEqual(readBackup(JSON.parse(JSON.stringify(backup))).data,data);
  assert.equal(readBackup({...backup,roadmapDigest:'previous-source'}).sourceChanged,true);
  assert.deepEqual(unmatchedProgress(data),['previous-source-task']);
  assert.throws(()=>readBackup({...backup,data:{...data,sessions:[{minutes:-10}]}}));
  assert.throws(()=>readBackup({...backup,version:99}));
  assert.equal(migrateProgress({settings:{solid:true}},0).settings.capacity,30);
  assert.equal(toCSV([['a,b','=TEST','a"b']]),"\"a,b\",\"'=TEST\",\"a\"\"b\"\r\n");
});
test('a revised source reports changed text while preserving its task identifier',()=>{
  const workspace=mkdtempSync(join(tmpdir(),'career-roadmap-test-'));
  const importer=resolve('scripts/import-roadmap.mts');
  const runner=resolve('node_modules/tsx/dist/cli.mjs');
  const source=join(workspace,'content','roadmap.md');
  try {
    mkdirSync(join(workspace,'content'));
    writeFileSync(source,roadmap.markdown);
    function run() {
      const result=spawnSync(process.execPath,[runner,importer,source],{cwd:workspace,encoding:'utf8'});
      assert.equal(result.status,0,result.stderr||result.stdout);
    }
    run();
    const revised=roadmap.markdown.replace('D1 take a closed-book Python/SQL diagnostic','D1 take a timed closed-book Python/SQL diagnostic');
    writeFileSync(source,revised);
    run();
    const report=JSON.parse(readFileSync(join(workspace,'content','roadmap-reconciliation.json'),'utf8'));
    assert.ok(report.tasks.changed.includes('2026-12-day-1'));
    assert.deepEqual(report.tasks.unmatched,[]);
    const progress=emptyProgress();
    progress.tasks['2026-12-day-1']={status:'Completed',notes:'Original diagnostic evidence'};
    assert.equal(readBackup(makeBackup(progress)).data.tasks['2026-12-day-1'].notes,'Original diagnostic evidence');
  } finally {
    for(const filename of ['roadmap.md','roadmap.generated.json','roadmap-reconciliation.json']){
      rmSync(join(workspace,'content',filename),{force:true});
    }
    rmdirSync(join(workspace,'content'));
    rmdirSync(workspace);
  }
});

