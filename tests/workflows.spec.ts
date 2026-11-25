import { expect,test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.beforeEach(async ({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-25T06:30:00.000Z'));
});
test('all workspace routes and project pages render, with desktop and mobile screenshots',async ({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.setViewportSize({width:1440,height:920});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Career Dashboard'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Weekly learning'})).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.screenshot({path:'docs/screenshots/overview-desktop.png',animations:'disabled'});
  const pages=[
    ['today','Today','Daily checklist'],['roadmap','Roadmap','Study calendar'],
    ['skills','Skills','Skill dependency graph'],['projects','Projects','30h portfolio plan'],
    ['analytics','Analytics','Consistency calendar'],['interviews','Interviews','Mock history'],
    ['career','Career','June internship readiness'],['resources','Resources','Harvard CS50P'],
    ['journal','Journal','Learning journal'],['settings','Settings','Original roadmap document'],
  ];
  for(const [route,title,section] of pages){
    await page.getByRole('navigation',{name:'All workspaces'}).getByRole('link',{name:title,exact:true}).click();
    await expect(page).toHaveURL(new RegExp('/'+route+'/$'));
    await expect(page.getByRole('heading',{name:title,exact:true,level:1})).toBeVisible();
    if(route==='roadmap')await page.getByRole('button',{name:'Calendar',exact:true}).click();
    await expect(page.getByRole('heading',{name:section,exact:true})).toBeVisible();
  }
  for(const id of ['complaint','aperture','agentgate','ridgepoint','events']){
    await page.goto('/projects/'+id+'/');
    await expect(page.getByRole('heading',{name:'Evaluation and benchmarks'})).toBeVisible();
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Career Dashboard'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Study consistency'})).toBeVisible();
  await page.screenshot({path:'docs/screenshots/overview-mobile.png',fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button',{name:'Browse all workspaces'}).click();
  await page.getByRole('button',{name:'Settings Page',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Original roadmap document'})).toBeVisible();
  await page.setViewportSize({width:1366,height:768});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Weekly learning'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(1366);
  expect(errors).toEqual([]);
});
test('calendar, skill evidence, project metrics, and spaced review editors retain their records',async ({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Schedule a session',exact:true}).click();
  await page.getByLabel('Session title').fill('December working session');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('button',{name:'December working session',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'December working session',exact:true}).dragTo(page.getByRole('button',{name:/Open Wednesday, 2 December/}));
  await page.getByRole('button',{name:'December working session',exact:true}).click();
  await expect(page.getByLabel('Date',{exact:true})).toHaveValue('2026-12-02');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.keyboard.press('Control+k');
  await page.getByRole('searchbox',{name:'Search tasks, skills and resources'}).fill('SQLBolt');
  await page.getByRole('button',{name:'SQLBolt Resource'}).click();
  await page.getByLabel('Bookmarked').check();
  await page.getByLabel('Personal notes').fill('Repeat joins without references.');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await page.goto('/skills/');
  await page.getByRole('button',{name:'Record assessment'}).click();
  await page.getByLabel('Current level').selectOption('J');
  await page.getByLabel('Evidence',{exact:true}).fill('Passed an independent timed Python drill.');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await page.getByRole('button',{name:'Scorecard',exact:true}).click();
  await expect(page.getByText('Passed an independent timed Python drill.')).toBeVisible();
  await page.goto('/projects/aperture/');
  await page.getByRole('button',{name:/Citation correctness.*Unmeasured/}).click();
  await page.getByLabel('Measured value').fill('92');
  await page.getByLabel('Unit',{exact:true}).fill('%');
  await page.getByLabel('Evaluation context').fill('Locked holdout');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('button',{name:/Citation correctness.*92 %/})).toBeVisible();
  await page.goto('/journal/');
  await page.getByRole('button',{name:'New journal entry'}).click();
  await page.getByLabel('Entry title').fill('Rebuild a citation checker');
  await page.getByLabel(/Schedule reviews at/).check();
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await page.getByRole('button',{name:'Review queue',exact:true}).click();
  await expect(page.getByRole('button',{name:/Rebuild a citation checker/})).toHaveCount(5);
});
test('progress, timer, capacity, interview rubric, and validated backup survive reload',async ({page},info)=>{
  await page.goto('/today/');
  await expect(page.getByRole('heading',{name:'Daily checklist'})).toBeVisible();
  await page.getByRole('button',{name:/Complete take a closed-book/}).first().click();
  await expect(page.getByRole('status')).toContainText('Task completed');
  await page.goto('/');
  await expect(page.getByRole('img',{name:/Roadmap: 1 percent/})).toBeVisible();
  await page.getByRole('button',{name:'Log study time',exact:true}).click();
  await page.getByLabel('Session title').fill('Python diagnostic practice');
  await page.getByLabel('Focused minutes').fill('90');
  await page.getByRole('button',{name:'Save study time',exact:true}).click();
  await page.goto('/analytics/');
  await expect(page.getByText('Python diagnostic practice', {exact:true})).toBeVisible();
  await expect(page.getByText('1.5h',{exact:true}).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Python diagnostic practice',{exact:true})).toBeVisible();
  await page.goto('/today/');
  await page.getByRole('button',{name:'Start timer',exact:true}).click();
  await page.getByLabel('What are you studying?').fill('Timestamp session');
  await page.getByRole('dialog').getByRole('button',{name:'Start timer'}).click();
  await page.reload();
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  await page.getByRole('button',{name:'Stop and save'}).click();
  await expect(page.getByText('Timestamp session',{exact:true})).toBeVisible();
  await page.goto('/settings/');
  for(const [name,hours] of [['Sustainable','1,040'],['Intensive','2,080'],['Standard','1,560']]){
    await page.getByRole('button',{name:new RegExp(name+' ') }).click();
    await expect(page.getByText(hours+'h remaining in the calendar')).toBeVisible();
  }
  await page.goto('/interviews/');
  async function mock(title:string,scores:number[]){
    await page.getByRole('button',{name:'Record mock interview',exact:true}).click();
    await page.getByLabel('Prompt or scenario title').fill(title);
    for(const [i,field] of ['Correctness','Independence','Reasoning','Communication','Verification'].entries()){
      await page.getByLabel(field,{exact:true}).fill(String(scores[i]));
    }
    await page.getByRole('button',{name:'Save changes',exact:true}).click();
  }
  await mock('Python failure fixture',[4,4,4,4,1]);
  await expect(page.getByRole('button',{name:/Python failure fixture/})).toContainText('Practice');
  await mock('Python parsed CSV',[3,3,3,3,3]);
  await mock('Python deduplication',[3,3,3,3,3]);
  await expect(page.getByText('Source rubric met across separate prompts.')).toBeVisible();
  await page.goto('/settings/');
  const downloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export JSON backup'}).click();
  const backupPath=info.outputPath('backup.json');
  await (await downloaded).saveAs(backupPath);
  const backup=JSON.parse(readFileSync(backupPath,'utf8'));
  expect(backup.data.sessions).toHaveLength(2);
  expect(backup.data.interviews).toHaveLength(3);
  await page.getByRole('button',{name:'Reset personal data',exact:true}).click();
  await page.getByRole('button',{name:'Reset data',exact:true}).click();
  await page.getByLabel('Choose backup file').setInputFiles(backupPath);
  await page.getByRole('button',{name:'Restore backup',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Backup restored');
  await page.goto('/analytics/');
  await expect(page.getByText('Python diagnostic practice',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('Timestamp session',{exact:true})).toBeVisible();
});

