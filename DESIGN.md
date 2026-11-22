# Design

## World and mode

Surface mode: **Operate**. This is an instrument panel. Familiarity, scanability and consistency outrank expression. The visual world is a quiet operations console: neutral graphite surfaces, hairline borders, one indigo accent, restrained color reserved for state and data. Reference register: Linear/Vercel dashboards. No imagery, no illustration, no gradient washes.

## Direction

- **Product:** single-host UFW console with log-derived traffic analytics, for people who manage firewalls.
- **Character:** calm, exact, instrumental.
- **World:** a network operations room — instruments, readouts, status lights, quiet panels.
- **Moments:** the blocked-traffic area chart is the one rich data moment. A single sparkline in the "Blocked attempts" KPI is the second.
- **Signature:** a small live status dot next to the firewall switch, using semantic color only.

## Tokens

Define as CSS custom properties in `web/src/index.css` and map to Tailwind theme.

### Dark (default)

| Token | Value | Use |
| --- | --- | --- |
| `background` | `#09090B` | page |
| `surface` | `#0F0F12` | cards, sidebar |
| `surface-2` | `#16161A` | raised controls, table header |
| `surface-3` | `#1C1C21` | hover, active row |
| `border` | `#232329` | hairline |
| `border-strong` | `#32323A` | control border |
| `foreground` | `#FAFAFA` | primary text |
| `muted` | `#A1A1AA` | secondary text |
| `faint` | `#71717A` | meta text |
| `accent` | `#6366F1` | primary action, selection |
| `accent-foreground` | `#FFFFFF` | text on accent |

### Light

| Token | Value |
| --- | --- |
| `background` | `#FAFAFA` |
| `surface` | `#FFFFFF` |
| `surface-2` | `#F4F4F5` |
| `surface-3` | `#E4E4E7` |
| `border` | `#E4E4E7` |
| `border-strong` | `#D4D4D8` |
| `foreground` | `#18181B` |
| `muted` | `#52525B` |
| `faint` | `#71717A` |
| `accent` | `#4F46E5` |
| `accent-foreground` | `#FFFFFF` |

### Semantic

State only, never decoration: `success #34D399`, `danger #F87171`, `warn #FBBF24`, `info #38BDF8`. In light theme use darker variants for text contrast: `#047857`, `#B91C1C`, `#B45309`, `#0369A1`. Semantic colors may appear as a dot, badge, border tint or chart series, never as a surface wash.

### Chart

One accent series plus neutral steps. Multiple hues allowed only when they encode different real categories (e.g. TCP vs UDP). The old five-hue palette is retired.

## Typography

- Family: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. No custom font, no download.
- Fixed rem scale, ratio 1.125–1.2. Sizes: 12, 13, 14, 16, 20, 24 px equivalents.
- Weights: 400 body, 500 labels and controls, 600 headings only. No 700+.
- Headings sentence case. No uppercase tracked labels. No letter-spacing below 0 on text under 20px; large headings may use `-0.02em`.
- Figures use `tabular-nums`, one number format across the app.
- No italic.

## Spacing and shape

- 4px grid. Scale: 4, 8, 12, 16, 20, 24, 32.
- Same thing, same size. Table rows one height. Icons one column, labels one line.
- Nested radius: 8 controls, 12 cards, 16 panels. Inner radius = outer minus padding.
- Borders are 1px hairlines at 6–10% opacity.
- No hue gradients, no glow, no colored shadows, no blurred color blobs.
- Dark theme depth comes from surface steps, not shadows. Light theme uses small neutral shadows only on overlays.

## Motion

- Library: `motion` (`motion/react`). One shared spring: `{ type: 'spring', bounce: 0, duration: 0.3 }`.
- Momentum spring `{ bounce: 0.2, duration: 0.4 }` only for a gesture that actually carries velocity. No drag exists in this product; do not add one.
- Animate only `transform`, `opacity`, `color`, `background-color`, `border-color`. Never width, height, top, left, margin or large blur.
- Allowed: tab and nav active indicator via `layoutId`, switch and theme thumb, dialog/sheet enter from trigger, toast slide, tooltip fade+rise, number tween, banner dismiss.
- Banned: page-load choreography, staggered entrances, looping pulse, hover scale, decorative parallax.
- `prefers-reduced-motion: reduce` replaces all spring/slide with a 150ms opacity cross-fade and no transform.
- Feedback timing: 120–150ms for press/hover color, 200–300ms for state transition.

## Components

Use shadcn/ui source components: `Sidebar`, `Button`, `Switch`, `Badge`, `Card`, `Tabs`, `Table`, `Input`, `Select`, `Label`, `AlertDialog`, `Dialog`, `Toast`, `Skeleton`, `Empty`, `Separator`, `Tooltip`, `DropdownMenu`, `ScrollArea`.

Every interactive component has default, hover, focus, active, disabled, loading and error states. Skeletons for loading. Empty states that explain the next action.

## Charts

From the `@bklit` shadcn registry:

| Surface | Chart |
| --- | --- |
| Overview trend | `AreaChart` (single accent series) |
| Blocked KPI | `Sparkline` |
| Targeted ports / protocols | `PieChart` (donut) and `BarChart` (one series) |
| Activity top ports | `BarChart` (horizontal, one series) |

Chart chrome: muted grid, muted mono labels, no uppercase day labels, no rainbow bars within one series. One main chart clearly largest.

## Layout

- Shell: fixed 256px sidebar (brand, four nav items, firewall status, theme, sign out) plus topbar (page title, status pill, firewall switch, refresh).
- Desktop-first. Sidebar collapses to a top strip on narrow screens; tables get horizontal scroll, not squeezed text. Minimum readable text 11px.
- Content max width 1440px. Cards align to the grid. One primary action and at most one secondary per view.
- Login: quiet centered card, same tokens, brand mark, fields, reveal-password, inline error.

## Surfaces

- **Overview:** four KPI cards (one sparkline only), large area chart, donut and bar cards, two ranked lists.
- **Rules:** three mini stats, add-rule form, sortable data table with badges and confirmed remove.
- **Activity:** bar chart, IP ranking, recent-connections table with source filter and refresh.
- **Settings:** log-lines form, system key/value list, theme control.
- **Feedback:** alert dialog for destructive actions, toast for write results, banner for unhealthy firewall state.

## Non-goals

No illustrations or generated imagery. No command palette. No drag interactions. No multi-host support. No change to the Express API or auth rules beyond JSON error responses for the React login.
