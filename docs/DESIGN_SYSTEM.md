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

## Four Screen Personality

Home:
Briefing / calm / selective.

Team:
Efficient / scannable / comparative.

Employee:
Analytical / contextual / detailed.

1:1 Preparation:
Calm / distilled / meeting-focused.

## Components

Build reusable components for:
- MetricValue
- TrendIndicator
- StatusBadge
- EmployeeRow
- AttentionItem
- BriefingSection
- DataFreshness
- MetricTable
- Sparkline
- ContextItem
- PeriodSelector
- EmptyState
- ErrorState
- LoadingSkeleton

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
