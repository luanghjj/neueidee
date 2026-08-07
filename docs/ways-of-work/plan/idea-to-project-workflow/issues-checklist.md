# Issues Checklist — Idea-to-Project Workflow (Neuidee)

> Companion to `project-plan.md`. Use as the runbook for creating GitHub issues.
> Work items are cross-referenced to the actual code so each issue links to the files to change.

## Pre-Creation Preparation

- [x] Feature artifacts complete: DESIGN.md + working codebase reviewed
- [x] Epic defined: **Idea-to-Project Workflow**
- [ ] Epic issue created (use template in `project-plan.md`)
- [ ] Project board created with 6 columns + custom fields (Priority, Value, Component, Estimate, Sprint, Epic)
- [ ] Team capacity assessed (solo dev, ~5 pts/week)

## Epic Level

- [ ] **Epic issue**: `Epic: Idea-to-Project Workflow` — labels `epic, priority-high, value-high`
- [ ] **Milestone**: `Release 1.0` created and linked
- [ ] Epic card on board → **Backlog**

## Feature Level (one issue each)

| # | Feature | Estimate | Code anchor | Labels |
|---|---------|----------|-------------|--------|
| F1 | Idea Capture & Management | M | `js/app.js: openCaptureModal, bindCapture` | `feature, priority-high, value-high, ideas` |
| F2 | Idea Journey & Stages | M | `js/app.js: openIdeaDetail, bindSwipe, swipeAdvance` | `feature, priority-high, value-medium, ideas` |
| F3 | Project Showcase | M | `js/app.js: openProjectModal, saveProject, openProjectDetail` | `feature, priority-high, value-high, projects` |
| F4 | Share & Live Chat | L | `js/data.js: initRealtime, shareProject`, `js/app.js: openShareCenter` | `feature, priority-high, value-high, realtime` |
| F5 | AI Assistant | L | `js/app.js: bindAIChatEvents`, `api/ai.js` | `feature, priority-high, value-high, ai` |
| F6 | Profile & Activity | S | `js/app.js: renderHeatmap, renderReSpark` | `feature, priority-medium, value-medium, profile` |

## Story / Enabler / Test Level

### F1 — Idea Capture & Management
- [ ] **S1** `user-story` 3pts — Capture idea with text, tags, images
  - Files: `js/app.js` `openCaptureModal`/`saveIdea`; `js/data.js` `addIdea`
  - DoD: media compressed via E1; persists offline; toast "Idee erfasst ⚡"
- [ ] **S2** `user-story` 2pts — Search, filter & sort ideas
  - Files: `js/app.js` `renderIdeas`, `bindIdeasControls`; `index.html` controls
  - DoD: search, stage filter, tag filter, sort work together
- [ ] **S3** `user-story` 1pt — Soft-delete with 5s undo
  - Files: `js/app.js` `softDeleteIdea`
  - DoD: undo restores; hard delete after timeout; archived/pending hidden from lists
- [ ] **E1** `enabler` 3pts — Media compression utility
  - Files: `js/data.js` `compressImage`
  - DoD: 900px/0.82 downscale, EXIF orientation, graceful failure

### F2 — Idea Journey & Stages
- [ ] **S4** `user-story` 2pts — Advance AND go back across stages (Funke→…→Fertig)
  - Files: `js/app.js` `openIdeaDetail` (`btn-idea-advance`, `btn-idea-back`)
  - DoD: prev/next buttons appear conditionally; timeline entries written; confetti on advance
- [ ] **S5** `user-story` 2pts — Swipe gesture with one-time hint
  - Files: `js/app.js` `bindSwipe`, `hideSwipeHint`; `index.html` `#swipe-hint`
  - DoD: right=advance, left=archive, vertical scroll not hijacked, hint one-time (localStorage)
- [ ] **S6** `user-story` 2pts — Timeline & history in detail sheet
  - Files: `js/app.js` idea detail "Verlauf" block
  - DoD: entries show stage dot + label + author + relative time
- [ ] **E2** `enabler` 2pts — Stage config & state model
  - Files: `js/app.js` `stages`, `stageOrder` (line ~32)
  - DoD: single source for labels/icons/colors; archived handled separately

### F3 — Project Showcase
- [ ] **S7** `user-story` 3pts — Create project from idea (no auto-archive)
  - Files: `js/app.js` `saveProject` conversion branch
  - DoD: idea keeps its stage; timeline entry "In Projekt … umgewandelt"; `projectId` linked; new project auto-opens
- [ ] **S8** `user-story` 3pts — Edit project (status, tags, link, cover)
  - Files: `js/app.js` `openProjectModal`, `setProjCoverUI`, `bindProjectForm`; `index.html` `#proj-cover-*`
  - DoD: cover upload/preview/remove; chips persist; fields round-trip on reopen
- [ ] **S9** `user-story` 2pts — Project detail with progress bar
  - Files: `js/app.js` `openProjectDetail`, `progressStep`
  - DoD: 4-step progress reflects status; source-idea link navigates back
- [ ] **E3** `enabler` 1pt — Cover upload + compression wiring
  - Files: `js/app.js` `bindProjectForm` cover handler
  - DoD: reuses E1; failure → toast, no corruption

### F4 — Share & Live Chat
- [ ] **S10** `user-story` 3pts — Share project with friend by nickname
  - Files: `js/data.js` `shareProject`; `js/app.js` `quickShareIdea`, `openShareCenter`
  - DoD: no hidden project creation (confirm first); recipient notified via realtime
- [ ] **S11** `user-story` 3pts — Notifications center + browser push
  - Files: `js/data.js` notification storage; `js/app.js` `renderNotifBadge`, `openNotifCenter`; `index.html` `#modal-notif-center`
  - DoD: unread badge, mark read/all-read, Notification API toast on live events
- [ ] **S12** `user-story` 5pts — Realtime live chat on project
  - Files: `js/data.js` `handleLiveComment`; `js/app.js` `addCardComment`
  - DoD: two-device comment sync <2s; notifications for mentions/replies
- [ ] **E4** `enabler` 3pts — Realtime subscription layer
  - Files: `js/data.js` `initRealtime`; `supabase_schema.sql` (add `shares` to publication)
  - DoD: INSERT subscription; re-init after nickname set; graceful offline
- [ ] **E5** `enabler` 2pts — Notification storage + badge
  - Files: `js/data.js` `addNotification`, `unreadNotifCount`
  - DoD: persisted, idempotent, cleared correctly

### F5 — AI Assistant
- [ ] **S13** `user-story` 5pts — UI prototype generator
  - Files: `js/app.js` prototype modal; `api/ai.js`
  - DoD: generated HTML preview + save to idea `prototypeHtml`
- [ ] **S14** `user-story` 3pts — AI chat per idea
  - Files: `js/app.js` `bindAIChatEvents`
  - DoD: chat history persisted; clear-history confirm (line ~1903)
- [ ] **E6** `enabler` 2pts — AI proxy endpoint + key handling
  - Files: `api/ai.js`, `js/data.js` key config
  - DoD: key never on client in prod build

### F6 — Profile & Activity
- [ ] **S15** `user-story` 2pts — Activity heatmap
  - Files: `js/app.js` `renderHeatmap`
  - DoD: 56-day bins by idea count; German tooltips
- [ ] **S16** `user-story` 2pts — Re-spark reminders (stale sparks >1 week)
  - Files: `js/app.js` `renderReSpark`
  - DoD: max 3, tappable → opens idea
- [ ] **S17** `user-story` 3pts — Export / import JSON
  - Files: `js/app.js` profile actions
  - DoD: round-trip fidelity; destructive-import confirm
- [ ] **S18** `user-story` 2pts — German i18n across screens
  - Files: `index.html`, `js/app.js`, `js/data.js`
  - DoD: no DE-mixed-with-VN strings; toasts/comments localized

## Definition of Done (shared)
- [ ] Acceptance criteria met
- [ ] Code review approved
- [ ] `node --check js/app.js js/data.js` passes
- [ ] Smoke test on `localhost:8085` (server.js)
- [ ] Offline + online persistence verified
