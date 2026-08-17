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
        const initialSnippet = (entry.contentSnippet || entry.content || entry.summary || '').trim();
        let fullText = `${title} ${initialSnippet}`;
        let articleBody = initialSnippet;

        // If article is from huntspost.co.uk, fetch full body paragraphs to evaluate location relevance & obtain rich context
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
                
                // Remove share buttons, social bars, and comment widgets before extracting text
                $('.share-links, .social-share, .article-share, .utility-bar, script, style').remove();
                
                let fetchedBody = $('article p, .article-body p')
                  .map((i, el) => $(el).text().trim())
                  .get()
                  .filter(text => text.length > 0 && !/^(?:share|comments?|follow us|subscribe)/i.test(text))
                  .join(' ');

                fetchedBody = fetchedBody.replace(/^(?:share\s*)+/i, '').trim();

                if (fetchedBody && fetchedBody.length > 80) {
                  articleBody = fetchedBody;
                  fullText = `${title} ${articleBody}`;
                  setCachedArticleSummary(entry.link, title, articleBody);
                }
              }
            } catch (e) {}
          }
        }

        // Location / keyword relevance filter
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

module.exports = RssSource;
