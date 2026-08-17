# Implementation Plan: PlanIt Planning Extractor & Responsive Section Block Layout

Upgrade the **Huntingdonshire District Council Planning Module** (`scripts/sources/hdc-planning-source.js`) to use **PlanIt API** as the primary source, expanding coverage to a **30-day window** with application lifecycle tracking (**New**, **Updated**, **Finished/Decided** with explicit decision outcomes), **latest-first ordering**, and **responsive section blocks**.

---

## Goal Description

### 1. PlanIt API Primary Source & 30-Day Window
- **Primary Source: PlanIt API (`planit.org.uk`)**:
  - Bypasses Idox anti-bot protections by querying `https://www.planit.org.uk/api/applics/json?auth=Huntingdonshire&kwords=Warboys`.
  - Sets window to 30 days (`maxDays = 30`) to cover all active, recent, and decided applications from the previous month.
- **Application Lifecycle & Decision Tracking**:
  - **🆕 New Applications**: Validated or registered in the last 30 days.
  - **🔄 Updated / In Progress**: Active applications undergoing consultation or assessment.
  - **🏁 Finished / Decided**: Decisions issued in the last 30 days, explicitly displaying the final verdict (*Permitted / Approved*, *Refused*, *Approved with Conditions*, *Withdrawn*).
- **Latest First Ordering**: All planning items are sorted chronologically descending by date.

### 2. Responsive UI & Section Block Architecture
- Briefing content rendered as distinct, self-contained section blocks/cards:
  - 🏗️ **Planning & Development** (sub-grouped into New, In Progress, and Decided with decision badges).
  - 🏛️ **Council & Local Governance**.
  - 📰 **Village News & Community**.
- Modern responsive layout (fluid card containers, mobile-friendly spacing, dark/light theme support).

---

## User Review Required

> [!IMPORTANT]
> **30-Day Planning Lifecycle Coverage**:
> The planning block will aggregate all applications from the past month, categorizing them into New, In Progress, and Decided (showing official decision outcomes). Latest applications will always appear at the top.

---

## Open Questions
- *None*. Requirements for PlanIt primary provider, 30-day lookback, decision outcomes, latest-first order, and responsive section blocks are aligned.

---

## Proposed Changes

### 1. Ingestion Engine (`scripts/sources/` & `scripts/agent/`)

#### `[MODIFY]` `scripts/sources/hdc-planning-source.js`
- Query PlanIt API with `maxDays = 30`.
- Categorize records:
  - `statusCategory`: `'NEW'`, `'UPDATED'`, or `'DECIDED'`.
  - `decisionOutcome`: Outcome text if decided (*Approved*, *Refused*, *Withdrawn*).
- Sort items by date descending (latest first).

#### `[MODIFY]` `scripts/agent/briefing-agent.js`
- Prompt LLM to format the Planning section into sub-groups:
  - 🆕 **New Applications**
  - 🔄 **Updates & In Progress**
  - 🏁 **Decided Applications** (highlighting the decision status)
- Ensure items within each block are ordered latest date first.

---

### 2. Templates & Responsive Styling (`src/`)

#### `[MODIFY]` `src/public/css/style.css`
- Add CSS classes for section blocks (`.briefing-section-block`), lifecycle status pills (`.status-pill-new`, `.status-pill-decided`, `.status-pill-updated`), and responsive grid/card styling.

#### `[MODIFY]` `src/_includes/layouts/briefing.njk` & `src/index.njk`
- Render briefing content in styled, responsive section blocks.

---

## Verification Plan

### Automated Tests & Pipeline Checks
1. **Source Extractor Test**:
   - `npm run test:sources`: Verify `HdcPlanningSource` queries PlanIt API with 30-day window, extracts decisions, and orders latest first.
2. **Pipeline Ingestion & Site Build**:
   - `npm run ingest:mock`: Verify LLM agent formats New, Updated, and Decided planning items.
   - `npm run build`: Verify Eleventy static site compiles cleanly.

### Manual Verification
1. **Responsive UI Test**:
   - Inspect site on desktop and mobile viewports. Verify section blocks collapse gracefully and decision badges render clearly.
