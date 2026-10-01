# Mobile app — web functionality parity tracker

## Purpose

This document is the execution checklist for rebuilding the mobile app one page at a time.

The web frontend is the source of truth for functionality. The mobile app is for **final users only**. It must not reproduce platform super-admin, developer, or internal operational tooling.

For every item below, the implementing AI must:

1. Read the referenced web page and its imported components/hooks/API calls.
2. Copy the user-visible behavior and business rules, not only the visual layout.
3. Adapt the interaction to mobile: navigation, forms, file picking/camera, loading, empty, error, offline, and permission states.
4. Reuse the existing backend contracts unless a missing mobile-safe API is identified.
5. Test the completed flow on a small phone and a larger phone.
6. Mark the checkbox only after the full flow works end to end.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` verified · `[-]` intentionally excluded from mobile.

## Scope rules

### Keep in mobile

- Authentication and account recovery.
- User dashboard and personal/company workspace access.
- Document upload, processing, results, document viewing, extracted data review, validation, editing, and export.
- Classifiers and classes when they are part of the normal user workflow.
- Company membership features needed by normal company users and authorized company managers.
- User profile, account settings, privacy policy, invitations, and email verification.
- End-user notifications/activity and user-facing AI chat, if available to the logged-in user.

### Keep on web only

- Platform super-admin dashboard and platform-wide administration.
- Platform user management, billing reports, AI usage administration, and admin lab.
- Developer/API documentation, API keys, webhooks, and development-only routes.
- Internal operational control center: jobs kanban, assignments, analytics, queues, TODOs, internal queries, and operational chat/activity unless a later product decision explicitly exposes a safe end-user version.
- Any route whose purpose is system administration rather than completing a final user's document workflow.

## Recommended implementation order

Implement vertically, one complete user journey at a time:

1. Authentication and account recovery.
2. Dashboard and navigation shell.
3. Upload/process a document.
4. View and edit processing results.
5. Validate, audit, and export results.
6. Classifiers/classes.
7. Documents/history.
8. Company membership and invitations.
9. Profile/settings and secondary user features.

---

## A. Authentication and public pages

| Done | Web route | Web source | Mobile scope / acceptance criteria |
|---|---|---|---|
| [ ] | `/` | `src/app/page.tsx` | Public landing entry; route users to login/signup. |
| [ ] | `/login` | `src/app/login/page.tsx` | Login, validation, loading, failed login, persisted session, and redirect behavior. |
| [ ] | `/signup` | `src/app/signup/page.tsx` | Account creation, validation, success, and verification handoff. |
| [ ] | `/forgot-password` | `src/app/forgot-password/page.tsx` | Request password reset and show success/error states. |
| [ ] | `/email-verification` | `src/app/email-verification/page.tsx` | Verify account, resend verification, and handle expired/invalid links. |
| [ ] | `/invite/[inviteId]` | `src/app/invite/[inviteId]/page.tsx` | Accept company invitation, authenticate or create account, and finish membership setup. |
| [ ] | `/force-logout` | `src/app/force-logout/page.tsx` | Clear invalid session and return to login. |
| [ ] | `/privacy-policy` | `src/app/privacy-policy/page.tsx` | Read-only privacy policy. |

## B. Core final-user workflow

| Done | Web route | Web source | Mobile scope / acceptance criteria |
|---|---|---|---|
| [ ] | `/dashboard` | `src/app/dashboard/page.tsx` | User dashboard: relevant KPIs, recent activity/documents, quick actions, and correct company/user context. |
| [ ] | `/documents` | `src/app/documents/page.tsx` | Browse document history, search/filter if present, open a document/result, loading/empty/error states. |
| [ ] | `/process` | `src/app/process/page.tsx`, `src/app/process/tabs/Upload.tsx` | Upload one or more documents from files/camera where supported; select processing option; submit and show progress/errors. |
| [ ] | `/process/result/[processResultId]` | `src/app/process/result/[processResultId]/page.tsx` | Result workspace: document list, extracted values, classification, status, navigation, and refresh behavior. |
| [ ] | `/process/result/[processResultId]/document-viewer` | `src/app/process/result/document-viewer/page.tsx` | Mobile document/PDF/image viewer with zoom, page navigation, and result context. |
| [ ] | `/process/result/[processResultId]/audit` | `src/app/process/result/[processResultId]/audit/page.tsx` | User-visible audit/history timeline for the result. |
| [ ] | `/process/result/[processResultId]` — validation/editing | `src/app/process/result/components/ValidationTab.tsx`, `EditableExtractedValues.tsx` | Validate fields, edit extracted values, save, show conflicts/errors, and preserve unsaved-change behavior. |
| [ ] | `/process/result/[processResultId]` — export | `src/app/process/result/components/ExportButtons.tsx` | Export/download/share supported result formats through mobile-safe behavior. |

## C. Classifiers and classes

| Done | Web route | Web source | Mobile scope / acceptance criteria |
|---|---|---|---|
| [ ] | `/classifiers` | `src/app/classifiers/page.tsx` | List user/company classifiers, permissions, empty state, and open/create actions if available to final users. |
| [ ] | `/classifiers/[id]` | `src/app/classifiers/[id]/page.tsx` | Preserve web redirect/entry behavior for a classifier. |
| [ ] | `/classifiers/[id]/workspace` | `src/app/classifiers/[id]/workspace/page.tsx` and `components/` | Classifier workspace: documents, schema/classes, processing actions, matching, creation, and stuck/retry behavior exposed to the user. |
| [ ] | `/classes` | `src/app/classes/page.tsx` | User-facing class/model management only; exclude platform processing-model administration. |

## D. Company and collaboration

| Done | Web route | Web source | Mobile scope / acceptance criteria |
|---|---|---|---|
| [ ] | `/company` | `src/app/company/page.tsx` | Company context and normal member-facing company information. |
| [ ] | `/company/admin` | `src/app/company/admin/page.tsx` | Include only company-scoped actions explicitly authorized for a company manager (members, groups, assignments, integrations); never platform super-admin features. |
| [ ] | `/company/members/[userId]` | `src/app/company/members/[userId]/page.tsx` | Company manager can view/manage a member according to existing permissions. |
| [ ] | Company invitation flow | `src/app/company/components/InviteMember.tsx`, `src/app/invite/[inviteId]/page.tsx` | Invite, accept, reject/expire handling, and membership refresh. |

## E. User account

| Done | Web route | Web source | Mobile scope / acceptance criteria |
|---|---|---|---|
| [ ] | `/profile` | `src/app/profile/page.tsx` | View/edit personal details, profile loading/errors, and password change. |
| [ ] | `/settings` | `src/app/settings/page.tsx` | User settings, preferences, session/logout behavior, and supported account controls. |

## F. Existing web routes intentionally excluded from mobile

These routes remain web-only. Do not implement them in the final-user mobile app unless this document is explicitly changed.

| Status | Web route/group | Reason |
|---|---|---|
| [-] | `/admin`, `/admin/users/[userId]`, `/admin/ai-usage`, `/admin/billing-reports`, `/admin/lab` | Platform super-admin and internal administration. |
| [-] | `/development/**` | Developer/API workspace and duplicated development routes. |
| [-] | `/api-keys`, `/engine-api`, `/webhooks` | Developer integrations and API operations. |
| [-] | `/operational/**` | Internal operational dashboards, queues, jobs, analytics, assignments, TODOs, queries, and internal support tooling. |

## Route and product cleanup required before implementation

- [ ] Remove or hide mobile routes that expose `/admin/**`, `/development/**`, or `/operational/**`.
- [ ] Remove duplicate route aliases in `mobile/src/app/`; keep one canonical mobile route per user capability.
- [ ] Confirm the authenticated user/company role model before exposing company-manager screens.
- [ ] Confirm whether classifier/class creation is a final-user capability or web-only configuration.
- [ ] Confirm supported mobile file types, camera permissions, PDF/image viewing, downloads, and sharing.
- [ ] Confirm deep-link behavior for invitation, verification, password reset, and result URLs.
- [ ] Add a mobile navigation map based only on the sections A–E above.
- [ ] Do not mark a page complete because it renders; mark it complete only after its actions and backend integration are verified.

## Per-page handoff template for the implementing AI

Copy this block for each page being implemented:

```md
### [ ] `<page name>` — `<web route>`

- Web source:
- Mobile route:
- User role(s):
- Entry points:
- API calls/contracts:
- Main actions:
- Required states: loading, empty, error, success, offline, permission denied
- Mobile-specific decisions:
- Verification performed:
- Known gaps:
```

## Change log

| Date | Change |
|---|---|
| 2026-09-29 | Initial tracker generated from the current web App Router pages and mobile route inventory. |
