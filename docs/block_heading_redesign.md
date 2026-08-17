# Implementation Plan: Distinct Block Headings & HTML Header Banner

Fix literal markdown hashes (`###`) appearing in section block headers and redesign section block headers to feature distinct background banners.

---

## Goal Description

### 1. Fix Literal Hashes (`###`)
- Hashes appeared literally on screen because Markdown headers (`###`) placed inside block-level HTML (`<div class="briefing-block">`) are ignored by standard Markdown parsers.
- Replace literal markdown `###` with structured HTML `<div class="briefing-block-header"><h3 class="briefing-block-title">...</h3></div>`.

### 2. Distinct Block Header Banners
- Style `.briefing-block-header` with a distinct background header banner (`--color-tag-bg` tint), subtle bottom border, rounded top corners, and bold serif typography.
- Move block content into `.briefing-block-content` with padding.

---

## User Review Required

> [!IMPORTANT]
> **Block Header Banner Structure**:
> All section blocks (Planning & Development, Council & Governance, Village News) will feature styled header banners with custom background styling. No `###` hashes will appear in rendered text.

---

## Open Questions
- *None*.

---

## Proposed Changes

### 1. Agent & Briefing Generator (`scripts/agent/briefing-agent.js`)
- Update system prompt and fallback generator to wrap block titles in `<div class="briefing-block-header"><h3 class="briefing-block-title">...</h3></div>` and block bodies in `<div class="briefing-block-content">`.

### 2. Stylesheet (`src/public/css/style.css`)
- Add styles for `.briefing-block-header`, `.briefing-block-title`, and `.briefing-block-content`.

---

## Verification Plan

### Automated Tests & Pipeline Checks
1. `npm run ingest:mock`: Verify briefing HTML generated contains structured header banners without `###` hashes.
2. `npm run build`: Verify Eleventy static site compiles cleanly.

### Manual Verification
1. Inspect `src/briefings/2026-08-14.md` and preview the site at `http://localhost:8080` to verify block header background styling.
