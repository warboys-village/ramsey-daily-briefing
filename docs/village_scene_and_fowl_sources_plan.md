# Implementation Plan: Village Scene, FOWL, Deep Minutes Analysis & News Cards UI

Comprehensive upgrade to add **Village Scene Magazine** and **Friends of Warboys Library (FOWL)**, implement **LLM-summarized News Cards**, enable **Council Meeting Minutes multi-item extraction** (routing upcoming events into Block 1), and add **Regular Event badges**.

---

## Goal Description

### 1. Nice News Cards with LLM-Generated Summaries (`.news-card`)
- Every news item (*The Hunts Post*, *Google News*, *Village Scene*, *FOWL Blog*) is rendered as a modern card component:
  - **Headline & Source Badge**: Title top with source pill (e.g. *The Hunts Post*, *FOWL Blog*) and date.
  - **LLM Key Takeaways Summary**: Structured summary paragraphs highlighting the main points and village impact.
  - **Direct Citation**: `(Source: [Publisher](URL))` link.

### 2. Deep Analysis & Multi-Item Extraction for Council Meeting Minutes
- Rather than a single generic summary for an entire meeting document:
  - The pipeline & LLM Agent analyze meeting minutes (Warboys Parish Council, HDC meetings) and split them into **multiple distinct village topic items** (e.g. *Play Equipment Repairs*, *Highways & Speed Limits*, *Village Hall Maintenance*).
  - **Event Cross-Routing**: Any upcoming event mentioned in meeting minutes (e.g. *Village Fair*, *Annual Parish Meeting*) is extracted and routed directly into **Block 1: Community Events**!

### 3. Regular Event Badges
- Classify community events with visual badges:
  - `Regular Event` (e.g., Weekly Library Storytime, Monthly Farmer's Market, Weekly Lego Club).
  - `Special Event` (e.g., Annual May Day Fete, One-off History Talk).
  - Badges rendered with distinct CSS pill styling (`.badge-regular`, `.badge-special`).

### 4. New Data Sources
- **Village Scene Magazine** (`https://www.villagescene.co.uk/`): Scrapes past PDF issues via `pdf-parse`.
- **Friends of Warboys Library (FOWL)** (`https://fowl.org.uk/`): Crawls `/listing/library/` (regular events) and `/blog/` (news announcements).

---

## User Review Required

> [!IMPORTANT]
> **Minutes Splitting & Event Extraction**:
> - Meeting minutes will produce multiple distinct topic cards for key council decisions.
> - Mentioned events inside minutes will automatically appear in **Block 1: Community Events**.
> - News stories will feature structured LLM bullet summaries.
> - Events will display `Regular Event` vs `Special Event` badges.

---

## Open Questions
- *None*.

---

## Proposed Changes

### 1. Configuration (`village.config.json`)
- Add `village-scene` and `fowl-library` source entries.

### 2. Extractors (`scripts/sources/`)
- `[NEW] scripts/sources/village-scene-source.js`: Scrapes past editions for latest PDF and parses text.
- `[NEW] scripts/sources/fowl-source.js`: Crawls FOWL `/listing/library/` (regular events) and `/blog/` (news).
- `[MODIFY] scripts/sources/parish-council-source.js`: Extracts detailed meeting topics and detects mentioned upcoming event dates.

### 3. LLM Agent & Ingestion Engine (`scripts/agent/briefing-agent.js`)
- Instruct LLM Agent to:
  - Format News items into `.news-card` containers with key takeaways.
  - Split meeting minutes into individual topic items and route mentioned events to Block 1.
  - Apply `.badge-regular` or `.badge-special` to event items.

### 4. Stylesheet (`src/public/css/style.css`)
- Add CSS for `.news-card`, `.badge-regular`, `.badge-special`, `.news-key-points`.

---

## Verification Plan

### Automated Tests & Pipeline Checks
1. `npm run test:sources`: Verify `VillageSceneSource`, `FowlSource`, `ParishCouncilSource` extract items cleanly.
2. `npm run ingest:mock`: Verify briefing HTML generates with News Cards, Minutes multi-item splitting, event cross-routing, and Regular Event badges.
3. `npm run build`: Verify Eleventy static site compiles cleanly.

### Manual Verification
1. Inspect `src/briefings/2026-08-15.md` to confirm news card summaries, minutes topic cards, and regular event badges.
