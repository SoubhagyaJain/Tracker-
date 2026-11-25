import { learningFileSchema, learningEntrySchema, type LearningEntry } from './learning-schema';
import { applyCourseCounts, integrationEvent, makeCourse, matchingCourse, upsertCourse } from './learning';
import type { Progress } from './progress-schema';

type CourseProvider = {
  source:'manual'|'file'|'business';
  parse: (value:unknown) => LearningEntry[];
};
export const ManualCourseProvider:CourseProvider = {
  source:'manual',parse:value=>[learningEntrySchema.parse(value)],
};
export const FileImportProvider:CourseProvider = {
  source:'file',parse:value=>learningFileSchema.parse(Array.isArray(value)?{courses:value}:value).courses,
};
export const UdemyBusinessProvider:CourseProvider = {
  source:'business',parse:value=>learningFileSchema.parse(value).courses,
};

export function applyCourseImport(data:Progress,entries:LearningEntry[],provider:CourseProvider,at:string,day:string,refreshBusiness=false){
  let next=data, added=0, skipped=0, refreshed=0;
  for(const entry of entries){
    const existing=matchingCourse(next.learning.courses,entry,provider.source);
    if(existing){
      if(refreshBusiness&&provider.source==='business'&&existing.provider==='business'&&existing.progressSource==='business'&&
        (!entry.reportedAt||entry.reportedAt>existing.updatedAt)){
        next=upsertCourse(next,applyCourseCounts(existing,entry,'business',entry.reportedAt??at));
        refreshed++;
      }else skipped++;
      continue;
    }
    next=upsertCourse(next,makeCourse(entry,provider.source,at,day));
    added++;
  }
  const result={added,skipped,refreshed};
  return {...result,data:integrationEvent(next,{at,source:provider.source,phase:added||refreshed?'Accepted':'Skipped',
    message:added+' added, '+refreshed+' updated, '+skipped+' duplicates or local records kept'})};
}

const headers=['title','url','instructor','thumbnail','durationMinutes','completedLectures','totalLectures','percent','externalId','certificateUrl'] as const;
const numeric=new Set(['durationMinutes','completedLectures','totalLectures','percent']);

export function parseLearningFile(filename:string,text:string) {
  if(/\.json$/i.test(filename))return FileImportProvider.parse(JSON.parse(text.replace(/^\uFEFF/,'')));
  if(!/\.csv$/i.test(filename))throw new Error('Choose a CSV or JSON course file.');
  const [head,...rows]=readCsv(text.replace(/^\uFEFF/,''));
  if(!head||!head.map(value=>value.trim()).includes('title'))throw new Error('The CSV needs a title column.');
  const keys=head.map(value=>value.trim());
  if(new Set(keys).size!==keys.length)throw new Error('CSV headers must be unique.');
  return FileImportProvider.parse(rows.map((row,index)=>{
    if(row.length!==keys.length)throw new Error('Check the number of columns on CSV row '+(index+2)+'.');
    const entry:Record<string,string|number>={url:''};
    for(const key of headers){
      const cell=row[keys.indexOf(key)]?.trim();
      if(cell)entry[key]=numeric.has(key)?Number(cell):cell;
    }
    return entry;
  }));
}

function readCsv(input:string) {
  const rows:string[][]=[];
  let row:string[]=[],cell='',quoted=false,closed=false;
  const endCell=()=>{row.push(cell);cell='';closed=false;};
  const endRow=()=>{endCell();if(row.some(value=>value.trim()))rows.push(row);row=[];};
  for(let i=0;i<input.length;i++){
    const char=input[i];
    if(quoted){
      if(char==='"'&&input[i+1]==='"'){cell+='"';i++;continue;}
      if(char==='"'){quoted=false;closed=true;continue;}
      cell+=char;continue;
    }
    if(char===','){endCell();continue;}
    if(char==='\r'||char==='\n'){if(char==='\r'&&input[i+1]==='\n')i++;endRow();continue;}
    if(char==='"'&&!cell&&!closed){quoted=true;continue;}
    if(closed||char==='"')throw new Error('Check CSV quoting.');
    cell+=char;
  }
  if(quoted)throw new Error('A CSV field has an unclosed quote.');
  endRow();
  return rows;
}

