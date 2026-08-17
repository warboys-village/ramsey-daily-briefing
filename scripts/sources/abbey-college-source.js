const BaseSource = require('./base-source');
const cheerio = require('cheerio');

class AbbeyCollegeSource extends BaseSource {
  constructor(config) {
    super(config);
    this.urls = [
      'https://www.abbey.college/weekly-updates',
      'https://www.abbey.college/whole-school-community-round-up-newsletters',
      'https://www.abbey.college/posts',
      'https://www.ramseygatehouse.co.uk/latest-news',
      'https://www.ramseygatehouse.co.uk/sixth-form-bulletins'
    ];
  }

  async extract(options = {}) {
    const items = [];
    const seenUrls = new Set();

    for (const targetUrl of this.urls) {
      try {
        const res = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VillageDaily/1.0'
          },
          signal: AbortSignal.timeout(6000)
        }).catch(() => null);

        if (!res || !res.ok) continue;

        const html = await res.text();
        const $ = cheerio.load(html);

        // 1. Next.js payload parsing for weekly updates, newsletters, and posts
        const titleUrlRegex = /"(?:text|title)":"([^"]+)".*?"(?:url|slug)":"([^"]+)"/g;
        let match;
        while ((match = titleUrlRegex.exec(html)) !== null) {
          const rawTitle = match[1].trim();
          let rawPath = match[2].replace(/\\u0026/g, '&');

          if (rawTitle.length < 5 || rawTitle.includes('http') || rawTitle.includes('layout')) continue;

          let fullUrl = rawPath;
          if (!fullUrl.startsWith('http')) {
            if (fullUrl.startsWith('/')) {
              fullUrl = `https://www.abbey.college${fullUrl}`;
            } else if (targetUrl.includes('/posts')) {
              fullUrl = `https://www.abbey.college/posts/${fullUrl}`;
            } else {
              fullUrl = `https://www.abbey.college/${fullUrl}`;
            }
          }

          if (seenUrls.has(fullUrl)) continue;
          seenUrls.add(fullUrl);

          items.push({
            id: `abbey-college-${Date.now()}-${Math.random()}`,
            title: rawTitle.toLowerCase().includes('abbey college') ? rawTitle : `Abbey College: ${rawTitle}`,
            content: `Official update/bulletin published by Abbey College, Ramsey.`,
            url: fullUrl,
            date: new Date().toISOString(),
            category: 'School News',
            sourceId: this.id,
            sourceName: this.name
          });
        }

        // 2. HTML <a> elements parsing for direct PDF & post links
        $('a').each((i, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().trim();
          if (!href) return;

          const isRelevant = href.includes('weekly') || href.includes('round-up') || href.includes('newsletter') || href.endsWith('.pdf') || (targetUrl.includes('/posts') && href.includes('/posts/'));
          if (!isRelevant) return;

          const fullUrl = href.startsWith('http') ? href : new URL(href, targetUrl).toString();
          if (seenUrls.has(fullUrl)) return;
          seenUrls.add(fullUrl);

          const titleText = text || 'Abbey College News Update';
          items.push({
            id: `abbey-college-${Date.now()}-${Math.random()}`,
            title: titleText.toLowerCase().includes('abbey college') ? titleText : `Abbey College: ${titleText}`,
            content: `Official update/bulletin published by Abbey College, Ramsey.`,
            url: fullUrl,
            date: new Date().toISOString(),
            category: 'School News',
            sourceId: this.id,
            sourceName: this.name
          });
        });

      } catch (err) {
        console.warn(`[AbbeyCollegeSource] Warning fetching ${targetUrl}: ${err.message}`);
      }
    }

    if (items.length === 0 && options.includeMockFallback) {
      items.push({
        id: `abbey-college-update-14-11-25`,
        title: `Abbey College: Weekly Family Update & Community Round-up`,
        content: `Extracted from Abbey College communications: Weekly Family Update and Community Round-up newsletter bulletins.`,
        url: `https://www.abbey.college/weekly-updates`,
        date: `2026-08-14T12:00:00.000Z`,
        category: 'School News',
        sourceId: this.id,
        sourceName: this.name
      });
    }

    return items;
  }
}

module.exports = AbbeyCollegeSource;
