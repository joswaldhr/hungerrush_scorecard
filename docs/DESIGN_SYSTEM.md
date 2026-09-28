# HungerRush Cadence — Design System v0.1

## Design Goal

Cadence should feel like a premium modern SaaS product built for HungerRush.

It should be:
- calm
- clear
- confident
- data-centric
- restrained
- fast

It should not feel like:
- a BI portal
- a spreadsheet
- an AI-generated dashboard
- a marketing website

## Brand

Use the HungerRush logo and existing brand identity as the foundation.

Primary visual identity:
- HungerRush navy
- HungerRush teal
- neutral white/off-white surfaces
- dark text
- restrained semantic status colors

Do not invent a competing brand identity for Cadence.

## Visual Hierarchy

Information priority:

1. What matters
2. Why it matters
3. Supporting evidence
4. Detail

Do not give every metric equal visual weight.

## Screen Personality

Home redirects to Team (no standalone Home page currently).

Team:
Efficient / scannable / comparative.

1:1s:
Calm / distilled / meeting-focused.

## Components

Reusable components in `src/components/`:
- MetricValue
- StatusBadge
- DataFreshness
- MetricCategoryTable
- MetricIcon
- TeamRosterTable
- TeamFilters
- StatCard
- Sidebar / SidebarClient
- SyncStalenessBanner
- ScorecardExport
- EmptyState
- ErrorState
- ViewAsBanner

Route-local admin components (not shared, live beside the page that uses them):
- VisibilityEditor (`src/app/(app)/admin/metric-visibility/`) — the bulk metric-visibility form

UI primitives in `src/components/ui/` (shadcn/Radix):
- Avatar
- Badge
- Button
- Card
- Dialog
- RadioGroup
- Separator
- Skeleton

Components must be domain-generic.

## Charts

Prefer:
- sparklines
- simple line charts
- simple comparison bars

Avoid:
- 3D
- gauges
- radial charts
- decorative pie/donut charts
- excessive visualization

## Motion

Use subtle transitions only where they improve orientation or feedback.

No decorative animation.

## Responsive Behavior

Desktop-first because managers are expected to use Cadence primarily on computers.

Support common laptop widths without requiring horizontal scrolling for core workflows.

## Accessibility

Maintain readable contrast.
Do not communicate status through color alone.
Use semantic HTML.
Support keyboard navigation for interactive controls.
Use accessible labels for charts and status indicators.

## Visual Reference Policy

Approved mockups are visual references for:
- hierarchy
- density
- spacing
- interaction intent
- overall visual direction

They are not permission to hard-code sample names, metrics, values, or layouts that conflict with responsive or configurable requirements.

## September 28, 2026 visual refresh

The current product entry is 1:1s; Team/Home references above are historical. The
picker uses a restrained navy/teal introduction, a dedicated search/sort toolbar,
visible team and line headings and larger employee tiles. Counts describe only the
server-authorized employee list; they are not performance summaries.

Scorecards separate employee identity from reporting controls. Category headers use
readable sentence case, tables use 13px text, tabular numerals and a subtle current-week
column emphasis. All categories share fixed 30/18/18/16/18 column proportions. Source,
missing-data and duration explanations retain their existing meaning and visibility.
Narrow screens contain horizontal scrolling within keyboard-focusable named table
regions. Print uses one full-width category column to keep the five metric columns
readable. No rankings, derived summary measures or new meeting-management features
are introduced. Account controls sit at the foot of the navy navigation rail.
