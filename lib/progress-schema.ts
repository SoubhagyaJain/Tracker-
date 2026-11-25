import { z } from 'zod';
import { emptyLearning, intervalSchema, learningModes, learningSchema } from './learning-schema';

const text = z.string();
const required = text.trim().min(1);
const date = z.iso.date();
const optionalDate = z.union([date, z.literal('')]);
const link = z.union([z.url({protocol:/^https?$/}),z.literal('')]);
export const taskStatuses = ['In progress','Completed','Blocked','Deferred'] as const;
export const categories = ['Learning','Build','Interview','Career','Review'] as const;
export const stages = ['Saved','Preparing','Applied','Recruiter screen','Technical interview','Final round','Offer','Rejected','Withdrawn'] as const;
export const levels = ['Unassessed','B','I','J','A'] as const;
export const projectStatuses = ['Planned','In progress','Blocked','Released','Deferred'] as const;
export const scoreFields = ['Correctness','Independence','Reasoning','Communication','Verification'] as const;
const id = z.object({ id: required });
export const capacitySchema = z.union([z.literal(20),z.literal(30),z.literal(40)]);
export const taskProgressSchema = z.object({status:z.enum(taskStatuses).optional(),notes:text,completedOn:date.optional()});
const learningLink = {courseId:id.shape.id.optional(),sectionId:id.shape.id.optional()};
const learningSession = {...learningLink,learningMode:z.enum(learningModes).optional()};
export const sessionSchema = id.extend({
  title:required,date,minutes:z.number().int().min(0).max(1440),category:z.enum(categories),taskId:text,skillId:text,notes:text,
  ...learningSession, videoMinutes:z.number().int().min(0).max(1440).optional(), recordedAt:z.iso.datetime().optional(),
  source:z.enum(['manual','dashboard-timer','companion']).optional(),intervals:z.array(intervalSchema).max(300).optional(),
}).refine(record=>record.minutes>0 || (record.videoMinutes??0)>0,'Record focused time or measured video time.');
export const eventSchema = id.extend({title:required,date,time:text.regex(/^([01]\d|2[0-3]):[0-5]\d$/),minutes:z.number().int().min(1).max(720),category:z.enum(categories),notes:text,...learningLink});
export const timerSchema = z.object({title:required,category:z.enum(categories),taskId:text,skillId:text,notes:text,
  startedAt:z.number().nonnegative().nullable(),elapsedMs:z.number().nonnegative(),...learningSession,
  intervals:z.array(intervalSchema).max(300).optional(),
});
export const assessmentSchema = id.extend({domain:required,date,level:z.enum(levels),target:z.enum(levels),evidence:text,link,tests:text,notes:text,improvement:text,next:optionalDate});
export const gateProgressSchema = z.object({status:z.enum(['Passed','Failed','Pending']),date,evidence:text,correction:text,previousFailures:z.number().int().nonnegative().optional()});
export const projectProgressSchema = z.object({
  status:z.enum(projectStatuses),repo:link,demo:link,notes:text,milestones:z.array(text),
  metrics:z.record(z.string(),z.object({value:required,unit:text,context:text,date})),
});
const score = z.number().int().min(0).max(4);
export const interviewSchema = id.extend({title:required,date,area:required,reviewer:text,notes:text,scores:z.tuple([score,score,score,score,score])});
export const jobSchema = id.extend({company:required,role:required,location:text,eligibility:text,date:optionalDate,job:link,evidence:link,referral:text,compensation:text,stage:z.enum(stages),followup:optionalDate,notes:text,wellMatched:z.boolean().optional(),stageHistory:z.array(z.enum(stages)).optional()});
export const journalSchema = id.extend({title:required,date,kind:z.enum(['Learning','Reflection','No-AI challenge']),taskId:text,attempt:text,problem:text,hypothesis:text,hint:text,solution:text,verification:text,lessons:text,next:text,usedAI:z.boolean(),independent:z.boolean()});
export const reviewSchema = id.extend({title:required,date,interval:z.number().int().nonnegative(),journalId:text,status:z.enum(['Scheduled','Done']),rating:z.enum(['Again','Hard','Good','Easy','']),notes:text});
export const energySchema = z.object({energy:z.number().int().min(1).max(5),focus:z.number().int().min(1).max(5),notes:text});
export const marketSchema = id.extend({title:required,date,link,notes:required});
export const settingsSchema = z.object({capacity:capacitySchema,solid:z.boolean(),examUntil:optionalDate,timezone:required.refine(value=>{try { new Intl.DateTimeFormat('en',{timeZone:value}); return true; } catch { return false; }}),specialization:z.enum(['Applied AI','Machine learning','Data science','ML systems'])});
export const progressSchema = z.object({
  tasks:z.record(z.string(),taskProgressSchema), sessions:z.array(sessionSchema), events:z.array(eventSchema),
  timer:timerSchema.nullable(), assessments:z.array(assessmentSchema),gates:z.record(z.string(),gateProgressSchema),
  projects:z.record(z.string(),projectProgressSchema),interviews:z.array(interviewSchema),jobs:z.array(jobSchema),
  journal:z.array(journalSchema),reviews:z.array(reviewSchema),energy:z.record(date,energySchema),
  resources:z.record(z.string(),z.object({bookmarked:z.boolean(),completed:z.boolean(),notes:text})),
  market:z.array(marketSchema), settings:settingsSchema, milestones:z.record(z.string(),z.boolean()),
  priorities:z.record(date,z.array(text)), readiness:z.record(z.string(),z.boolean()), learning:learningSchema,
});
export const schemaVersion = 2;
export const v1BackupSchema=z.object({application:z.literal('ai-career-os'),version:z.literal(1),exportedAt:z.iso.datetime(),roadmapDigest:required,data:z.unknown()});
export const backupSchema = z.object({application:z.literal('ai-career-os'),version:z.literal(schemaVersion),exportedAt:z.iso.datetime(),roadmapDigest:required,data:progressSchema});
export type Progress = z.infer<typeof progressSchema>;
export type StudySession = z.infer<typeof sessionSchema>;
export type ExternalLearningSession = StudySession & Required<Pick<StudySession,'courseId'|'learningMode'>>;
export type ScheduleEvent = z.infer<typeof eventSchema>;
export type CompetencyAssessment = z.infer<typeof assessmentSchema>;
export type InterviewAttempt = z.infer<typeof interviewSchema>;
export type JobApplication = z.infer<typeof jobSchema>;
export type JournalEntry = z.infer<typeof journalSchema>;
export type ReviewSession = z.infer<typeof reviewSchema>;
export type UserSettings = z.infer<typeof settingsSchema>;
export type Capacity = z.infer<typeof capacitySchema>;

export function emptyProgress(): Progress {
  return {
    tasks:{},sessions:[],events:[],timer:null,assessments:[],gates:{},projects:{},
    interviews:[],jobs:[],journal:[],reviews:[],energy:{},resources:{},market:[],
    settings:{capacity:30,solid:false,examUntil:'',timezone:'Asia/Kolkata',specialization:'Applied AI'},
    milestones:{},priorities:{},readiness:{},learning:emptyLearning(),
  };
}
export function migrateProgress(payload: unknown, version: number): Progress {
  if (version===schemaVersion) return progressSchema.parse(payload);
  if (version===1 && payload && typeof payload==='object') return progressSchema.parse({learning:emptyLearning(),...payload});
  if (version===0 && payload && typeof payload==='object') {
    const defaults = emptyProgress();
    const previous = payload as Partial<Progress>;
    return progressSchema.parse({...defaults,...previous,settings:{...defaults.settings,...previous.settings}});
  }
  throw new Error('This data version is unsupported.');
}

