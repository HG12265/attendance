# Deployment guide

## Required services

- A Linux server with Docker and Docker Compose.
- A domain/subdomain pointing to that server.
- An authenticated MongoDB replica set, reachable only from the application server. Atlas can supply this.
- Optional SMTP credentials for password resets.
- A backup and monitoring owner.

Do not deploy the development MongoDB compose configuration. It intentionally has no authentication and is suitable only for local loopback access.

## Configure the release

1. Upload or clone the source onto the server.
2. Run `npm run setup` using Node 22+ to generate `backend/.env` without exposing secrets in command history.
3. Edit the file privately:

```dotenv
NODE_ENV=production
PORT=4000
APP_ORIGIN=https://attendance.your-college.edu
MONGODB_URI=mongodb+srv://<app-user>:<url-encoded-password>@<cluster>/attendly
AUTH_SECRET=<generated independent secret>
QR_SECRET=<generated independent secret>
TRUST_PROXY=1
ADMIN_NAME=<initial administrator name>
ADMIN_EMAIL=<initial administrator email>
ADMIN_PASSWORD=<unique temporary password>
SMTP_HOST=<optional mail server>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<optional user>
SMTP_PASSWORD=<optional secret>
MAIL_FROM=Attendly <attendance@your-college.edu>
```

Use an application database user with only the permissions necessary for the Attendly database. Enable database authentication, TLS and a network allowlist. The application uses transactions and refuses startup against a standalone MongoDB server.

4. Create a root `.env` file containing only your domain setting:

```dotenv
DOMAIN=attendance.your-college.edu
```

5. Build and initialize:

```sh
docker compose -f compose.production.yml build
docker compose -f compose.production.yml run --rm app node backend/src/bootstrap.js
```

6. Remove ADMIN_PASSWORD from `backend/.env` after successful bootstrap.
7. Start:

```sh
docker compose -f compose.production.yml up -d
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs --tail=100 app
```

Caddy handles HTTPS and forwards HTTP/WebSocket traffic. The application port is not publicly published. Allow inbound 80/443 only as needed; restrict administrative server access. `APP_ORIGIN` must match the exact external scheme and hostname.

8. Sign in over HTTPS and change the initial temporary password.
9. Complete the institution setup in README.
10. Execute the acceptance checks in OPERATIONS.md with separate admin, faculty and student accounts before entering real attendance.

## Why one origin?

The built frontend, API and Socket.IO connection are served at the same domain. No wildcard CORS is enabled. Refresh cookies are HttpOnly, Secure in production, and SameSite=Strict. Requests from an unexpected Origin are rejected. `TRUST_PROXY=1` is valid only for the included topology with exactly one trusted reverse proxy; do not blindly reuse it in another network topology.

## Local development database

`compose.dev.yml` initializes a one-member replica set on a loopback-published port. The host application connects using:

```text
mongodb://127.0.0.1:27017/attendly?replicaSet=rs0&directConnection=true
```

The `directConnection` setting avoids discovery of the Docker-internal hostname for this single-member development arrangement. Production should use the database provider's authenticated replica-set URI.

## Updating

1. Take and verify a database backup.
2. Run unit tests, integration tests and frontend build for the intended source revision.
3. Run the production dependency audit and review advisories.
4. Deploy the new image during a period with no active sessions where possible.
5. Check health, login, an authorized report and Socket.IO reconnect.
6. Keep the prior image available for rollback. Do not roll back schema changes without reviewing compatibility.

## SMTP

Configure a verified sender and SMTP service. Password reset sends only a short-lived single-use link; reset tokens are stored hashed. Test delivery, spam placement, domain records and expiry on your actual provider. This delivery does not send emails or configure a mail account.

## Scaling boundary

Keep one application process/container until shared state has been engineered and tested. A future multi-instance deployment needs:

- Socket.IO shared adapter and load-balancer session behavior appropriate to the transports.
- Shared rate limiting.
- Distributed scheduled-job leases.
- Bounded asynchronous reporting and measured database indexes for your dataset.
- Organization-aware authorization if multiple institutions share one deployment.

Database uniqueness and transactions protect records, but they do not by themselves provide scalable background jobs or cross-server socket rooms.
