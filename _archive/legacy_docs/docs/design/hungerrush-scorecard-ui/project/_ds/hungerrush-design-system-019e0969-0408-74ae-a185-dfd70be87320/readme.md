# HungerRush Design System

The design system for **HungerRush** — the all-in-one restaurant management, online-ordering,
POS and marketing platform. It is a **Material UI (MUI v6)** foundation re-themed with
HungerRush's brand palette (jade green primary, sea-blue secondary) and extended with the
custom **Restaurant Manager (RM)** product surfaces (dark-navy navigation, store selector, etc.).

> Source of truth: **MUI Design System.fig** (Figma, mounted read-only during authoring).
> Brand mark + RM navigation come from the file's `Custom-Components` page; tokens come from
> the file's Figma Variable collections (`material/colors`, `palette`, `typography`, `spacing`,
> `breakpoints`, `shape`). Product name & version string ("Powered by HungerRush LLC. v24.08.12.1650")
> are taken verbatim from the file.

---

## Product context

HungerRush helps independent and multi-unit restaurants run ordering, delivery, loyalty,
marketing and reporting from one console. The flagship admin app is **Restaurant Manager (RM)** —
a left-nav web console whose top-level areas are: Dashboard, Reporting, Manage (Coupon, Dynamic
Codes, Images, Menu, Brand Menus, Store Menus, Menu Schedules, Roles, Stores & Groups, System,
Users), People, Communicate, Inventory, Loyalty, Marketing, Display, and HungerRush Only.

Two typographic themes ship: **Roboto** for the web console and **Inter** for the mobile app
(`:root[data-mode="mobile-app"]`). A full **dark mode** is included (`:root[data-theme="dark"]`).

---

## CONTENT FUNDAMENTALS

How HungerRush product copy reads:

- **Voice**: plain, operational, restaurant-operator-facing. Functional over playful — this is
  back-of-house software people use on a busy Friday night.
- **Person**: imperative for actions ("Publish menu", "Add user", "Export"); third-person/neutral
  for labels and status ("Out for delivery", "Last active"). Rarely first-person.
- **Casing**: **Title Case** for nav destinations and page headings ("Brand Menus", "User
  management" — note sentence-case is also used for page titles). **UPPERCASE** only on buttons and
  overlines (MUI button convention, `letter-spacing .4px`). Sentence case for body and helper text.
- **Domain nouns**: Store, Menu, Brand Menu, Store Menu, Coupon, Role, Order, Ticket, Channel
  (online / phone / walk-in / third-party), "86'd" (item unavailable).
- **Numbers**: real and specific — money as `$4,210` / `$22.88`, deltas as `+12%`, time as `13m` /
  `2 min ago`. Never invent vanity stats.
- **Emoji**: none in product UI. Icons carry meaning instead (Material Symbols).
- **Tone example**: *"Menu published to all 12 stores."* · *"3 items below par level."* ·
  *"Scheduled maintenance tonight at 2 AM."*

---

## VISUAL FOUNDATIONS

- **Color**: Primary = **Jade `#0E8476`** (`--primary-main`, the brand teal seen in the cloud-H
  logo and primary buttons). Secondary = **Sea Blue `#35508C`**. Semantic error/warning/info/success
  follow MUI (`--error-main` etc.). Neutrals are MUI grey 50–900. The RM sidebar is a distinct
  **navy `rgb(26,35,61)`** (`--hr-nav-bg`) — darker and bluer than any grey.
- **Type**: Roboto across the console; MUI scale (h1 96/300 → caption 12/400). Headings are light
  (300–400) and large; labels/buttons are medium (500) and uppercase. The **HungerRush wordmark is
  Nunito Sans Bold** — used only in the logo lockup, never for UI text.
- **Spacing**: strict **8px grid** (`--hr-space-*`). Page padding 32px; card padding 16–24px;
  nav rows 60px.
- **Corner radius**: small and consistent — **4px** base (`--hr-radius`), pills for chips/avatars/
  switches. Nothing is heavily rounded.
- **Elevation**: MUI's three-layer shadow scale (`--hr-shadow-1…24`, rgba 0.2 / 0.14 / 0.12).
  Cards sit at elevation 1; app bar at 4; menus/dialogs at 8–24. Outlined variants drop the shadow
  for a 1px `--elevation-outlined` border instead.
- **Surfaces / cards**: white, 4px radius, elevation-1 shadow OR a hairline outline. No colored
  left-border accents, no gradients.
- **Backgrounds**: flat. Content canvas is `--grey-100`; surfaces are white. No imagery washes,
  textures or gradients in chrome. Real food photography appears only inside menu/content cards.
- **Imagery**: warm, appetizing food photography (menu items, store cards). No B&W, no heavy grain.
- **Borders**: 1px, `--divider` (rgba 0,0,0,.12) for table rows / dividers; `--*-outlinedborder`
  (50% alpha of the role color) for outlined controls.
- **Animation**: restrained. Short 0.2s ease transitions on hover/expand; indeterminate progress &
  skeleton shimmer loop only while loading. No bounces or decorative motion.
- **Hover**: subtle wash — `--action-hover` (4% black) on rows/icon buttons; section rows in the
  navy sidebar lighten via `rgba(255,255,255,0.08)`. Outlined/text buttons tint toward their color.
- **Press / selected**: `--action-selected` / `--*-states-selected` (8% tint) fills the row or
  control; no shrink transform.
- **Transparency & blur**: used sparingly — backdrops behind dialogs (`--components-backdrop-fill`,
  50% black). No frosted-glass chrome.

---

## ICONOGRAPHY

- **System**: **Google Material Symbols (Rounded)** — the same Material Icons the Figma file uses
  (its RM nav references Material icon names: `dashboard`, `monitoring`, `build`, `groups`, `chat`,
  `warehouse`, `loyalty`, `campaign`, `desktop_windows`, `lock_open`, …).
- **Delivery**: loaded from Google Fonts in `tokens/fonts.css`; use
  `<span class="material-symbols-rounded">icon_name</span>`. Add class `filled` for the filled axis.
  Default 24px, weight 400, matching the console.
- **Brand mark**: the teal **cloud-H** icon — `assets/hungerrush-icon.png` (32px in the nav lockup).
- **Emoji / unicode as icons**: not used in product UI.

---

## Index — what's in this system

**Foundations (root CSS)**
- `styles.css` — global entry point (import-only). Consumers link this.
- `tokens/fig-tokens.css` — Figma Variables: full color palettes, semantic palette, spacing,
  typography, breakpoints, shape — Light / Dark / mobile-app modes.
- `tokens/fonts.css` — webfonts (Roboto, Inter, Nunito Sans, Roboto Mono) + Material Symbols.
- `tokens/typography.css` — MUI type scale (`--text-*`, `.hr-h1…overline`).
- `tokens/brand.css` — px spacing/radius, elevation shadows, RM nav surface tokens.

**Components** (`components/`, namespace `window.HungerRushDesignSystem_019e09`)
- `forms/` — Button, IconButton, TextField, Select, Checkbox, Radio, Switch
- `data-display/` — Typography, Chip, Badge, Avatar, AvatarGroup, Tooltip, Divider
- `feedback/` — Alert, LinearProgress, CircularProgress, Skeleton, Dialog
- `surfaces/` — Card (+ Header/Media/Content/Actions), Paper, Accordion
- `navigation/` — Tabs, Breadcrumbs, Pagination, Stepper

**UI kits** (`ui_kits/`)
- `restaurant-manager/` — interactive RM console: sidebar, top bar, Dashboard, Brand Menus, Users.

**Guidelines** (`guidelines/`) — foundation specimen cards shown in the Design System tab.

**Assets** (`assets/`) — `hungerrush-icon.png` (brand cloud-H mark).

**`SKILL.md`** — Agent Skill manifest for using this system in Claude Code.

---

## Caveats
- Webfonts and Material Symbols load from Google Fonts (CDN). For fully offline use, self-host the
  binaries and swap the `@import`s in `tokens/fonts.css` for `@font-face`.
- This is a generous **core** of MUI primitives re-themed for HungerRush, not all 178 MUI component
  families in the source file. The token system is complete (all collections + modes).
