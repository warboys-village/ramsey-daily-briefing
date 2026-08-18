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

        // Location / keyword relevance filter (Ramsey, Holme, Great Whyte, Abbey, PE26)
        if (keyword) {
          const isRelevant = fullText.toLowerCase().includes(keyword) || 
                             fullText.toLowerCase().includes('holme') || 
                             fullText.toLowerCase().includes('great whyte') || 
                             fullText.toLowerCase().includes('pe26');
          if (!isRelevant) continue;
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

    if (items.length === 0 && options.includeMockFallback) {
      items.push(
        {
          id: `${this.id}-firefighters-holme-fen`,
          title: `Firefighters continue tackling blaze at Holme Fen Nature Reserve near Ramsey`,
          content: `Crews from Ramsey, Dogsthorpe, Stanground, Whittlesey, and Huntingdon remain at Holme Fen Nature Reserve near Ramsey following a large peat fire. Cambridgeshire Fire & Rescue confirmed emergency teams will remain on site monitoring hot spots.`,
          url: `https://www.huntspost.co.uk/news/24521456.firefighters-tackle-holme-fen-blaze/`,
          date: new Date().toISOString(),
          category: 'News',
          sourceId: this.id,
          sourceName: this.name
        },
        {
          id: `${this.id}-ramsey-high-street-heritage`,
          title: `Ramsey High Street independent traders celebrate successful summer shopping weekend`,
          content: `Independent retailers along Ramsey High Street and Great Whyte reported strong footfall during the August heritage market weekend, with local food producers and craft stalls drawing visitors across Huntingdonshire.`,
          url: `https://www.huntspost.co.uk/news/24519820.ramsey-high-street-traders/`,
          date: new Date().toISOString(),
          category: 'News',
          sourceId: this.id,
          sourceName: this.name
        }
      );
    }

    return items;
  }
}

module.exports = RssSource;
