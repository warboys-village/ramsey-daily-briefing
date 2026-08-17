# Implementation Plan: Warboys Diary Events & Section Order Update

Add **Warboys Diary** (`https://www.warboysparishcouncil.gov.uk/our-community/warboys-diary/`) as an active data source, re-order daily briefing section blocks to **Events → News → Planning**, and sub-order events so **Today's Events** appear first, followed by **Upcoming Events**.

---

## Goal Description

### 1. New Source: Warboys Diary (`scripts/sources/events-source.js`)
- Ingests community events from the official Warboys Diary page.
- Extracts event titles, dates, locations/venues, and descriptions.
- Classifies event dates relative to current briefing date:
  - 📍 **Today's Events**: Occurring on today's date.
  - 📆 **Upcoming Events**: Occurring in upcoming days/weeks.

### 2. Section Block Order Specification
All briefings will strictly follow the section order:
1. 📅 **Community Events & What's On** (First)
   - 📍 **Today's Events** (sub-header top)
   - 📆 **Upcoming Events** (sub-header next)
2. 📰 **Village News & Governance** (Second)
   - Combines local news articles (*The Hunts Post*, Google News) and Parish/District Council meeting updates.
3. 🏗️ **Planning & Development** (Third)
   - 30-day lookback (New Applications, In Progress, Decided with decision statements).

---

## User Review Required

> [!IMPORTANT]
> **Strict Section Block Order**:
> 1st: **Events & What's On** (Today's events top → Upcoming events next)  
> 2nd: **Village News & Governance**  
> 3rd: **Planning & Development**  

---

## Open Questions
- *None*. Requirements for Warboys Diary integration, section ordering, and today/upcoming event sub-ordering are fully defined.

---

## Proposed Changes

### 1. Configuration (`village.config.json`)
- Add `warboys-diary` source entry pointing to `https://www.warboysparishcouncil.gov.uk/our-community/warboys-diary/`.

### 2. Extractor (`scripts/sources/events-source.js`)
- Create `EventsSource` to scrape HTML calendar/diary items.
- Include structured mock data covering Today's and Upcoming Warboys community events for dry-runs (`--mock`).

### 3. Ingestion Engine (`scripts/ingest.js` & `scripts/agent/briefing-agent.js`)
- Register `EventsSource` in `scripts/ingest.js`.
- Update `BriefingAgent` system prompt & fallback generator to strictly enforce:
  - Block 1: 📅 **Events & What's On** (Today top → Upcoming next)
  - Block 2: 📰 **Village News & Governance**
  - Block 3: 🏗️ **Planning & Development**

### 4. Stylesheet (`src/public/css/style.css`)
- Add styles for `.event-card`, `.badge-today`, `.badge-upcoming`.

---

## Verification Plan

### Automated Tests & Pipeline Checks
1. `npm run test:sources`: Verify `EventsSource` extracts events cleanly.
2. `npm run ingest:mock`: Verify daily briefing Markdown generates with **Events (Today -> Upcoming) -> News -> Planning** order.
3. `npm run build`: Verify Eleventy site builds without errors.

### Manual Verification
1. Inspect `src/briefings/2026-08-15.md` to confirm section ordering and event sub-grouping.
