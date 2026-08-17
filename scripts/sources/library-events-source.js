const BaseSource = require('./base-source');
const cheerio = require('cheerio');
const { saveCalendar } = require('../utils/events-calendar-store');

class LibraryEventsSource extends BaseSource {
  constructor(config) {
    super(config);
    this.url = config.url || 'https://info.cambridgeshire.gov.uk/kb5/cambridgeshire/directory/results.action?camcommunitychannel=6-4&location_postcode__outcode=PE26&sortorder=1&sorttype=field&sortfield=__created';
  }

  async extract(options = {}) {
    const items = [];

    try {
      const res = await fetch(this.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VillageDaily/1.0'
        },
        signal: AbortSignal.timeout(6000)
      }).catch(() => null);

      if (res && res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);

        $('.hit_title a, .result_item h3 a').each((i, el) => {
          const title = $(el).text().trim();
          const href = $(el).attr('href');
          if (title && href) {
            const fullUrl = href.startsWith('http') ? href : new URL(href, this.url).toString();
            items.push({
              id: `library-event-${i}-${Date.now()}`,
              title,
              eventTime: `Weekly / Monthly Session`,
              eventCategory: `UPCOMING`,
              isRegular: true,
              venue: `Ramsey Library, 25 Great Whyte, Ramsey, PE26 1HG`,
              content: `${title} hosted at Ramsey Library.`,
              url: fullUrl,
              date: new Date().toISOString(),
              eventDate: new Date().toISOString().split('T')[0],
              category: 'Community Events',
              sourceId: this.id,
              sourceName: this.name
            });
          }
        });
      }
    } catch (err) {
      console.warn(`[LibraryEventsSource] Query warning: ${err.message}`);
    }

    if (items.length === 0 && options.includeMockFallback) {
      const libraryUrl = `https://www.cambridgeshire.gov.uk/directory/listings/ramsey-library`;

      items.push(
        {
          id: `ramsey-library-rhymetime-2026`,
          title: `Ramsey Library Rhymetime & Storytime`,
          eventTime: `Every Tuesday • 10:30 AM - 11:00 AM`,
          eventCategory: `UPCOMING`,
          isRegular: true,
          venue: `Ramsey Library, 25 Great Whyte, Ramsey, PE26 1HG`,
          content: `Weekly Rhymetime session for babies, toddlers, and parents/carers at Ramsey Library. Songs, rhymes, and simple crafts.`,
          url: libraryUrl,
          date: `2026-08-01T12:00:00.000Z`,
          eventDate: `2026-09-01`,
          category: 'Community Events',
          sourceId: this.id,
          sourceName: this.name
        },
        {
          id: `ramsey-library-lego-club-2026`,
          title: `Ramsey Library Junior Lego Club`,
          eventTime: `Saturday 12 September 2026 • 10:00 AM - 12:00 PM`,
          eventCategory: `UPCOMING`,
          isRegular: false,
          venue: `Ramsey Library, 25 Great Whyte, Ramsey, PE26 1HG`,
          content: `Drop-in Lego building session for primary school children. Free admission, drop in with family.`,
          url: libraryUrl,
          date: `2026-08-01T12:00:00.000Z`,
          eventDate: `2026-09-12`,
          category: 'Community Events',
          sourceId: this.id,
          sourceName: this.name
        },
        {
          id: `ramsey-library-digital-help-2026`,
          title: `Digital Help & Computer Support Surgery`,
          eventTime: `Every Thursday • 2:00 PM - 4:00 PM`,
          eventCategory: `UPCOMING`,
          isRegular: true,
          venue: `Ramsey Library, 25 Great Whyte, Ramsey, PE26 1HG`,
          content: `Free one-to-one computer, tablet, and smartphone help sessions provided by trained volunteer digital champions.`,
          url: libraryUrl,
          date: `2026-08-01T12:00:00.000Z`,
          eventDate: `2026-09-03`,
          category: 'Community Events',
          sourceId: this.id,
          sourceName: this.name
        }
      );
    }

    if (items.length > 0) {
      saveCalendar(items);
    }

    return items;
  }
}

module.exports = LibraryEventsSource;
