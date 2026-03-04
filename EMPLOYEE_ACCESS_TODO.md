# Employee Access Rollout TODO

## Goal
Add secure employee login with role-based module visibility, lead assignment, and internal collaboration comments.

## Phase 1: Authentication
- [x] Add `users` table (`id`, `name`, `email`, `password_hash`, `active`, `created_at`, `updated_at`)
- [x] Add auth endpoints: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- [x] Hash passwords with a strong KDF (`scrypt`)
- [x] Use secure HTTP-only cookie sessions
- [x] Add `requireAuth` middleware for protected routes
- [x] Add initial admin seed user

## Phase 2: Roles and Module Permissions
- [x] Add `roles`, `user_roles` tables (role-module mapping tables pending)
- [x] Define initial roles: `Owner`, `Manager`, `Sales`, `Marketing`
- [x] Define module keys in frontend access map: `dashboard`, `sales`, `crm`, `social_posts`, `tasks`, `message_board`, `alphaos`, `admin`
- [x] Add API to read/update user roles (`/api/admin/roles`, `/api/admin/users`, role/password patch endpoints)
- [x] Add backend role guard middleware for admin routes (`Owner` required)
- [x] In frontend, hide tabs/screens user cannot access by role
- [x] Add admin user management UI for create/roles/active/reset-password
- [x] Add authenticated self-service password change flow

## Phase 3: CRM Ownership and Assignment
- [ ] Add `owner_user_id` to `crm_leads` (nullable for migration safety)
- [ ] Add assignment endpoint (`PATCH /api/crm/leads/:id/assign`)
- [ ] Add “My Leads” and “Team Leads” filters
- [ ] Restrict Sales role to assigned leads (unless manager override)

## Phase 4: Lead Comments and Message Board
- [ ] Add `crm_lead_comments` table
- [ ] Add comment endpoints: list/create per lead
- [ ] Add `board_posts` and `board_comments` tables
- [ ] Add message-board endpoints and permission checks
- [ ] Add frontend UI for comments with timestamps + author names

## Phase 5: Hardening and Auditability
- [ ] Add `audit_log` table for role changes, assignments, and sensitive edits
- [ ] Add rate-limit on login endpoint
- [ ] Add failed login tracking and lockout threshold
- [ ] Add session timeout + logout-all capability
- [x] Add basic admin user management page

## Test + Rollout Checklist
- [x] Backend build passes (`pos-dashboard-backend`)
- [x] Frontend build passes (`WOLF-FD`)
- [x] Manual auth flow test (login/logout/me)
- [ ] Permission tests for each role
- [ ] Lead assignment test across roles
- [ ] Message board visibility and comment permissions verified
- [x] Deploy and verify live endpoints
