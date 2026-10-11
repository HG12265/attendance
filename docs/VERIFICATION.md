# Verification record

Delivery date: 11 October 2026.

## Verified in the build environment

- Dependency installation completed with a lockfile.
- React/Vite production compilation succeeded.
- 20 security, policy, HTTP middleware and export-library tests passed.
- Syntax and import checks were used during implementation.
- Final `npm audit --omit=dev`: 0 known vulnerabilities (0 low, moderate, high or critical). This is a package-advisory check, not a full application security assessment.
- Nodemailer was updated to 10.1.0; UUID is overridden to 11.1.1 to address the older ExcelJS transitive dependency. Excel workbook serialization/readback passed with the override.

Unit tests cover QR signature, tampering, expiry, token audience separation, percentage policies, all-excused histories, faculty ownership, unique-index declarations, public profile redaction, password rules, Origin validation, mandatory password change, revoked token versions, HTTP authorization and token hashing. Database-backed behavior is not implied by unit tests that inspect schema indexes or use a stubbed identity lookup.

## Integration test status: blocked, not passed

A 21-case integration suite is included in `backend/test/integration.test.js`. It launches a temporary real MongoDB replica set and tests login, role scoping, session creation, concurrent duplicate scans, scan/close races, finalization, corrections/audit, reports, Excel/PDF, restart recovery, timetable conflicts, temporary passwords, token rotation and account deactivation.

In this execution environment MongoDB downloaded successfully, but its process terminated during startup with `open: Operation not permitted` (exit code 100). The before-hook therefore failed and the database tests did not execute. No claim is made that they passed. Run `npm run test:integration` on your machine or CI runner with permission to start MongoDB, then resolve any failures before deployment.

## Not verified here

- Native browser rendering and interactive browser QA (a supported browser-control capability was unavailable).
- Real phone camera permission/scanning.
- Docker image/Compose runtime execution (Docker was unavailable here).
- Actual MongoDB Atlas credentials/network and transaction behavior.
- SMTP mail delivery or password-reset emails.
- Public domain, TLS certificate or live deployment.
- Sustained peak-load performance, restore drills or independent security review.

## Release classification

This is a source-code deployment candidate with real backend implementation, not a hosted production certification. It should enter a staging acceptance phase before live institutional use. Remaining optional product features and practical dataset bounds are explicitly listed in README.
