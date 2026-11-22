# UFW Web Dashboard

A self-hosted web interface to monitor and manage your UFW firewall: see blocked connections, allow ports, remove rules and enable/disable the firewall from one page.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

## Features

- Instrument-panel dashboard with four tabs: Overview, Rules, Activity and Settings
- Overview: open-port, blocked-attempt, source-IP and targeted-port KPIs, targeted-port donut, TCP/UDP/ICMP breakdown, top sources and service categories
- Add allow or deny rules (TCP, UDP or both), remove rules, enable/disable the firewall
- Sortable rules table by port, action or protocol
- Activity: blocked attempts grouped by targeted port and source IP, filter by source, expandable rankings and the latest 15 connections
- Settings: choose how many log lines to analyse
- IPv4 and IPv6 support
- Login page with cookie sessions, CSRF protection and rate limiting
- Optional Docker image that manages the host firewall

## Requirements

- Node.js >= 18.0.0
- UFW (Uncomplicated Firewall) and a Linux system with root/sudo access

## Installation

```bash
git clone https://github.com/bob6664569/ufw-web-dashboard.git
cd ufw-web-dashboard
npm ci
cp .env.example .env
nano .env                 # set F_USER and F_PASS
sudo npm start
```

Open `http://localhost:3300` and sign in with the credentials from `.env`.

## Run with Docker

```bash
cp .env.example .env
nano .env                 # set F_USER and F_PASS
docker compose up -d --build
```

The container uses `network_mode: host` and `NET_ADMIN` because it manages the **host** firewall. It also needs:

- `/etc/ufw` mounted read-write (rules live here)
- `/etc/default/ufw` and `/var/log/ufw.log` mounted read-only
- the same iptables backend as the host (nftables on Debian/Ubuntu 22.04+)

Notes:

- The container runs as root, which `ufw` requires. Anyone who can sign in can change the host firewall: keep `HOST=127.0.0.1` and put a reverse proxy with HTTPS in front for remote access.
- Sessions are kept in memory, so restarting the container signs everyone out.
- The healthcheck calls the public `/health` endpoint.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3300` | Server port |
| `HOST` | `127.0.0.1` | Bind address |
| `NODE_ENV` | `production` | Environment (production/development) |
| `F_USER` | *required* | Login username |
| `F_PASS` | *required* | Login password |
| `AUTH_MAX_FAILED_ATTEMPTS` | `5` | Failed logins before the IP is blocked |
| `AUTH_BLOCK_DURATION` | `900000` | Block duration in ms (15 min) |
| `SESSION_TTL` | `43200000` | Session idle timeout in ms (12 h) |
| `LOG_MAX_LINES` | `10000` | Max log lines to parse |
| `LOG_DEFAULT_LINES` | `1000` | Default lines to analyse |
| `LOG_CACHE_TTL` | `5000` | Cache TTL in ms (5 sec) |
| `LOG_MAX_CACHE_SIZE` | `10` | Max cache entries |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in ms (15 min) |
| `CSRF_TOKEN_EXPIRY` | `3600000` | CSRF token expiry in ms (1 hour) |
| `MIN_PASSWORD_LENGTH` | `12` | Minimum password length |
| `MIN_USERNAME_LENGTH` | `4` | Minimum username length |

### UFW Setup

```bash
sudo apt install ufw
sudo ufw enable
sudo ufw logging on
sudo ufw status
```

## Testing

```bash
npm test              # Unit and security tests (node:test, no dependencies)
npm run test:unit     # Unit tests only
npm run test:security # Security tests
```

Integration tests (`npm run test:integration`) expect a running server on `127.0.0.1:3300` and are skipped by default.

## Security

- Login page with an HttpOnly, SameSite=Strict session cookie (12 h idle timeout)
- CSRF tokens on every mutation, bound to the client fingerprint
- Timing-safe credential comparison
- Failed-login blocking per IP and a general request rate limit
- Strict Content Security Policy; no CDN or third-party assets

Put the app behind a reverse proxy with HTTPS and restrict access to trusted IPs for production use.

## Project Structure

```
ufw-web-dashboard/
├── index.js                 # Entry point and middleware wiring
├── src/
│   ├── config.js            # Centralized configuration
│   ├── middleware/          # Session, CSRF, rate limiting, security, validation
│   ├── routes/              # Login/logout and API endpoints
│   ├── services/            # UFW and log parsing logic
│   ├── utils/               # Logger, error handler, validation, audit, client info
│   ├── public/              # app.css, app.js, logic.js, login.js
│   └── views/               # index.html, login.html
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

## API Endpoints

All `/api/*` endpoints require a session cookie. Mutations also require an `X-CSRF-Token` header.

| Endpoint | Description |
|----------|-------------|
| `GET /login` | Login page |
| `POST /login` | Sign in (form-encoded) |
| `POST /logout` | Sign out |
| `GET /health` | Health check (public) |
| `GET /api/whoami` | Client IP |
| `GET /api/csrf-token` | One-time CSRF token |
| `GET /api/rules` | Firewall status and rules |
| `POST /api/rules` | Add a rule (`port`, `protocol` = `tcp`/`udp`/`both`, `type` = `allow`/`deny`, `source`) |
| `DELETE /api/rules/:id` | Remove a rule by id |
| `POST /api/rules/enable` | Enable UFW |
| `POST /api/rules/disable` | Disable UFW |
| `GET /api/logs?lines=N` | Blocked-attempt statistics (`byPort`, `byProto`, `byIp`, `ipPorts`, `recent`) |

## License

MIT

## Author

Johan Massin - johan@trilogik.net

## Contributors

Mostly written by an AI (Claude via Cursor) while the human occasionally nodded in approval and asked for fewer emojis.

## Tech Stack

- Express.js
- Vanilla JavaScript, HTML and CSS (no build step, no CDN)
- Node.js `node:test`
