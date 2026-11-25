import { z } from 'zod';

const date = z.iso.date();
const url = z.url({ protocol: /^https?$/ });
const identity = z.object({ id: z.string().min(1) });
const text = z.string().min(1);
const task = identity.extend({
  monthId: text, weekId: text, title: text, start: date, due: date,
  kind: z.enum(['Study', 'Build', 'Interview', 'Review', 'Career', 'Gate']),
  priority: z.enum(['P0','P1','P2','P3']), skills: z.array(text),
  projectId: text.optional(), suggested: z.boolean(),
});
const week = identity.extend({ number: z.number().int().min(1).max(4), start: date, end: date, objective: text, taskIds: z.array(text) });
const gate = identity.extend({ monthId: text, criteria: text, target: text, evidenceAndCorrection: text, due: date });
const month = identity.extend({
  name: text, label: text, start: date, end: date, focus: text, resourceText: text,
  resourceIds: z.array(text), deliverable: text, skills: z.array(text),
  projectIds: z.array(text), weeks: z.array(week).length(4), gateId: text,
});
const skill = identity.extend({ priority: z.enum(['P0','P1','P2','P3']), title: text, criteria: text, hours: text, prerequisite: text, interview: text, domains: z.array(text) });
const dependency = z.object({ source: text, target: text });
const resource = identity.extend({ subject: text, title: text, url, scope: text, priority: z.enum(['P0','P1','P2','P3']), skills: z.array(text) });
const projectMilestone = identity.extend({ title: text });
const metric = identity.extend({ title: text, unit: text });
const project = identity.extend({
  number: z.number().int(), name: text, title: text, hours: text, release: text,
  core: z.boolean(), sections: z.array(z.object({ title: text, body: text })),
  milestones: z.array(projectMilestone), metrics: z.array(metric), architecture: z.array(text),
  stack: z.array(text),
});
const section = z.object({ number: z.number().int(), title: text, markdown: text });
export const roadmapSchema = z.object({
  title: text, digest: text, markdown: text, sections: z.array(section).length(16),
  starts: date, ends: date, snapshot: date, identity: text,
  months: z.array(month).length(13), tasks: z.array(task).min(52),
  gates: z.array(gate).length(13), skills: z.array(skill).min(20),
  dependencies: z.array(dependency).min(1),
  nodes: z.array(identity.extend({ title: text, skills: z.array(text) })),
  projects: z.array(project).length(5), resources: z.array(resource).min(19),
  competencies: z.array(identity.extend({ title: text, levels: z.tuple([text,text,text,text]) })),
  capacity: z.array(z.object({ hours: z.number(), total: z.number(), allocations: z.array(z.number()).length(5), rules: text })).length(3),
  dailyBlocks: z.array(z.object({ title: text, minutes: z.number(), detail: text })).length(6),
  decemberDays: z.record(z.string(),text),
  decemberCheckpoints: z.array(z.object({ days: text, checkpoint: text })),
  milestones: z.array(identity.extend({ title: text, date, criteria: text, taskIds: z.array(text), projectId: text.optional() })),
  interviewAreas: z.array(z.object({ title: text, format: text, bar: text })),
});
export type RoadmapSource = z.infer<typeof roadmapSchema>;
export type RoadmapMonth = z.infer<typeof month>;
export type RoadmapWeek = z.infer<typeof week>;
export type LearningTask = z.infer<typeof task>;
export type Skill = z.infer<typeof skill>;
export type SkillDependency = z.infer<typeof dependency>;
export type LearningResource = z.infer<typeof resource>;
export type Project = z.infer<typeof project>;
export type ProjectMilestone = z.infer<typeof projectMilestone>;
export type EvaluationMetric = z.infer<typeof metric>;
export type MonthlyGate = z.infer<typeof gate>;
