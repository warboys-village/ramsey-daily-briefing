# Implementation Plan: Appealing Planning Cards UI Redesign

Redesign the **Planning & Development Section** to render individual planning items as visually appealing, responsive card components with small reference links, map links, color-coded stage badges, and decision callout boxes.

---

## Goal Description

### 1. Planning Card Layout (`.planning-card`)
- **Title at Top**: Prominent proposal heading (e.g. *Erection of single-storey rear extension and garage conversion*).
- **Small Reference Link**: Small, unobtrusive reference link at the top-right or meta row (e.g. `Ref: 26/00189/FUL` linking directly to the official planning portal page).
- **Address & Map Link**: Displays site address with a direct map icon link (`📍 14 High Street, Warboys (View on Map)`) querying Google Maps search.
- **Color-Coded Status Badges**:
  - 🔵 **New / Validated**: Soft blue badge (`badge-new`).
  - 🟡 **Under Consultation / In Progress**: Warm amber badge (`badge-progress`).
  - 🟢 **Approved / Permitted**: Mint green badge (`badge-approved`).
  - 🔴 **Refused**: Rose red badge (`badge-refused`).
  - ⚪ **Withdrawn**: Muted gray badge (`badge-other`).
- **Short Summary & Decision Statement Box**:
  - Readable application description.
  - Distinct callout box for decided items (`.planning-decision-box`) highlighting official decision text and conditions.

---

## User Review Required

> [!IMPORTANT]
> **Appealing Card Structure**:
> Planning items will no longer be simple bullet lists; they will render as rich, mobile-responsive HTML cards with map links and color-coded status badges.

---

## Open Questions
- *None*. Layout details (title top, small ref link, map link, color-coded badges, decision callout) match user directives.

---

## Proposed Changes

### 1. Source Extractor (`scripts/sources/hdc-planning-source.js`)
- Enrich items with `mapUrl`: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`.
- Assign exact `badgeClass` (`badge-approved`, `badge-refused`, `badge-new`, `badge-progress`, `badge-other`).

### 2. LLM Agent & Fallback Generator (`scripts/agent/briefing-agent.js`)
- Instruct LLM Agent and update fallback generator to format planning items into `<div class="planning-card">` HTML templates.

### 3. Styling (`src/public/css/style.css`)
- Add styles for `.planning-card`, `.planning-card-header`, `.planning-title`, `.planning-meta-row`, `.planning-ref-link`, `.map-link`, `.planning-decision-box`, and color-coded status badges.

---

## Verification Plan

### Automated Tests & Pipeline Checks
1. `npm run test:sources`: Verify `HdcPlanningSource` includes `mapUrl` and `badgeClass`.
2. `npm run ingest:mock`: Verify briefing generator outputs planning card HTML structures.
3. `npm run build`: Verify Eleventy static site compiles cleanly.

### Manual Verification
1. Inspect the planning cards on desktop and mobile viewports (`npm run dev`).
2. Test map links and official reference links.
