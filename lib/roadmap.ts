import data from '../content/roadmap.generated.json';
import type { RoadmapSource } from './roadmap-schema';

export const roadmap = data as unknown as RoadmapSource;
export const monthById = new Map(roadmap.months.map(month => [month.id, month]));
export const taskById = new Map(roadmap.tasks.map(task => [task.id, task]));
export const skillById = new Map(roadmap.skills.map(skill => [skill.id, skill]));
export const projectById = new Map(roadmap.projects.map(project => [project.id, project]));

