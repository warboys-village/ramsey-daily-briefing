const BaseSource = require('./base-source');
const cheerio = require('cheerio');
const { saveCalendar } = require('../utils/events-calendar-store');

class FowlSource extends BaseSource {
  constructor(config) {
    super(config);
    this.url = config.url || 'https://fowl.org.uk/';
  }

  async extract(options = {}) {
    const items = [];
    const eventsUrl = 'https://fowl.org.uk/listing/library/';
    const blogUrl = 'https://fowl.org.uk/blog/';
    const historySocietyUrl = 'https://fowl.org.uk/2026/03/30/warboys-local-history-society/';
    const now = new Date();

    // Helper: Format local Date to YYYY-MM-DD string without timezone shift
    const toIsoDateStr = (dateObj) => {
      if (!dateObj || isNaN(dateObj.getTime())) return '';
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Helper: Get next N dates for a specific day of week (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const getUpcomingWeekdayDates = (targetDay, count = 1) => {
      const dates = [];
      const current = new Date(now);
      current.setHours(12, 0, 0, 0);

      while (dates.length < count) {
        if (current.getDay() === targetDay) {
          dates.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
      }
      return dates;
    };

    // Helper: Parse publication date from WordPress URL /2026/04/12/
    const parseUrlDate = (href) => {
      if (!href) return null;
      const match = href.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
      if (match) {
        return new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00.000Z`);
      }
      return null;
    };

    // Helper: Parse specific date string into Date object
    const parseDateStr = (text, defaultYear = 2026) => {
      if (!text) return null;
      const match = text.match(/(?:(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+)?(?:(May)\s+(\d{1,2})(?:st|nd|rd|th)?|(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December))(?:\s+(\d{4}))?/i);
      if (match) {
        let dayNum, monthName, yr;
        if (match[2]) {
          monthName = match[2];
          dayNum = match[3];
        } else {
          dayNum = match[4];
          monthName = match[5];
        }
        yr = match[6] || defaultYear;
        const d = new Date(`${dayNum} ${monthName} ${yr} 12:00:00`);
        if (!isNaN(d.getTime())) return d;
      }
      return null;
    };

    // 1. Exact 3 regular sessions published on https://fowl.org.uk/listing/library/ (immediate next occurrence)
    const regularDefinitions = [
      {
        baseId: 'fowl-regular-rhymetime',
        title: `Warboys Library Baby & Toddler Rhymetime`,
        dayOfWeek: 2, // Tuesday
        timeStr: `Every Tuesday • 10:30 AM - 11:00 AM`,
        venue: `Warboys Community Library, 52 High Street`,
        content: `Rhyme Time session for babies and toddlers from birth to 3 years. Parents and carers please stay with your children. Free entry, drop-in session.`
      },
      {
        baseId: 'fowl-regular-storytime',
        title: `Warboys Library Children's Storytime`,
        dayOfWeek: 4, // Thursday
        timeStr: `Every Thursday • 10:30 AM - 11:00 AM`,
        venue: `Warboys Community Library, 52 High Street`,
        content: `Stories, rhymes, and colouring for children aged 0 to 5 years. Free drop-in, no booking required.`
      },
      {
        baseId: 'fowl-regular-coffeemorning',
        title: `Warboys Library Fortnightly Coffee Morning`,
        dayOfWeek: 6, // Saturday
        timeStr: `Fortnightly on Saturdays • 10:30 AM - 12:00 PM`,
        venue: `Warboys Community Library, 52 High Street`,
        content: `Fortnightly Saturday coffee morning run by Friends of Warboys Library group. All welcome, drop in for tea, coffee, and friendly conversation.`
      }
    ];

    for (const def of regularDefinitions) {
      const upcomingDates = getUpcomingWeekdayDates(def.dayOfWeek, 1);
      for (const d of upcomingDates) {
        const isoDateStr = toIsoDateStr(d);
        const dayLabel = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

        items.push({
          id: `${def.baseId}-${isoDateStr}`,
          title: def.title,
          eventTime: `${dayLabel} • ${def.timeStr.split('•')[1] || def.timeStr}`,
          eventCategory: 'UPCOMING',
          isRegular: true,
          venue: def.venue,
          content: def.content,
          url: eventsUrl,
          date: d.toISOString(),
          eventDate: isoDateStr,
          category: 'Community Events',
          sourceId: this.id,
          sourceName: this.name
        });
      }
    }

    // 2. Fetch & parse Warboys Local History Society programme post directly from HTML table
    try {
      const res = await fetch(historySocietyUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VillageDaily/1.0' },
        signal: AbortSignal.timeout(6000)
      }).catch(() => null);

      if (res && res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        $('table tr').each((i, row) => {
          const cells = $(row).find('td, th').map((_, c) => $(c).text().trim()).get();
          if (cells.length >= 2) {
            const dateText = cells[0];
            const topicText = cells[1];
            const speakerText = cells[2] || '';

            const parsedDate = parseDateStr(dateText, 2026);
            if (parsedDate && topicText && !topicText.toLowerCase().includes('topic')) {
              const isoDateStr = toIsoDateStr(parsedDate);
              const dayLabel = parsedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
              const fullTitle = `Warboys Local History Society: '${topicText}'`;
              const speakerInfo = speakerText ? ` (Speaker: ${speakerText})` : '';

              items.push({
                id: `fowl-history-society-${isoDateStr}`,
                title: fullTitle,
                eventTime: `${dayLabel} • 7:30 PM`,
                eventCategory: 'UPCOMING',
                isRegular: false,
                venue: 'Methodist Church, High Street, Warboys',
                content: `${fullTitle}${speakerInfo} - Meeting at Methodist Church, High Street, Warboys at 7.30pm. All welcome. Charge for non-members £3.00.`,
                url: historySocietyUrl,
                date: new Date('2026-03-30T12:00:00.000Z').toISOString(),
                eventDate: isoDateStr,
                category: 'Community Events',
                sourceId: this.id,
                sourceName: this.name
              });
            }
          }
        });
      }
    } catch (err) {
      console.warn(`[FowlSource] History society post parse warning:`, err.message);
    }

    // 3. Fallback items with 100% ACCURATE table rows matching fowl.org.uk/2026/03/30/warboys-local-history-society/
    if (options.includeMockFallback) {
      // Historical past events from FOWL blog
      items.push(
        {
          id: `fowl-event-bacon-butty-2026-04-18`,
          title: `Bacon Butty Bonanza outside Royal Oak Pub`,
          eventTime: `Saturday 18 April 2026 • 8:00 AM - 12:00 PM`,
          eventCategory: `UPCOMING`,
          isRegular: false,
          venue: `Outside Royal Oak Pub, Warboys`,
          content: `Bacon Butty Bonanza! Taking place outside the Royal Oak Pub in Warboys. Organised by Friends of Warboys Library.`,
          url: `https://fowl.org.uk/2026/04/12/bacon-butty-bonanza-2/`,
          date: `2026-04-12T12:00:00.000Z`,
          eventDate: `2026-04-18`,
          category: 'Community Events',
          sourceId: this.id,
          sourceName: this.name
        },
        {
          id: `fowl-event-book-sale-2026-04-18`,
          title: `Warboys Library Spring Book Sale`,
          eventTime: `Saturday 18 April 2026 • 10:00 AM - 12:00 PM`,
          eventCategory: `UPCOMING`,
          isRegular: false,
          venue: `Warboys Community Library`,
          content: `Friends of Warboys Library are having a Book Sale! Saturday 18th April 2026 from 10.00am to 12.00 Midday. Everybody Welcome – Come and grab some bargains!`,
          url: `https://fowl.org.uk/2026/04/12/warboys-library-book-sale/`,
          date: `2026-04-12T12:00:00.000Z`,
          eventDate: `2026-04-18`,
          category: 'Community Events',
          sourceId: this.id,
          sourceName: this.name
        }
      );

      // Exact Programme Table from https://fowl.org.uk/2026/03/30/warboys-local-history-society/
      const historyProgramme = [
        { dateStr: '2026-03-02', timeLabel: 'Monday 2 March 2026 • 7:30 PM', topic: `AGM / The Abbotts Ripton Train Crash`, speaker: 'Charles Saunders' },
        { dateStr: '2026-04-13', timeLabel: 'Monday 13 April 2026 • 7:30 PM', topic: `The Enclosure of Warboys`, speaker: 'Bill Franklin' },
        { dateStr: '2026-05-11', timeLabel: 'Monday 11 May 2026 • 7:30 PM', topic: `Whittlesey Straw Bear`, speaker: 'Brian Kell' },
        { dateStr: '2026-06-01', timeLabel: 'Monday 1 June 2026 • 7:30 PM', topic: `Katherine of Aragon - From Spain to Huntingdonshire`, speaker: 'Nora Butler' },
        { dateStr: '2026-07-06', timeLabel: 'Monday 6 July 2026 • 7:30 PM', topic: `Warboys Fen`, speaker: 'Joan Cole' },
        { dateStr: '2026-08-03', timeLabel: 'Monday 3 August 2026 • 7:30 PM', topic: `Boudicca creation of two empires`, speaker: 'Chris Carr' },
        { dateStr: '2026-09-07', timeLabel: 'Monday 7 September 2026 • 7:30 PM', topic: `Bravery, Beheadings and Barbeques`, speaker: 'Rev Ruth Clay' },
        { dateStr: '2026-10-05', timeLabel: 'Monday 5 October 2026 • 7:30 PM', topic: `Operation Epsilon (more on Farm Hall)`, speaker: 'Roger Leivers' }
      ];

      for (const h of historyProgramme) {
        items.push({
          id: `fowl-history-society-${h.dateStr}`,
          title: `Warboys Local History Society: '${h.topic}'`,
          eventTime: h.timeLabel,
          eventCategory: 'UPCOMING',
          isRegular: false,
          venue: 'Methodist Church, High Street, Warboys',
          content: `Warboys Local History Society: '${h.topic}' (Speaker: ${h.speaker}) - Meeting at Methodist Church, High Street, Warboys at 7.30pm. All welcome. Charge for non-members £3.00.`,
          url: historySocietyUrl,
          date: `2026-03-30T12:00:00.000Z`,
          eventDate: h.dateStr,
          category: 'Community Events',
          sourceId: this.id,
          sourceName: this.name
        });
      }
    }

    // Save current/upcoming event items to persistent repo calendar store
    const eventItemsOnly = items.filter(i => i.category === 'Community Events');
    if (eventItemsOnly.length > 0) {
      saveCalendar(eventItemsOnly);
    }

    return items;
  }
}

module.exports = FowlSource;
