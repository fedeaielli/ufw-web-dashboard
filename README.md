# UFW Web Dashboard

A simple web interface to monitor and manage your UFW firewall. View blocked connections, manage rules, and analyze attack patterns in real-time.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

## Features

- Real-time monitoring of blocked connection attempts
- Visual analytics with charts and graphs
- Manage firewall rules (add/remove ports)
- IPv4 and IPv6 support
- Analyze attack patterns by port, IP, and protocol
- Secure authentication and CSRF protection
- Clean, responsive interface

## Requirements

- Node.js >= 18.0.0
- UFW (Uncomplicated Firewall)
- Linux system with sudo access

## Installation

1. Clone the repository
   ```bash
   git clone https://github.com/bob6664569/ufw-web-dashboard.git
   cd ufw-web-dashboard
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment
   ```bash
   cp .env.example .env
   nano .env
   ```

   Set your credentials in `.env`:
   ```env
   PORT=3300
   HOST=0.0.0.0
   
   # Change these!
   F_USER=admin
   F_PASS=your-secure-password
   
   LOG_MAX_LINES=10000
   LOG_DEFAULT_LINES=1000
   ```

4. Start the server
   ```bash
   sudo npm start
   ```

5. Open `http://localhost:3300` in your browser

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3300` | Server port |
| `HOST` | `127.0.0.1` | Server host |
| `NODE_ENV` | `production` | Environment (production/development) |
| `F_USER` | *required* | Username for authentication |
| `F_PASS` | *required* | Password for authentication |
| `AUTH_MAX_FAILED_ATTEMPTS` | `5` | Max failed auth attempts before blocking |
| `AUTH_BLOCK_DURATION` | `900000` | Block duration in ms (15 min) |
| `LOG_MAX_LINES` | `10000` | Max log lines to parse |
| `LOG_DEFAULT_LINES` | `1000` | Default lines to display |
| `LOG_CACHE_TTL` | `5000` | Cache TTL in ms (5 sec) |
| `LOG_MAX_CACHE_SIZE` | `10` | Max cache entries |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in ms (15 min) |
| `CSRF_TOKEN_EXPIRY` | `3600000` | CSRF token expiry in ms (1 hour) |
| `MIN_PASSWORD_LENGTH` | `12` | Minimum password length |
| `MIN_USERNAME_LENGTH` | `4` | Minimum username length |

### UFW Setup

Make sure UFW is installed and logging is enabled:

```bash
sudo apt install ufw
sudo ufw enable
sudo ufw logging on
sudo ufw status
```

## Testing

```bash
npm test              # Run all tests (node:test native, zero dependencies)
npm run test:unit     # Unit tests only
npm run test:security # Security tests
```

## Security

Basic security measures are in place (authentication, CSRF protection, rate limiting). For production use, put it behind a reverse proxy with HTTPS and restrict access to trusted IPs.

## Project Structure

```
ufw-web-dashboard/
├── index.js                 # Entry point
├── src/
│   ├── config.js           # Centralized configuration
│   ├── middleware/         # Auth, CSRF, rate limiting, security, validation
│   ├── routes/             # API endpoints (logs, rules, health)
│   ├── services/           # UFW and log parsing logic
│   ├── utils/              # Logger, error handler, validation, audit, client info
│   └── views/
│       └── index.html      # Frontend (Alpine.js + Tailwind CSS)
├── .env.example
└── package.json
```

## API Endpoints

- `GET /` - Dashboard interface
- `GET /health` - Health check (no auth required)
- `GET /api/whoami` - Get your IP address
- `GET /api/rules` - List firewall rules
- `POST /api/rules` - Add a firewall rule
- `DELETE /api/rules/:id` - Remove a rule
- `GET /api/logs` - Get blocked attempts stats
- `POST /api/rules/enable` - Enable UFW
- `POST /api/rules/disable` - Disable UFW
- `GET /api/csrf-token` - Get CSRF token

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

## License

MIT

## Author

Johan Massin - johan@trilogik.net

## Contributors

Mostly written by an AI (Claude via Cursor) while the human occasionally nodded in approval and asked for fewer emojis.

## Tech Stack

- Express.js
- Alpine.js
- Tailwind CSS
- Chart.js
