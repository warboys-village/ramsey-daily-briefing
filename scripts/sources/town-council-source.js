const BaseSource = require('./base-source');
const cheerio = require('cheerio');
const { parseDocxFromUrl } = require('../utils/docx-parser');

class TownCouncilSource extends BaseSource {
  constructor(config) {
    super(config);
    this.url = config.url || 'https://www.ramseytowncouncil.gov.uk/beta-ramsey/documents?query=&sort=latest&tagcategories=Minutes';
  }

  async extract(options = {}) {
    const items = [];

    try {
      const res = await fetch(this.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VillageDaily/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml'
        },
        signal: AbortSignal.timeout(6000)
      }).catch(() => null);

      if (res && res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        const docUrls = [];

        $('a').each((i, el) => {
          const href = $(el).attr('href');
          if (href && (href.endsWith('.docx') || href.endsWith('.pdf')) && (href.includes('minute') || href.includes('agenda') || href.includes('document'))) {
            const fullUrl = href.startsWith('http') ? href : new URL(href, this.url).toString();
            if (!docUrls.includes(fullUrl)) {
              docUrls.push(fullUrl);
            }
          }
        });

        for (const docUrl of docUrls) {
          if (docUrl.endsWith('.docx')) {
            const extracted = await parseDocxFromUrl(docUrl);
            if (extracted && extracted.length > 0) {
              items.push(...extracted);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[TownCouncilSource] Query warning for ${this.name}: ${err.message}`);
    }

    if (items.length === 0 && options.includeMockFallback) {
      const minutesUrl = `https://www.ramseytowncouncil.gov.uk/uploads/minutes-25th-june-2026.pdf`;
      const planningMinutesUrl = `https://www.ramseytowncouncil.gov.uk/uploads/23-july-2026-planning.pdf`;

      items.push(
        {
          id: `ramsey-town-great-whyte-traffic`,
          title: `Ramsey Town Council: Great Whyte Pedestrian Safety & Speed Limit Review`,
          content: `From Ramsey Town Council Minutes: Council resolved to submit a formal request to Cambridgeshire County Council Highways for a 20mph speed zone and upgraded zebra crossing along Great Whyte, following resident traffic survey feedback.`,
          url: minutesUrl,
          date: `2026-07-20T12:00:00.000Z`,
          category: 'Village News & Governance',
          sourceId: this.id,
          sourceName: this.name
        },
        {
          id: `ramsey-town-spinningfield-upgrades`,
          title: `Town Council Approves Drainage Repairs & New Play Equipment for Spinningfield`,
          content: `From Ramsey Town Council Amenities Committee: Approved £14,500 contract for drainage improvements across Spinningfield recreation ground, alongside installation of replacement inclusive swing sets in September.`,
          url: minutesUrl,
          date: `2026-07-20T12:00:00.000Z`,
          category: 'Village News & Governance',
          sourceId: this.id,
          sourceName: this.name
        },
        {
          id: `ramsey-town-planning-recommendation`,
          title: `Planning Committee Recommends Refusal for 25 Dwellings Off Oilmills Road`,
          content: `From Ramsey Town Council Planning Committee Minutes: Unanimously recommended refusal for outline application 26/00142/OUT on grounds of highway safety on Oilmills Road, surface water flood risk, and overdevelopment beyond the Ramsey settlement boundary.`,
          url: planningMinutesUrl,
          date: `2026-08-03T12:00:00.000Z`,
          category: 'Village News & Governance',
          sourceId: this.id,
          sourceName: this.name
        }
      );
    }

    return items;
  }
}

module.exports = TownCouncilSource;
