# Udemy Learning integration

Open **My Learning** to add a course, review an import, view course analytics, or manage connections. Course details contain the lecture checklist, notes, practice exercises, certificate link, roadmap mapping and study history. **Update progress** accepts the course’s overall lecture counts or a percentage where a total is unavailable. An entered checklist can also define the course total when you mark it as covering the full course.

## Providers

| Provider | Supported flow |
|---|---|
| Manual | Enter course metadata, counts or percentage, curriculum, certificate, and study sessions. |
| File import | Review and merge local CSV or JSON records. A matching normalized course URL or provider ID is skipped. |
| Udemy Business | Test a configured, authorized Enterprise reporting connection and review course-activity snapshots for one configured learner. |
| Chrome companion | Use the current Udemy course URL after an explicit click. Enter progress, optionally record a timed session, review the offline queue and send it to the local dashboard. |

Personal marketplace progress is manual. The companion accesses the course URL on request. Curriculum and lecture completion come from the user. Authorized Business responses supply reported course-level activity and completion, which can arrive after the learner activity. Business totals for video consumed are shown as provider totals. Dashboard study hours come from the local session ledger. [Udemy terms and policies](https://www.udemy.com/en/terms/) · [Udemy API Agreement](https://www.udemy.com/terms/api/) · [Udemy Business reporting methods](https://partnersupport.udemy.com/hc/en-us/articles/17361835464087-Summary-of-Available-APIs)

## Chrome companion

1. Start the local dashboard and open it in Chrome using the same origin where your dashboard data is stored.
2. In **My Learning → Integrations**, enable **Allow the companion on this local dashboard**.
3. Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose this project’s `extension` directory.
4. Open the extension and enter your dashboard origin, such as `http://127.0.0.1:3000`. Click **Test connection** and grant optional localhost access. Keep a dashboard tab open.
5. From a Udemy course, use **Use current Udemy URL** or paste a course URL. Enter the title and any progress to share. A successful connection loads the roadmap task choices.
6. Start, pause, resume, or stop the study timer as needed. Enter separately measured playback time when you have it. Queue the entry, review its course, task, and time, and click **Send reviewed records**.

The queue and timer use Chrome extension storage. A failed transfer keeps its pending records so you can retry after restoring the connection. The dashboard acknowledges delivery after an IndexedDB write. A retry of the same entry resolves to its existing record. The extension asks for localhost host access when connecting and uses active-tab access for explicit URL capture. [Chrome extension permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) · [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)

## File import and full backup

Use **Import courses** for a CSV with a `title` header or JSON containing a course array. Optional fields are `url`, `instructor`, `thumbnail`, `durationMinutes`, `completedLectures`, `totalLectures`, `percent`, `externalId`, and `certificateUrl`. Counts are integers and percentage runs from 0 to 100. Course URLs use HTTPS and an Udemy hostname. Import previews show the incoming titles and deduplication results after confirmation.

```csv
title,url,instructor,durationMinutes,completedLectures,totalLectures
My Python course,https://www.udemy.com/course/your-course-slug/,My instructor,600,3,20
```

Use **Settings → Export JSON backup** to keep course mappings, curriculum, certificates, progress history, integration settings and linked sessions together. Restore uses the existing versioned backup workflow. Version 1 and older workspaces migrate with an empty learning inventory while retaining their existing dashboard data.

## Authorized Business adapter

Run `npm run build` and then `npm start`. Use the same origin as your existing dashboard to keep the same IndexedDB records. If the Next development server is running on that port, stop it before starting the production server.

Configure these environment variables on the server through your normal secret-management setup.

| Variable | Value |
|---|---|
| `UDEMY_BUSINESS_SUBDOMAIN` | Organization vanity subdomain |
| `UDEMY_BUSINESS_ORGANIZATION_ID` | Numeric organization identifier |
| `UDEMY_BUSINESS_CLIENT_ID` | Authorized reporting client ID |
| `UDEMY_BUSINESS_CLIENT_SECRET` | Authorized reporting client secret |
| `UDEMY_BUSINESS_LEARNER_EMAIL` | Email of the learner approved for this import |

In **My Learning → Integrations**, enable requests for the configured Business learner, test the connection and choose **Review Business snapshot**. A separate checkbox authorizes refreshing existing Business-sourced progress. Earlier snapshots and local notes, curriculum, and mappings are retained. Records whose progress was edited manually keep that progress.

The loopback Node server calls the documented user-course-activity report with the configured learner filter. Pagination stays on the configured tenant and reporting endpoint. The server filters the returned rows to the selected learner, then passes only course fields to the browser. Some Business rows omit a launch URL or lecture counts. Add those values in the local course editor when available. [Udemy Business credentials and reporting setup](https://business-support.udemy.com/hc/en-us/sections/4419908023959-Account-settings) · [Udemy reporting field reference](https://s3.amazonaws.com/udemy-images/support/Udemy_for_Business_API_Reference_v2.0.pdf)

## Data and verification

The existing IndexedDB state stores course, enrollment, section, lecture, mapping, certificate, progress snapshot and sync records. Course-linked sessions live in the existing study ledger, so Analytics, Today, the calendar and study forecasts use the same records. Focused minutes contribute to dashboard totals. Measured playback remains a separate field. Timed sessions use the active start/stop intervals to reject overlaps and allow gaps while paused. Older date-only records have insufficient timestamp detail for overlap checks.

The roadmap supplies the skills, priorities, month and week references, tasks, project milestones and prerequisites behind suggestions. Update mappings manually at course or section level. Course completion and skill competency stay independent. Completion estimates use advances in tracked lecture counts across different days.

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:browser` and `npm run build`. The Business adapter has fixture coverage for filtering and safe pagination. Live Business verification requires authorized credentials.

