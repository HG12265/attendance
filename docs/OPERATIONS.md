# Operating and accepting Attendly

## Daily operation

- Monitor `/api/health`, process restarts, request errors and database availability.
- Confirm overdue sessions close within roughly 30 seconds after their end time while the application is online.
- Investigate missing periods without inventing attendance: use a reasoned manual correction after institutional review.
- Watch for unusual sign-in attempts and requests near configured rate limits.
- Use one application instance with the included deployment configuration.

## Backups and retention

Configure encrypted database backups in your database service or an operations system. Keep backup credentials separate from the web application. Define retention, restore access and student-data deletion policies with your institution. Do not store unencrypted database dumps in the source repository.

Before launch, restore a backup to a separate test database and compare user, session, attendance and audit counts. Re-run a sample report. A scheduled backup is not a verified recovery plan until restoration has succeeded.

## Account lifecycle

Create faculty and students with individual temporary passwords; deliver them securely. First login forces a password change. Use account deactivation when a person leaves, preserving historical attendance. Transfer students by changing class and explicitly enrolling the new assignments. Reassign faculty at the assignment level; old session ownership stays recorded.

Administrator password recovery uses SMTP or the administrator's authenticated password-change flow. Do not modify database hashes casually. Bootstrap is intentionally restricted to an empty administrator population.

## Acceptance checks before real students

| Check                            | Expected result                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| Admin and student role isolation | Student cannot read `/users`, audit or another person's reports                     |
| Faculty assignment               | Faculty cannot start/read another faculty's session                                 |
| Temporary credentials            | First sign-in blocks data until password changes                                    |
| Mobile camera                    | Real Android and iPhone browsers scan over HTTPS                                    |
| QR expiry                        | Old/tampered code is rejected; current enrolled student succeeds                    |
| Concurrency                      | 60+ distinct authenticated students submit at once without lost records             |
| Duplicate scans                  | One session–student record only                                                     |
| Scan/close race                  | Either accepted before closure or rejected, with consistent final roster            |
| Restart                          | Open expired sessions finalize after the application returns                        |
| Database outage                  | No success confirmation for an unsaved attendance entry                             |
| Cancellation                     | Active cancelled class is excluded from all percentages                             |
| Manual correction                | Reason, before value, after value and actor are retained                            |
| Late/excused                     | Late follows historical policy; excused does not inflate absences                   |
| Export                           | Excel/PDF match filtered authorized report data                                     |
| SMTP recovery                    | Delivered link works once and expires after 30 minutes                              |
| Session revocation               | Password change/deactivation invalidates previous tokens                            |
| Backup restore                   | Restored records and reports match a verified source snapshot                       |
| Timetable                        | Days, room, faculty and local institutional times are correct                       |
| Accessibility                    | Keyboard focus, dialog closure, forms, error announcements and mobile zoom verified |

## Suggested load exercise

Run the included MongoDB integration tests first. On a staging environment, create 60 unique enrolled test students and start one session. Obtain a current signed QR as faculty. Using a load tool, authenticate distinct users, submit the same current challenge for each, then close the session and check the database count equals the original eligible roster. Repeat across QR expiry and process restarts. Do not load-test production student data or interpret the small automated suite as a throughput benchmark.

## Maintenance boundaries

The worker finalizes every 30 seconds and evaluates shortages hourly. Notification records are daily deduplicated. Reports are deliberately bounded; narrow filters for older histories and plan indexed aggregation/pagination before moving to substantially larger datasets. Audit records have no UI delete action, but they are not a tamper-proof external compliance ledger. Database administrators retain database-level authority.
