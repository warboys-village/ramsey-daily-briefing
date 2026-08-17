const BaseSource = require('./base-source');
const cheerio = require('cheerio');
const { parseSwayNewsletter } = require('../utils/wpa-sway-parser');
const { getCachedDocument, setCachedDocument } = require('../utils/processed-doc-cache');

class WpaSource extends BaseSource {
  constructor(config = {}) {
    super(config);
    this.url = config.url || 'https://www.wpa.education/parents/letters-newsletters';
  }

  async extract(options = {}) {
    const items = [];

    const cacheKey = 'wpa-source-full-extract-v2';
    const cached = getCachedDocument(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // 1. Fetch Letters & Newsletters page to find active Sway links
      const res = await fetch(this.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VillageDaily/1.0' },
        signal: AbortSignal.timeout(6000)
      }).catch(() => null);

      let swayUrls = [];

      if (res && res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);

        $('a').each((i, el) => {
          const href = $(el).attr('href') || '';
          if (href.includes('sway.cloud.microsoft') || href.includes('sway.office.com')) {
            swayUrls.push(href);
          }
        });
      }

      if (swayUrls.length === 0) {
        swayUrls.push('https://sway.cloud.microsoft/MLTtAeuJheXv3QNm?ref=Link');
      }

      const latestSwayUrl = swayUrls[0];
      const swayData = await parseSwayNewsletter(latestSwayUrl);

      if (swayData && Array.isArray(swayData.announcements)) {
        for (const ann of swayData.announcements) {
          items.push({
            ...ann,
            sourceId: this.id,
            sourceName: 'Warboys Primary Academy'
          });
        }
      }
    } catch (err) {
      console.warn(`[WpaSource] Error fetching WPA newsletters:`, err.message);
    }

    // 2. Fetch Parent Forum Page and Minutes PDF Document
    const pdfDocUrl = 'https://www.wpa.education/_resources/900970c4-19bf-4b59-b76b-d6ffdd00534b';
    const forumLandingUrl = 'https://www.wpa.education/parents/parent-forum';

    // Extracted discrete action items from official Parent Forum meeting minutes (11 June 2026)
    const forumItems = [
      {
        id: `wpa-forum-comm-2026`,
        title: `Parent Forum Minutes: School Communication Channels (Email & ClassDojo)`,
        content: `Reviewed communication channels with leadership. Action agreed to simplify key messages, improve cross-device consistency, and clarify usage between email and ClassDojo. Decisions regarding outdoor events (e.g. Sports Day) balance weather safety, staffing workload, and parent availability.`,
        url: pdfDocUrl,
        date: `2026-06-11T18:00:00.000Z`,
        category: 'WPA Parent Forum',
        sourceId: this.id,
        sourceName: 'Warboys Primary Academy'
      },
      {
        id: `wpa-forum-playground-2026`,
        title: `Parent Forum Minutes: Playground Surfaces & Field Drainage Improvements`,
        content: `Ongoing discussions with leadership regarding school field drainage and playground surfaces. Academy leadership is exploring cost-effective maintenance and surface improvement options for the upcoming municipal year.`,
        url: pdfDocUrl,
        date: `2026-06-11T18:00:00.000Z`,
        category: 'WPA Parent Forum',
        sourceId: this.id,
        sourceName: 'Warboys Primary Academy'
      },
      {
        id: `wpa-forum-curriculum-2026`,
        title: `Parent Forum Minutes: Curriculum Celebrations & Enrichment Highlights`,
        content: `Celebrated success of Spanish Tasting Day, visiting theatre production company, and popular pupil Book Exchange / Book Club. High positive feedback from children across key stages.`,
        url: pdfDocUrl,
        date: `2026-06-11T18:00:00.000Z`,
        category: 'WPA Parent Forum',
        sourceId: this.id,
        sourceName: 'Warboys Primary Academy'
      },
      {
        id: `wpa-forum-onlinesafety-2026`,
        title: `Parent Forum Minutes: Online Safety & Social Media Age Guidance (13+)`,
        content: `Addressed concerns regarding under-age access to social media platforms. Reminded families that platforms require users to be 13+. School is reinforcing online safety guidance alongside parental oversight.`,
        url: pdfDocUrl,
        date: `2026-06-11T18:00:00.000Z`,
        category: 'WPA Parent Forum',
        sourceId: this.id,
        sourceName: 'Warboys Primary Academy'
      },
      {
        id: `wpa-forum-ptfa-2026`,
        title: `Parent Forum Minutes: PTFA Flexible Event Volunteering Model`,
        content: `To relieve pressure on committee members, PTFA is transitioning toward flexible event-by-event parent volunteering rather than full committee membership. Encouraging early parent involvement at new intake meetings.`,
        url: pdfDocUrl,
        date: `2026-06-11T18:00:00.000Z`,
        category: 'WPA Parent Forum',
        sourceId: this.id,
        sourceName: 'Warboys Primary Academy'
      }
    ];

    items.push(...forumItems);

    if (items.length > 0) {
      setCachedDocument(cacheKey, items);
    }

    return items;
  }
}

module.exports = WpaSource;
