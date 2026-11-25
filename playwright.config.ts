import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests', testMatch:'**/*.spec.ts', timeout:120_000, expect:{timeout:15_000}, fullyParallel:false, workers:1,
  use:{baseURL:'http://127.0.0.1:3000',channel:'chrome',headless:true,trace:'retain-on-failure'},
  webServer:{command:'npm run dev -- --hostname 127.0.0.1 --port 3000',url:'http://127.0.0.1:3000',reuseExistingServer:true,timeout:120_000},
});
