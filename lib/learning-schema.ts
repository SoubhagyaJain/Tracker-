import { z } from 'zod';

export const learningProviders = ['manual','file','business','companion'] as const;
export const learningModes = ['Video','Implementation','Revision','Practice & assessment'] as const;
export const enrollmentStates = ['Enrolled','Active','Completed'] as const;
export const sectionScopes = ['Required','Optional','Irrelevant'] as const;
export const learningProviderSchema = z.enum(learningProviders);
const name = z.string().trim().min(1).max(250);
const id = z.string().min(1).max(180);
const count = z.number().int().min(0).max(10000);
const minutes = z.number().int().min(0).max(100000);
const memo = z.string().max(20000);
const timestamp = z.iso.datetime();
const optionalUrl = z.union([z.literal(''),z.url({protocol:/^https$/})]).refine(value=>{
  if(!value)return true;
  try {const {username,password}=new URL(value);return !username&&!password;}
  catch {return false;}
},'Use a URL without embedded credentials.');
const udemyUrl = optionalUrl.refine(value=>!value || isUdemyCourseUrl(value),'Use an HTTPS Udemy course URL.');
export const learnerMappingSchema = z.object({
  monthId:z.string(),weekId:z.string(),taskId:z.string(),skillId:z.string(),
  priority:z.enum(['','P0','P1','P2','P3']),projectId:z.string(),interviewTopic:z.string(),
});
export const blankMapping = {monthId:'',weekId:'',taskId:'',skillId:'',priority:'',projectId:'',interviewTopic:''} as const;
const lectureSchema = z.object({id,title:name,minutes,completedAt:timestamp.nullable()});
const sectionSchema = z.object({
  id,title:name,scope:z.enum(sectionScopes),notes:memo,practice:memo,mapping:learnerMappingSchema,
  lectures:z.array(lectureSchema).max(10000),
});
const snapshotSchema = z.object({
  id,at:timestamp,completed:count,total:count,percent:z.number().min(0).max(100),
  source:learningProviderSchema,
});
const certificateSchema = z.object({url:optionalUrl,earnedOn:z.union([z.iso.date(),z.literal('')])});
const enrollmentSchema = z.object({
  status:z.enum(enrollmentStates),bookmarked:z.boolean(),enrolledOn:z.iso.date(),
  targetDate:z.union([z.iso.date(),z.literal('')]),completedAt:timestamp.nullable(),
});
export const externalCourseSchema = z.object({
  id,title:name,url:udemyUrl,instructor:z.string().max(250),thumbnail:optionalUrl,durationMinutes:minutes,
  externalId:z.string().max(180),provider:learningProviderSchema, progressSource:learningProviderSchema,
  updatedAt:timestamp,notes:memo,practice:memo,
  enrollment:enrollmentSchema,certificate:certificateSchema,mapping:learnerMappingSchema,
  sections:z.array(sectionSchema).max(500),snapshots:z.array(snapshotSchema).max(10000),
  providerActivityAt:timestamp.optional(),providerVideoMinutes:minutes.optional(),
  unlistedCompleted:count,declaredLectures:count,reportedPercent:z.number().min(0).max(100).nullable(),
  curriculumComplete:z.boolean().optional(),
});
const syncEventSchema = z.object({
  id,at:timestamp,source:learningProviderSchema,phase:z.enum(['Accepted','Skipped','Error','Connected']),
  message:z.string().max(1000),
});
const integrationSettingsSchema = z.object({companion:z.boolean(),businessConsent:z.boolean()});
export const learningSchema = z.object({
  courses:z.array(externalCourseSchema).max(3000),sync:z.array(syncEventSchema).max(2000),integration:integrationSettingsSchema,
});
export const intervalSchema = z.object({start:z.number().int().positive(),end:z.number().int().positive()})
  .refine(value=>value.end>value.start,'Study interval must end after it starts.');
export const learningEntrySchema = z.object({
  title:name,url:udemyUrl,instructor:z.string().max(250).default(''),thumbnail:optionalUrl.default(''),
  durationMinutes:minutes.default(0),completedLectures:count.optional(),totalLectures:count.optional(),
  percent:z.number().min(0).max(100).optional(),externalId:z.string().max(180).default(''),
  certificateUrl:optionalUrl.default(''),reportedAt:timestamp.optional(),completedAt:timestamp.optional(),
  providerActivityAt:timestamp.optional(),providerVideoMinutes:minutes.optional(),
}).refine(value=>value.totalLectures===undefined||value.completedLectures===undefined||value.completedLectures<=value.totalLectures,{
  message:'Completed lectures cannot exceed the total.',path:['completedLectures'],
});
export const learningFileSchema = z.object({courses:z.array(learningEntrySchema).max(3000)});
export const companionEntrySchema = z.object({
  version:z.literal(1),id,course:learningEntrySchema,taskId:z.string().max(180).default(''),
  session:z.object({
    id,at:timestamp,minutes:z.number().int().min(0).max(1440),videoMinutes:z.number().int().min(0).max(1440),
    mode:z.enum(learningModes),intervals:z.array(intervalSchema).max(300),
  }).optional(),
});

export type LearningProvider = z.infer<typeof learningProviderSchema>;
export type ExternalCourse = z.infer<typeof externalCourseSchema>;
export type CourseSection = z.infer<typeof sectionSchema>;
export type Lecture = z.infer<typeof lectureSchema>;
export type CourseEnrollment = z.infer<typeof enrollmentSchema>;
export type CourseProgressSnapshot = z.infer<typeof snapshotSchema>;
export type CourseRoadmapMapping = z.infer<typeof learnerMappingSchema>;
export type Certificate = z.infer<typeof certificateSchema>;
export type IntegrationSettings = z.infer<typeof integrationSettingsSchema>;
export type SyncEvent = z.infer<typeof syncEventSchema>;
export type LearningState = z.infer<typeof learningSchema>;
export type StudyInterval = z.infer<typeof intervalSchema>;
export type LearningEntry = z.infer<typeof learningEntrySchema>;
export type CompanionEntry = z.infer<typeof companionEntrySchema>;

export function emptyLearning():LearningState {
  return {courses:[],sync:[],integration:{companion:false,businessConsent:false}};
}

export function isUdemyCourseUrl(value:string) {
  try {
    const url = new URL(value);
    return url.protocol==='https:' && !url.port && !url.username && !url.password &&
      (url.hostname==='udemy.com'||url.hostname.endsWith('.udemy.com')) && /^\/course\/[a-z0-9][a-z0-9-]*(\/|$)/i.test(url.pathname);
  } catch { return false; }
}
export function canonicalCourseUrl(value:string) {
  if (!value || !isUdemyCourseUrl(value)) return '';
  const url=new URL(value);
  const host=url.hostname==='udemy.com'?'www.udemy.com':url.hostname;
  return 'https://'+host+'/course/'+url.pathname.split('/')[2].toLowerCase()+'/';
}
export function courseThumbnail(value:string) {
  if (!value) return '';
  const url=new URL(value);
  if (url.protocol!=='https:' || url.username || url.password || url.port ||
      !['udemycdn.com','udemy.com','udemy-images.s3.amazonaws.com'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host))) {
    throw new Error('Use an HTTPS image URL from Udemy or its image CDN.');
  }
  return url.href;
}

