# Attendly

**A clear view of every classroom.**

A real MERN attendance application: React + Vite, Express on Node.js, MongoDB/Mongoose, and Socket.IO. Includes database-backed role authorization, signed rotating QR codes, enrollment snapshots, transactional attendance finalization, actual Excel/PDF exports, and responsive administration, faculty and student workspaces.

**Release status: implementation complete for the core scope below; deployment candidate, not production-certified.** Read [VERIFICATION.md](docs/VERIFICATION.md) before using live student data. No live hosting or production database has been configured. This package does not substitute a browser-only mock for a backend.

## Start here, nanba

1. Extract this ZIP.
2. Open the `attendly` folder in VS Code.
3. Install **Node.js 22+** and **Docker Desktop** (for local MongoDB). Alternatively, use your MongoDB Atlas replica-set URI.
4. In the VS Code terminal:

```sh
npm ci
npm run setup
```

5. Start the local development database:

```sh
docker compose -f compose.dev.yml up -d
```

Wait until `docker compose -f compose.dev.yml ps` reports MongoDB healthy. This local-only database is unauthenticated and binds its published port to `127.0.0.1`. Do not deploy the development compose file on a public server.

6. Open `backend/.env`. Setup has generated independent random signing secrets. Choose **one** initialization path:

**Explore with synthetic sample records**

Set `DEMO_PASSWORD` to your own unique password with at least 12 characters, uppercase, lowercase and a number. Then run:

```sh
npm run seed
npm run dev
```

Visit **http://localhost:5173**. Sample accounts:

| Role    | Email                     | Password                 |
| ------- | ------------------------- | ------------------------ |
| Admin   | admin@attendly.example    | Your DEMO_PASSWORD value |
| Faculty | faculty@attendly.example  | Your DEMO_PASSWORD value |
| Student | student1@attendly.example | Your DEMO_PASSWORD value |

The sample dataset is clearly named “Sample workspace”, has 12 students, 3 subjects, 14 historical sessions and synthetic attendance. No built-in default password exists. Seeding requires an empty database and never deletes data. Do not use these shared sample credentials in a live institution.

**Initialize your institution from scratch**

Set `ADMIN_EMAIL`, `ADMIN_NAME` and a unique `ADMIN_PASSWORD` in `backend/.env`:

```sh
npm run bootstrap
npm run dev
```

Sign in with those values, change the temporary password, and complete the setup sequence below. Remove `ADMIN_PASSWORD` from the environment after bootstrap. Bootstrap refuses to create an additional administrator when one already exists.

## First-time institution setup

1. Settings → set institution name, timezone, QR interval, late cutoff and shortage threshold.
2. Academics → Departments → add a department.
3. Academics → Classes → add academic year, semester and section.
4. Faculty → add faculty accounts.
5. Students → add accounts or use the JSON bulk import.
6. Academics → Subjects → add subjects.
7. Academics → Teaching assignments → connect faculty, class and subject.
8. Academics → Student enrollments → **Enroll entire class** for each assignment, or add individual enrollments.
9. Timetable → add weekly class periods.
10. Faculty signs in, changes the temporary password, and starts an attendance session.
11. Students sign in using their own accounts and scan the classroom QR.
12. End the session to finalize remaining students as absent. Export reports or make a reasoned manual correction.

Changing a student's class deactivates their existing enrollments; enroll them into the new class's subjects. Existing session rosters and attendance remain intact.

## What works in this implementation

| Area                | Included behavior                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication      | Hashed passwords; 15-minute access tokens kept in memory; rotating, hashed refresh tokens in HttpOnly cookies; logout revocation; first-login password change; SMTP reset links |
| Authorization       | Backend role checks; faculty ownership checks; student-scoped records; authenticated Socket.IO rooms                                                                            |
| Admin               | Student/faculty creation and edits, deactivation, temporary password reset, JSON bulk import, departments, classes, subjects, assignments, enrollments, timetable               |
| Academic operations | Class-wide enrollment, weekly schedule, overlapping period checks, retained academic history                                                                                    |
| QR attendance       | Signed expiring challenges, server-time verification, fixed session roster, duplicate unique index, transactional scan/close serialization                                      |
| Sessions            | Start, live updates with polling fallback, manual close, restart-recoverable auto-close, cancellation of active classes                                                         |
| Corrections         | Present, late, absent, excused; required reason; before/after audit record in the same transaction                                                                              |
| Reporting           | Date/class/subject filters, student–subject percentages, late policy snapshot, excused exclusion, Excel and PDF exports                                                         |
| Notifications       | In-app shortage notices, hourly evaluation, one notice per student/subject/day, read tracking                                                                                   |
| UI                  | Responsive green/ivory theme, locally bundled fonts, dashboards, charts, mobile scanner, tables, search, dialogs, errors and empty states                                       |
| Delivery            | Dockerfile, local replica-set compose, production reverse-proxy compose, CI workflow, tests, setup script, API guide and operating runbook                                      |

## Running a production build locally

```sh
npm run build
```

Set `APP_ORIGIN=http://localhost:4000` in `backend/.env`, keep `NODE_ENV=development`, then:

```sh
npm start
```

Visit http://localhost:4000. Express serves the built React frontend and APIs from one origin. Change `APP_ORIGIN` back to `http://localhost:5173` when returning to `npm run dev`.

Camera scanning works on localhost on the same device. A phone opening `http://<laptop-ip>` normally cannot use camera APIs; use an HTTPS deployment for real student phone tests. Do not disable browser security to work around this.

## Tests

```sh
npm run test:unit
npm run test:integration
npm run build
npm audit --omit=dev
```

The integration suite starts a **temporary real MongoDB replica set** using mongodb-memory-server. It needs permission to launch MongoDB and an initial binary download. It does not connect to or modify your configured institution database.

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for results actually obtained during this delivery. Do not assume a test passed just because its source is included.

## Deployment and operation

Read [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The recommended included topology is one Node application process behind Caddy HTTPS, with an authenticated MongoDB replica set such as Atlas. Socket.IO and scheduled processing are configured for a **single application instance**. Horizontal scaling requires a shared adapter, shared rate-limit storage and distributed job coordination.

Other documentation:

- [Architecture and business rules](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Operations and acceptance checklist](docs/OPERATIONS.md)
- [Verification and remaining boundaries](docs/VERIFICATION.md)

## Explicit boundaries

- No claim that QR scanning proves physical presence. Live QR sharing is still possible.
- No GPS, face recognition, device binding, parent SMS, payment plans or multi-tenant institution billing.
- No student-photo upload or automated emailed monthly report; in-app alerts and on-demand exports are implemented. Password-reset email requires configured SMTP.
- Bulk import currently accepts structured JSON, not arbitrary Excel/CSV files.
- Reports query up to 2,000 matching completed sessions and display up to 500 rows; use narrow date filters. Directory/catalog endpoints cap at 5,000 users and 10,000 enrollments. This release is not an unlimited university-scale data warehouse.
- The timetable is a weekly plan. Faculty starts sessions explicitly; holidays and substitutions are handled by admin changes and class cancellation rather than an academic-calendar engine.
- UI labels are English. Dates in the UI use the device locale/timezone; report date filters and exported dates are explicitly UTC. The configured institution timezone labels the timetable.
- Native browser QA, phone camera checks, production SMTP, Docker deployment, backup restoration and peak-load tests still require the deployment environment.

A production launch should follow institutional acceptance, security review and the operational checks, not just a successful frontend build.
