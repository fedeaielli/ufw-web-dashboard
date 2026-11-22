# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + Tailwind CSS v4 + shadcn/ui, with chart components from the `@bklit` shadcn registry. The existing Express API stays; the React app is the frontend. The previous vanilla HTML/CSS/JS frontend is replaced.

## Users

Operators and administrators who manage UFW on one Linux host through a browser. The dashboard is distributed to customers, so it must read clearly without prior training. Primary situation: desktop, checking firewall state, changing rules, investigating blocked traffic.

## Product Purpose

Monitor and manage UFW on a host. Success means three jobs, in order: see firewall state and recent blocks within seconds; add or remove rules without mistakes; investigate blocked connections from parsed logs.

## Positioning

A single-host UFW console that turns raw firewall logs into blocked-traffic analytics without a separate log stack. Rule state and traffic evidence live in one view.

## Operating Context

- Authenticated browser session, desktop-first.
- UFW status and rules read from the host through the server.
- Blocked-traffic analytics derived from the last N log lines (100–50,000).
- Rule mutations are destructive on the host and need confirmation.
- Login is public; everything else requires a session. CSRF token required on mutations.

## Capabilities and Constraints

- API endpoints stay unchanged: `GET/POST/DELETE /api/rules`, `/api/rules/enable`, `/api/rules/disable`, `GET /api/logs`, `GET /api/whoami`, `GET /api/csrf-token`, `POST /login`, `POST /logout`.
- Session auth, rate limiting, same-origin login check, CSP with `script-src 'self'` must be preserved.
- Four surfaces: Overview, Rules, Activity, Settings, plus sign-in.
- Dark and light themes.
- Desktop-first responsive; WCAG 2.2 AA and reduced-motion support required.
- No image assets: the interface is an instrument panel, not a marketing surface.

## Brand Commitments

- Name: `Firewall Manager`.
- Mark: shield with check, existing SVG path.
- Voice: plain, specific, operational. No hype, no exclamation marks.

## Evidence on Hand

- Current UI: `src/views/index.html`, `src/views/login.html`, `src/public/app.css`, `src/public/app.js`, `src/public/logic.js`.
- Pure data helpers with tests: `src/public/logic.js`, `tests/utils/`.
- API routes: `src/routes/`, services: `src/services/`.
- No existing PRODUCT.md or DESIGN.md before this redesign.

## Product Principles

1. State first: firewall status and block volume visible before detail.
2. Safe mutation: confirm destructive rule removal; show clear feedback on every write.
3. Quiet chrome: neutral surfaces, one accent, color only for meaning.
4. Familiar affordances: standard SaaS navigation and form controls, no invented widgets.
5. Respect the user: reduced motion, visible focus, readable density.

## Accessibility & Inclusion

Desktop-first layout with responsive collapse. WCAG 2.2 AA contrast, visible keyboard focus, operable tables and dialogs, `prefers-reduced-motion` cross-fade instead of spring motion.
