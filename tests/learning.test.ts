import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptCompanion, applyCourseCounts, courseProgress, learningMetrics, makeCourse, nextLearning, recordStudySession, suggestMapping, trackedUpdate, upsertCourse } from '../lib/learning';
import { blankMapping, canonicalCourseUrl, learningEntrySchema } from '../lib/learning-schema';
import { applyCourseImport, FileImportProvider, parseLearningFile, UdemyBusinessProvider } from '../lib/learning-providers';
import { makeBackup, readBackup } from '../lib/logic';
import { emptyProgress, migrateProgress, type StudySession } from '../lib/progress-schema';
import { fetchBusinessCourses } from '../scripts/udemy-business.mjs';

const date='2026-12-02',at='2026-12-02T12:00:00.000Z';
const entry=learningEntrySchema.parse({title:'Python foundations',url:'https://www.udemy.com/course/python-foundations/learn/lecture/123?ref=example'});

test('course and curriculum progress use the roadmap without modifying mastery',()=>{
  let data=emptyProgress();
  assert.equal(suggestMapping(entry.title).monthId,'2026-12');
  assert.equal(suggestMapping('SQL essentials').monthId,'2027-01');
  assert.equal(suggestMapping('PyTorch crash course').monthId,'2027-03');
  assert.equal(suggestMapping('Video editing').skillId,'');
  let course=makeCourse(entry,'manual',at,date);
  const section={id:'required',title:'Foundations',scope:'Required' as const,notes:'',practice:'',mapping:{...blankMapping},
    lectures:[{id:'L1',title:'Functions',minutes:12,completedAt:at}]};
  course=trackedUpdate(course,{sections:[section]},'manual',at);
  assert.equal(courseProgress(course).completed,1);
  assert.equal(courseProgress(course).percent,null);
  course=applyCourseCounts(course,learningEntrySchema.parse({...entry,totalLectures:2,completedLectures:2}),'manual',at);
  assert.equal(courseProgress(course).percent,100);
  assert.equal(course.enrollment.status,'Completed');
  data=upsertCourse(data,course);
  assert.deepEqual(data.assessments,[]);
  assert.equal(learningMetrics(data,date).completed.length,1);
  data=upsertCourse(data,makeCourse(learningEntrySchema.parse({title:'Video editing',url:''}),'manual',at,date));
  assert.equal(nextLearning(data,date),undefined);
});

test('file imports are validated and keep course notes and mappings on duplicates',()=>{
  const parsed=parseLearningFile('courses.csv','title,url,instructor,completedLectures,totalLectures\r\n"Python, the essentials",https://udemy.com/course/python-foundations/,"Instructor ""A""",1,10');
  assert.equal(parsed[0].instructor,'Instructor "A"');
  assert.equal(canonicalCourseUrl(parsed[0].url),'https://www.udemy.com/course/python-foundations/');
  assert.throws(()=>parseLearningFile('courses.csv','title,url\nExample,https://www.udemy.com.evil.test/course/example'));
  assert.throws(()=>parseLearningFile('courses.json','{"courses":[{"title":"Bad count","url":"","completedLectures":3,"totalLectures":2}]}'));
  const original={...makeCourse(entry,'manual',at,date),notes:'Keep these personal notes'};
  const data=upsertCourse(emptyProgress(),original);
  const result=applyCourseImport(data,parsed,FileImportProvider,at,date);
  assert.equal(result.added,0);
  assert.equal(result.skipped,1);
  assert.deepEqual(result.data.learning.courses,[original]);
});
test('a reviewed Business snapshot refreshes Business progress and keeps manual edits',()=>{
  const [original]=UdemyBusinessProvider.parse({courses:[{title:'Business Python',url:'',externalId:'tenant:123',percent:20,reportedAt:at}]});
  const first=applyCourseImport(emptyProgress(),[original],UdemyBusinessProvider,at,date).data;
  const [next]=UdemyBusinessProvider.parse({courses:[{...original,percent:80,reportedAt:'2026-12-03T12:00:00.000Z'}]});
  const refreshed=applyCourseImport(first,[next],UdemyBusinessProvider,next.reportedAt!,date,true);
  assert.equal(refreshed.refreshed,1);
  assert.equal(courseProgress(refreshed.data.learning.courses[0]).percent,80);
  const manual=applyCourseCounts(refreshed.data.learning.courses[0],{...original,percent:80},'manual','2026-12-04T12:00:00.000Z');
  const saved=upsertCourse(refreshed.data,manual);
  const later=applyCourseImport(saved,[{...next,percent:90,reportedAt:'2026-12-05T12:00:00.000Z'}],UdemyBusinessProvider,'2026-12-05T12:00:00.000Z',date,true);
  assert.equal(later.skipped,1);
  assert.equal(courseProgress(later.data.learning.courses[0]).percent,80);
});
test('timed study rejects overlap and keeps measured video apart from actual focus',()=>{
  const start=Date.parse(at)-600000,end=Date.parse(at);
  const existing:StudySession={id:'timer',title:'Other focus',date,minutes:5,category:'Build',skillId:'',taskId:'',notes:'',
    intervals:[{start:start-60000,end:start+240000}]};
  const data=recordStudySession(emptyProgress(),existing);
  assert.throws(()=>recordStudySession(data,existing),/already recorded/);
  const packet={version:1,id:'packet',course:{...entry,completedLectures:1,totalLectures:3},taskId:'',session:{
    id:'companion-session',at,minutes:10,videoMinutes:8,mode:'Video',intervals:[{start,end}],
  }};
  assert.throws(()=>acceptCompanion(data,packet,at),/overlaps/);
  const active={...emptyProgress(),timer:{title:'Focus',category:'Learning' as const,taskId:'',skillId:'',notes:'',startedAt:start,elapsedMs:0}};
  assert.throws(()=>acceptCompanion(active,packet,at),/overlaps/);
  const saved=acceptCompanion(emptyProgress(),packet,at).data;
  assert.equal(saved.sessions[0].minutes,10);
  assert.equal(saved.sessions[0].videoMinutes,8);
  assert.equal(learningMetrics(saved,date).weekly,10);
  assert.equal(acceptCompanion(saved,packet,at).duplicate,true);
  assert.equal(saved.sessions.length,1);
  assert.throws(()=>acceptCompanion(emptyProgress(),{...packet,session:{...packet.session,minutes:30}},at),/do not match/);
});
test('learning survives a backup and older workspaces migrate without losing records',()=>{
  const current=emptyProgress();
  const {learning:removed,...old}=current;
  assert.equal(removed.courses.length,0);
  const upgraded=migrateProgress({...old,readiness:{rag:true}},1);
  assert.equal(upgraded.readiness.rag,true);
  assert.equal(upgraded.learning.courses.length,0);
  const data=upsertCourse(current,makeCourse(entry,'manual',at,date));
  assert.deepEqual(readBackup(makeBackup(data)).data,data);
  assert.equal(readBackup({...makeBackup(current),version:1,data:old}).data.learning.courses.length,0);
});
test('the Business adapter scopes reporting requests and strips other learners and identifiers',async()=>{
  const config={subdomain:'example',organization:'123',clientId:'fixture',clientSecret:'fixture-secret',learner:'learner@example.org'};
  const allowed={user_email:config.learner,course_id:7,course_title:'Python',completion_ratio:80,course_duration:100,
    num_video_consumed_minutes:45,course_last_accessed_date:at};
  let called=0;
  const request:typeof fetch=async (input,init)=>{
    called++;
    const url=new URL(String(input));
    assert.equal(url.hostname,'example.udemy.com');
    assert.equal(url.searchParams.get('user_email'),config.learner);
    assert.equal(init?.redirect,'error');
    assert.match(new Headers(init?.headers).get('Authorization')??'',/^Basic /);
    return new Response(JSON.stringify({results:[allowed,{...allowed,user_email:'other@example.org',course_id:8}],next:null}));
  };
  const result=await fetchBusinessCourses(config,'pull',request,new Date(at));
  assert.equal(called,1);
  assert.equal(result.courses?.length,1);
  assert.equal(result.courses?.[0].percent,80);
  assert.equal(result.courses?.[0].providerVideoMinutes,45);
  assert.doesNotMatch(JSON.stringify(result),/example.org|fixture-secret/);
  await assert.rejects(fetchBusinessCourses(config,'pull',async()=>new Response(JSON.stringify({
    results:[allowed],next:'https://other.example.org/foreign',
  }))),/unexpected pagination link/);
});

