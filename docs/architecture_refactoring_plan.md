# Architecture Refactoring Plan: LLM-Driven Semantic Extraction & Structured JSON Synthesis

## Executive Summary
This plan addresses two core architectural imbalances in the Village Daily Briefing System:
1. **Fragile Keyword Matching in Scripts**: Replace hardcoded regex/keyword selections in `docx-parser.js` and `events-source.js` with direct LLM semantic analysis over full document text.
2. **Token Waste on HTML Rendering**: Shift card markup generation out of the LLM prompt. The LLM will emit structured JSON items, and a deterministic template renderer will convert them into clean HTML cards.

---

## 🛠️ Step-by-Step Action Plan

### Step 1: Raw Text Extractor Refactoring (`scripts/utils/docx-parser.js` & `scripts/sources/`)
- Update `docx-parser.js` to return complete, clean text paragraphs from `.docx` files without applying restrictive keyword filters (`highwaysText`, `sendText`).
- Update `events-source.js` to supply raw section text from Warboys Diary PDFs.

### Step 2: Structured JSON Synthesis in Briefing Agent (`scripts/agent/briefing-agent.js`)
- Reconfigure `BriefingAgent` prompt to instruct Gemini/LLM to analyze raw text and return a structured JSON payload:
  ```json
  {
    "whatsOn": [ ... ],
    "villageNews": [ ... ],
    "governance": [ ... ],
    "planning": [ ... ]
  }
  ```
- LLM performs semantic analysis to extract top news-worthy governance decisions, filtering out administrative noise (apologies, quorum, minute sign-offs) automatically.

### Step 3: Deterministic HTML Template Component Renderer (`scripts/agent/template-renderer.js`)
- Build a lightweight, reliable template renderer (`template-renderer.js`) that takes the structured JSON items and renders uniform HTML cards for each block:
  - **Block 1**: `📅 What's On`
  - **Block 2**: `📰 Village News`
  - **Block 3**: `🏛️ Governance & Parish Council` (with top calendar banner link)
  - **Block 4**: `🏗️ Planning & Development (Past 30 Days)`

### Step 4: Verification & Test Execution
- Run `npm run ingest:mock && npm run build` to verify clean JSON generation, fast build times, and zero token waste on HTML tags.
- Run `npm run test:sources` to verify raw text extraction.
