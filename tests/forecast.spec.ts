import { expect, test } from '@playwright/test';
import { makeBackup, shift } from '../lib/logic';
import { emptyProgress } from '../lib/progress-schema';

test('shows separate milestone forecasts and updates when study time is logged', async ({ page }) => {
  const today = '2027-01-01';
  await page.clock.setFixedTime(new Date(today + 'T08:00:00Z'));
  await page.goto('/');
  const summary = page.getByRole('link', {name: /Study pace/});
  await expect(summary.getByText('Gathering data')).toHaveCount(2);
  await summary.click();
  await expect(page).toHaveURL(/\/analytics\/#study-forecast$/);
  await expect(page.getByRole('heading', {name: 'Study pace forecast'})).toBeVisible();
  const june = page.getByRole('region', {name: 'June internship'});
  const december = page.getByRole('region', {name: 'December 2027 goal'});
  const measuredPace = page.getByRole('paragraph').filter({hasText:'logged on average'});
  await expect(june.getByText('750h', {exact:true})).toBeVisible();
  await expect(december.getByText('1,560h', {exact:true})).toBeVisible();
  const data = emptyProgress();
  data.sessions = Array.from({length: 28}, (_, index) => ({
    id: String(index), date: shift(today, index - 28), minutes: 240,
    title: 'Sample study log', category: 'Learning', taskId: '', skillId: '', notes: '',
  }));
  await page.getByRole('navigation', {name:'All workspaces'}).getByRole('link', {name:'Settings'}).click();
  await page.getByLabel('Choose backup file').setInputFiles({
    name:'forecast-fixture.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(makeBackup(data))),
  });
  await page.getByRole('button', {name:'Restore backup',exact:true}).click();
  await page.getByRole('navigation', {name:'All workspaces'}).getByRole('link', {name:'Analytics'}).click();

  await expect(measuredPace).toContainText('28h/week');
  await expect(june.getByText('Behind pace')).toBeVisible();
  await expect(june.getByText('10h short at the current pace')).toBeVisible();
  await expect(december.getByText('On track', {exact:true})).toBeVisible();
  await expect(december.getByText('1,568h', {exact:true})).toBeVisible();

  await page.getByRole('button', {name:'Log study time',exact:true}).click();
  await page.getByLabel('Session title').fill('Current day study');
  await page.getByLabel('Focused minutes').fill('600');
  await page.getByRole('button', {name:'Save study time'}).click();
  await expect(june.getByText('On track', {exact:true})).toBeVisible();
  await expect(june.getByText('Projected to meet the hours target')).toBeVisible();
  await expect(june.getByText(/0\/10 internship requirements met/)).toBeVisible();
  await expect(measuredPace).toContainText('28h/week');

  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(december.getByRole('heading')).toBeVisible();
});

