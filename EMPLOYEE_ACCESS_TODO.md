# Employee Access Rollout TODO

## Goal
Add secure employee login with role-based module visibility, lead assignment, and internal collaboration comments.

## Phase 1: Authentication
- [ ] Add `users` table (`id`, `name`, `email`, `password_hash`, `active`, `created_at`, `updated_at`)
- [ ] Add auth endpoints: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- [ ] Hash passwords with `bcrypt` or `argon2`
- [ ] Use secure HTTP-only cookie sessions
- [ ] Add `requireAuth` middleware for protected routes
- [ ] Add initial admin seed user

## Phase 2: Roles and Module Permissions
- [ ] Add `roles`, `user_roles`, `module_permissions`, `role_module_permissions` tables
- [ ] Define initial roles: `Owner`, `Manager`, `Sales`, `Marketing`
- [ ] Define module keys: `dashboard`, `crm`, `social_posts`, `message_board`, `admin`
- [ ] Add API to read/update user role + module access
- [ ] Add backend permission middleware (`requirePermission("crm.view")`)
- [ ] In frontend, hide tabs and screens user cannot access

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
- [ ] Add basic admin user management page

## Test + Rollout Checklist
- [ ] Backend build passes (`pos-dashboard-backend`)
- [ ] Frontend build passes (`WOLF-FD`)
- [ ] Manual auth flow test (login/logout/me)
- [ ] Permission tests for each role
- [ ] Lead assignment test across roles
- [ ] Message board visibility and comment permissions verified
- [ ] Deploy and verify live endpoints
