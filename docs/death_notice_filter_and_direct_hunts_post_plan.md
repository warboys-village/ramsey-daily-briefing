# Implementation Plan: Direct Hunts Post RSS, Full-Text Article Extraction & 5-Layer Death Notice Filter

Fetch direct news from **The Hunts Post** (`https://www.huntspost.co.uk/news/rss`), extract **full article text** to determine village relevance, and implement a **5-layer death notice pre-filter** to permanently prevent obituaries (such as *MEGAN IRENE STEPHENS*) from appearing in daily briefings.

---

## 🎯 Problem & Architecture Solution

### 1. Root Cause of *MEGAN IRENE STEPHENS* Reappearance
- **Suffix Removal Failure**: Google News returned `title: "MEGAN IRENE STEPHENS - huntspost.co.uk"`. The pre-filter regex previously only stripped `- The Hunts Post`, leaving `- huntspost.co.uk` attached.
- **Title Casing Failure**: Because `"huntspostcouk"` contained lowercase letters, `lettersOnly === lettersOnly.toUpperCase()` failed.
- **Short Snippet Limitation**: RSS feeds only provide 1-sentence snippets, making it hard to judge whether a Hunts Post article is about Warboys or another town in Huntingdonshire.

### 2. The Comprehensive Solution
1. **Direct Hunts Post RSS (`https://www.huntspost.co.uk/news/rss`)**: Discontinue relying on Google News RSS queries for Hunts Post.
2. **Full-Text Article Extraction & Caching**: `RssSource` fetches full body paragraphs (`article p`) for Hunts Post items (persistently cached in `processed_documents_cache.json`).
3. **Village Relevance Filtering**: Checks full article text for target location keywords (`Warboys`, `PE28`, `Warboys Parish`) so only stories about the village are retained.
4. **5-Layer Death Notice Pre-Filter**: Eliminates obituaries across URL paths, dynamic suffix stripping, keyword dictionary, Name+Age pattern matching, and LLM negative prompting.

---

## 🛠️ Proposed Changes

### 1. Update Source Configuration ([`village.config.json`](file:///home/dsample/code/village-daily/village.config.json))

#### [MODIFY] `village.config.json`
Point Hunts Post source directly to publisher RSS:
```diff
     {
       "id": "hunts-post",
       "type": "rss",
       "name": "The Hunts Post News",
-      "url": "https://news.google.com/rss/search?q=Warboys+site:huntspost.co.uk&hl=en-GB&gl=GB&ceid=GB:en",
+      "url": "https://www.huntspost.co.uk/news/rss",
+      "filterKeyword": "Warboys",
       "enabled": true
     }
```

---

### 2. Full-Text Article Extraction & Relevance Filter ([`scripts/sources/rss-source.js`](file:///home/dsample/code/village-daily/scripts/sources/rss-source.js))

#### [MODIFY] `scripts/sources/rss-source.js`
Enhance `RssSource` to fetch full article body paragraphs for Hunts Post URLs, check for village keyword relevance, and store full text:

```javascript
const Parser = require('rss-parser');
const cheerio = require('cheerio');
const BaseSource = require('./base-source');
const { getCachedArticleSummary, setCachedArticleSummary } = require('../utils/processed-doc-cache');

class RssSource extends BaseSource {
  constructor(config) {
    super(config);
    this.parser = new Parser({
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VillageDaily/1.0' }
    });
  }

  async extract(options = {}) {
    const { maxDays = 14, filterKeyword } = options;
    const keyword = (filterKeyword || this.config.filterKeyword || '').toLowerCase();
    const items = [];

    try {
      const feed = await this.parser.parseURL(this.config.url);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxDays);

      for (const entry of feed.items || []) {
        const itemDate = entry.isoDate ? new Date(entry.isoDate) : (entry.pubDate ? new Date(entry.pubDate) : new Date());
        if (itemDate < cutoffDate) continue;

        const title = (entry.title || '').trim();
        const initialSnippet = (entry.contentSnippet || entry.content || '').trim();
        let fullText = `${title} ${initialSnippet}`;
        let articleBody = initialSnippet;

        // If from huntspost.co.uk, fetch full article HTML to check village relevance & get complete text
        if (entry.link && entry.link.includes('huntspost.co.uk')) {
          const cached = getCachedArticleSummary(entry.link);
          if (cached && cached.cleanSummary) {
            articleBody = cached.cleanSummary;
            fullText = `${title} ${articleBody}`;
          } else {
            try {
              const res = await fetch(entry.link, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VillageDaily/1.0' },
                signal: AbortSignal.timeout(5000)
              });
              if (res.ok) {
                const html = await res.text();
                const $ = cheerio.load(html);
                const fetchedBody = $('article p, .article-body p').map((i, el) => $(el).text().trim()).get().join(' ');
                if (fetchedBody && fetchedBody.length > 100) {
                  articleBody = fetchedBody;
                  fullText = `${title} ${articleBody}`;
                  setCachedArticleSummary(entry.link, title, articleBody);
                }
              }
            } catch (e) {}
          }
        }

        // Location relevance filter (e.g. "Warboys")
        if (keyword && !fullText.toLowerCase().includes(keyword)) {
          continue;
        }

        items.push({
          id: entry.guid || entry.link || `${this.id}-${Date.now()}-${Math.random()}`,
          title,
          content: articleBody.slice(0, 1500),
          url: entry.link || this.config.url,
          date: itemDate.toISOString(),
          category: 'News',
          sourceId: this.id,
          sourceName: this.name
        });
      }
    } catch (err) {
      console.warn(`[RssSource:${this.id}] Error fetching feed ${this.config.url}:`, err.message);
    }

    return items;
  }
}
```

---

### 3. 5-Layer Robust Death Notice Filter ([`scripts/utils/pre-filter.js`](file:///home/dsample/code/village-daily/scripts/utils/pre-filter.js))

#### [MODIFY] `scripts/utils/pre-filter.js`
Replace simple title checks with a 5-layer filtering engine:

```javascript
function isDeathNotice(item) {
  if (!item) return false;

  const rawTitle = (item.title || '').trim();
  const content = (item.content || '').trim();
  const rawUrl = (item.url || '').toLowerCase();
  const combined = `${rawTitle} ${content}`.toLowerCase();

  // Layer 1: URL domain & path pattern check
  const deathUrlPatterns = [
    '/announcements/', '/obituaries/', '/in-memoriam/',
    '/family-notices/', '/notices/death/', 'familynotices.co.uk',
    'funeral-notices.co.uk', 'bmms.co.uk', 'remembering-'
  ];
  if (deathUrlPatterns.some(p => rawUrl.includes(p))) {
    return true;
  }

  // Layer 2: Dynamic suffix cleaning (strips any trailing source suffix like "- huntspost.co.uk", "- The Hunts Post", etc.)
  const cleanTitle = rawTitle
    .replace(/\s*-\s*[a-z0-9.-]+\.(?:co\.uk|com|org|net|gov\.uk)$/i, '')
    .replace(/\s*-\s*(?:The Hunts Post|The Hunts Post News|Cambs Times|Google News)$/i, '')
    .trim();

  // Layer 3: Expanded death notice & obituary keyword/phrase dictionary
  const deathKeywords = [
    'death notice', 'death notices', 'obituary', 'obituaries',
    'funeral notice', 'funeral notices', 'in memoriam',
    'passed away', 'beloved wife', 'beloved husband',
    'beloved mother', 'beloved father', 'beloved son', 'beloved daughter',
    'in loving memory', 'peacefully on', 'crematorium',
    'funeral service', 'family flowers only', 'donations in lieu',
    'late of', 'deeply missed', 'sadly passed', 'dearly loved'
  ];
  if (deathKeywords.some(kw => combined.includes(kw))) {
    return true;
  }

  // Layer 4: Structural Name + Age Pattern & ALL-CAPS Name Detection
  // Matches "NAME, Age", "NAME (Age)", "NAME - aged Age"
  const nameAgePattern = /^[A-Z\s'-]+(?:,\s*\d{1,3}|\s*\(\d{1,3}\)|\s*-\s*aged\s+\d{1,3})/i;
  if (nameAgePattern.test(cleanTitle)) {
    return true;
  }

  const lettersOnly = cleanTitle.replace(/[^A-Za-z]/g, '');
  if (lettersOnly.length > 5 && lettersOnly === lettersOnly.toUpperCase()) {
    const isSpecialCaps = cleanTitle.includes('WARBOYS') || cleanTitle.includes('COUNCIL') || cleanTitle.includes('NOTICE') || cleanTitle.includes('PLANNING') || cleanTitle.includes('PARISH') || cleanTitle.includes('ROAD') || cleanTitle.includes('CLOSURE') || cleanTitle.includes('MEETING') || cleanTitle.includes('POLICE') || cleanTitle.includes('SCHOOL');
    if (!isSpecialCaps) {
      return true;
    }
  }

  return false;
}
```

---

### 4. Agent System Prompt Negative Constraint ([`scripts/agent/briefing-agent.js`](file:///home/dsample/code/village-daily/scripts/agent/briefing-agent.js))

#### [MODIFY] `scripts/agent/briefing-agent.js`
Add explicit negative constraint to LLM prompt:
```diff
 - Strictly focus on community news, council governance, planning applications, local events, and school updates.
+ - Strictly EXCLUDE individual death notices, obituaries, in-memoriam announcements, and personal funeral details.
```

---

### 5. Regression Test Suite ([`tests/regression-suite.test.js`](file:///home/dsample/code/village-daily/tests/regression-suite.test.js))

#### [MODIFY] `tests/regression-suite.test.js`
Add unit tests verifying:
- Full-text extraction from Hunts Post URLs.
- Village location filtering (`Warboys`).
- Pre-filtering suffix-stripped death notices (`MEGAN IRENE STEPHENS - huntspost.co.uk`).

---

## 🧪 Verification Plan

### Automated Tests
```bash
npm test
```
- Verify 100% test pass rate across all regression tests.

### Live Data Ingestion & Build Verification
```bash
npm run ingest && npm run build
```
- Verify live ingestion with full Hunts Post article fetching and 5-layer death notice filtering.
- Confirm `MEGAN IRENE STEPHENS` is completely eliminated from `src/briefings/*.md` and static output `_site/index.html`.
