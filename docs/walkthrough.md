# Walkthrough: Direct Hunts Post RSS, 5-Layer Death Notice Filtering & Streamlined GitHub Actions Workflow

Implemented direct news ingestion from **The Hunts Post** (`https://www.huntspost.co.uk/news/rss`), full-text article extraction, village location filtering (`Warboys`), a 5-layer death notice pre-filtering system, and streamlined `.github/workflows/daily-briefing.yml` for zero-secret Git-driven Cloudflare deployment.

---

## 🛠️ Summary of Accomplishments

### 1. Cloudflare Secret Optimization ([`.github/workflows/daily-briefing.yml`](file:///home/dsample/code/village-daily/.github/workflows/daily-briefing.yml))
- **Answered User Question**: No Cloudflare API keys/tokens are required in GitHub Repository Secrets.
- **Workflow Streamlining**: Removed redundant `cloudflare/pages-action` step. When GitHub Actions commits new daily briefing files to `main`, Cloudflare Pages automatically detects the git push and builds/deploys the site live to **[https://daily.warboys.uk](https://daily.warboys.uk)**.
- **Secrets Summary**: The only secret required in GitHub Actions is `LLM_API_KEY` (free Gemini API key).

### 2. Direct Hunts Post RSS Feed & Full-Text Ingestion ([`village.config.json`](file:///home/dsample/code/village-daily/village.config.json), [`scripts/sources/rss-source.js`](file:///home/dsample/code/village-daily/scripts/sources/rss-source.js))
- Switched Hunts Post source URL to publisher RSS (`https://www.huntspost.co.uk/news/rss`).
- Configured `RssSource` to fetch full article body paragraphs (`article p`) for Hunts Post articles (persistently cached in `processed_documents_cache.json`).
- Applied location keyword filtering (`Warboys`) against full text, retaining Warboys stories while filtering out non-Warboys district news.

### 3. 5-Layer Death Notice Filtering Engine ([`scripts/utils/pre-filter.js`](file:///home/dsample/code/village-daily/scripts/utils/pre-filter.js#L1-L40))
- **Layer 1 (URL Path Checks)**: Drops URLs matching `/announcements/`, `/obituaries/`, `/in-memoriam/`, `/family-notices/`, `familynotices.co.uk`, `remembering-`.
- **Layer 2 (Dynamic Suffix Stripping)**: Regex strips ANY trailing source suffix (`- huntspost.co.uk`, `- The Hunts Post`, `- Cambs Times`, `- Google News`, etc.).
- **Layer 3 (Expanded Obituary Keyword Dictionary)**: Drops items containing keywords like `passed away`, `crematorium`, `funeral service`, `beloved wife/husband/mother/father`, `in loving memory`, `donations in lieu`, `family flowers only`.
- **Layer 4 (Structural Casing & Name + Age Matching)**: Drops pattern matches like `NAME, Age` (`"Stephens, Megan Irene, 85"`) and uppercase full names.
- **Layer 5 (LLM Agent Negative Constraint)**: Added explicit negative instruction in `BriefingAgent` system prompt.

---

## 🧪 Verification Results

### 1. Automated Test Suite Execution
```bash
npm test
```
```
✔ Village Daily System - Comprehensive Regression Test Suite (6912ms)
ℹ tests 16
ℹ suites 8
ℹ pass 16
ℹ fail 0
```

### 2. Git Commit & Branch Sync
- **Commit `353d86c`**: *"ci: streamline daily-briefing workflow for Git-driven deployment (0 Cloudflare secrets required)"*.
