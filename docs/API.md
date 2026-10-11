# REST API guide

All application routes use `/api`. Except health and the public authentication endpoints, send `Authorization: Bearer <access-token>`. Send JSON bodies with `Content-Type: application/json`. Browser mutations send the configured Origin. Keep the HttpOnly refresh cookie in the browser.

Errors are `{ "error": "Human-readable explanation" }`. Validation errors use 400, missing/expired identity 401, insufficient permission 403, missing records 404, and duplicates/state conflicts 409. Failed server operations return a generic 500 without stack traces.

## Authentication

| Method | Path           | Input / result                                                   |
| ------ | -------------- | ---------------------------------------------------------------- |
| POST   | /auth/login    | `{email,password}` → `{token,user}` plus refresh cookie          |
| POST   | /auth/refresh  | Rotates refresh cookie → `{token,user}`                          |
| POST   | /auth/logout   | Revokes all refresh credentials and current access-token version |
| GET    | /auth/me       | Public profile of authenticated user                             |
| POST   | /auth/password | `{currentPassword,newPassword}`; revokes credentials             |
| POST   | /auth/forgot   | `{email}`; requires configured SMTP                              |
| POST   | /auth/reset    | `{token,newPassword}`; one-time recovery                         |

## Catalog and people

| Method | Path                | Access                                                            |
| ------ | ------------------- | ----------------------------------------------------------------- |
| GET    | /catalog            | Role-scoped academic lookup data, settings; people only for admin |
| GET    | /users              | Admin                                                             |
| POST   | /users              | Admin; `{name,email,code,role,password,classId?,departmentId?}`   |
| PATCH  | /users/:id          | Admin; profile fields and `isActive`; no role change              |
| POST   | /users/:id/password | Admin; non-admin targets; `{password,reason}`                     |
| POST   | /users/import       | Admin; `{rows:[student objects]}`; max 500; atomic batch          |
| POST   | /enroll-class       | Admin; `{assignmentId}`; enroll active students in class          |

New accounts require a password change before normal application access. Account deactivation preserves history. Changing class deactivates old enrollments. Other administrators cannot be edited through the ordinary user-management endpoint.

## Academic resources

Admin may POST a new record or PATCH an existing `/:id` at each resource path below. GET `/catalog` supplies resource lists.

| Resource     | Fields                                                   |
| ------------ | -------------------------------------------------------- |
| /departments | name, code                                               |
| /classes     | name, departmentId, academicYear, semester               |
| /subjects    | name, code, departmentId                                 |
| /assignments | facultyId, subjectId, classId, isActive                  |
| /enrollments | studentId, assignmentId, isActive                        |
| /timetable   | assignmentId, day (0–6), startTime/endTime (HH:mm), room |

Assignment class/subject and enrollment identities are immutable. Deactivate and create a new relation instead. Timetable periods alone support DELETE `/timetable/:id`; all removals are audited.

## Attendance

| Method | Path                     | Input / behavior                                          |
| ------ | ------------------------ | --------------------------------------------------------- |
| GET    | /sessions                | Most recent 200 role-scoped sessions                      |
| POST   | /sessions                | Admin/assigned faculty; `{assignmentId,durationMinutes?}` |
| GET    | /sessions/:id            | Session details, authorized roster and attendance         |
| GET    | /sessions/:id/qr         | Admin/owner faculty; `{token,expiresAt,serverTime}`       |
| POST   | /attendance/scan         | Student; `{token}` → `{record,alreadyMarked}`             |
| POST   | /sessions/:id/close      | Admin/owner faculty; atomic absence finalization          |
| POST   | /sessions/:id/cancel     | Admin/owner faculty; `{reason}`; active session only      |
| PATCH  | /sessions/:id/attendance | Admin/owner faculty; `{studentId,status,reason}`          |

Session duration is 5–240 minutes. Session roster cap is 500. Correction statuses are `present`, `late`, `absent`, `excused`; reasons must contain at least 5 characters. Server time is authoritative. Students cannot retrieve classroom QR challenges or submit another student's identity.

## Reports and administration

| Method | Path                    | Behavior                                       |
| ------ | ----------------------- | ---------------------------------------------- |
| GET    | /dashboard              | Role-scoped counts, trends and recent sessions |
| GET    | /reports                | `{rows,summary,scope}`                         |
| GET    | /reports/export         | XLSX or PDF binary response                    |
| GET    | /settings               | Current institutional policy                   |
| PATCH  | /settings               | Admin; full policy object                      |
| GET    | /audit                  | Admin; latest 500 read-only events             |
| GET    | /notifications          | Own latest 100 alerts                          |
| POST   | /notifications/:id/read | Marks own alert read                           |
| GET    | /health                 | Public readiness; 503 without Mongo connection |

Report query parameters: `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, `classId`, `subjectId`; export adds `format=xlsx|pdf`. Dates are explicitly UTC and the result cap is 2,000 completed sessions. Frontend tables display at most 500 report rows; exports contain all records returned for the matching session set.

Policy fields: `collegeName`, `timezone`, `threshold` (0–100), `qrSeconds` (15–120), `lateMinutes` (0–120), `sessionMinutes` (5–240), `lateCounts` (boolean).

## Socket protocol

Connect Socket.IO to the same origin with `auth: {token: accessToken}`. The socket handshake validates active identity. Emit `watch-session` with a session ID and acknowledgement callback. Only administrators and the session's owning faculty may join. The server emits `attendance-updated: {sessionId}` after a committed scan, close or correction. Re-fetch the authorized REST session endpoint; do not infer saved state solely from an event. The UI also polls every 10 seconds so a missed event is recoverable.

Socket connections expire after 15 minutes. REST continues to refresh credentials and polling remains available; reopening a session restores a fresh realtime connection.
