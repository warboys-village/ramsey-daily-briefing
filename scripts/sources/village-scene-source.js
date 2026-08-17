const BaseSource = require('./base-source');
const cheerio = require('cheerio');
const pdfParse = require('pdf-parse');

class VillageSceneSource extends BaseSource {
  constructor(config) {
    super(config);
    this.url = config.url || 'https://www.villagescene.co.uk/';
  }

  async extract(options = {}) {
    const items = [];

    try {
      const res = await fetch(this.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VillageDaily/1.0' },
        signal: AbortSignal.timeout(6000)
      }).catch(() => null);

      if (res && res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        let pdfUrl = null;

        $('a[href$=".pdf"]').each((i, el) => {
          const href = $(el).attr('href');
          if (href && (href.toLowerCase().includes('warboys') || href.toLowerCase().includes('huntingdon'))) {
            pdfUrl = href.startsWith('http') ? href : new URL(href, this.url).toString();
            return false;
          }
        });

        if (pdfUrl) {
          const pdfRes = await fetch(pdfUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null);
          if (pdfRes && pdfRes.ok) {
            const buffer = await pdfRes.arrayBuffer();
            const data = await pdfParse(Buffer.from(buffer));
            const text = (data.text || '').replace(/\s+/g, ' ').trim();
            if (text.length > 50) {
              items.push({
                id: `village-scene-pdf-${Date.now()}`,
                title: `Village Scene Magazine Latest Community Edition`,
                content: text.slice(0, 1000),
                url: pdfUrl,
                date: new Date().toISOString(),
                category: 'Village News & Community',
                sourceId: this.id,
                sourceName: this.name
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[VillageSceneSource] Fetch warning:`, err.message);
    }

    // Mock fallback for dry runs (--mock)
    if (items.length === 0 && options.includeMockFallback) {
      items.push({
        id: `village-scene-mock-01`,
        title: `Village Scene Magazine: Warboys Community Directory & Local Services Highlight`,
        content: `Highlights from the latest Village Scene directory: Feature on local trades, village hall booking updates, and upcoming local history group meetings in Warboys.`,
        url: `https://www.villagescene.co.uk/`,
        date: new Date().toISOString(),
        category: 'Village News & Community',
        sourceId: this.id,
        sourceName: this.name
      });
    }

    return items;
  }
}

module.exports = VillageSceneSource;
