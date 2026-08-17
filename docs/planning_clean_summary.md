# Implementation Plan: Clean Planning Summary Text

Strip redundant metadata prefixes (`Reference: ...`, `Address: ...`, `Status: ...`) from the planning card summary paragraph, leaving only the clean proposal narrative text.

---

## Goal Description
Since Reference, Address, Map Link, Status Badge, and Decision Statement are already explicitly rendered in dedicated card header elements and badges, repeating them inside `<p class="planning-summary">` is redundant.

### Before:
```html
<p class="planning-summary">Reference: 26/00142/OUT. Address: Land North of Ramsey Road, Warboys. Status: Under Consultation. Updated highways authority report and revised site layout drawing submitted.</p>
```

### After:
```html
<p class="planning-summary">Updated highways authority report and revised site layout drawing submitted.</p>
```

---

## User Review Required

> [!IMPORTANT]
> **Clean Proposal Summaries**:
> Metadata elements (Reference link, Address, Map link, Status badge, Decision callout) remain in their dedicated UI positions, while the main paragraph text contains exclusively clean application narrative.

---

## Open Questions
- *None*.

---

## Proposed Changes

### 1. Source Extractor (`scripts/sources/hdc-planning-source.js`)
- Format `content` property to contain only the application proposal summary, without `Reference: ...`, `Address: ...`, or `Status: ...` prefixes.

### 2. LLM Agent & Fallback Generator (`scripts/agent/briefing-agent.js`)
- Instruct LLM Agent and fallback generator to output clean proposal summary text in `<p class="planning-summary">` without repeating metadata.

---

## Verification Plan

### Automated Tests & Pipeline Checks
1. `npm run ingest:mock`: Verify generated briefing HTML contains clean summary text.
2. `npm run build`: Verify Eleventy static site compiles cleanly.

### Manual Verification
1. Inspect `src/briefings/2026-08-14.md` to confirm absence of redundant metadata prefixes in planning summary paragraphs.
