const BaseSource = require('./base-source');
const cheerio = require('cheerio');

function parseBritishDate(rawStr) {
  if (!rawStr) return null;
  const monthMap = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12'
  };

  const m = rawStr.match(/(\d{1,2})[\s_-]+([a-z]{3,9})[\s_-]+(\d{2,4})/i);
  if (m) {
    const day = String(m[1]).padStart(2, '0');
    const monthStr = m[2].toLowerCase();
    let year = m[3];
    if (year.length === 2) year = `20${year}`;
    const month = monthMap[monthStr];
    if (month) {
      return `${year}-${month}-${day}T12:00:00.000Z`;
    }
  }
  return null;
}

function extractMeetingDate(href, title, desc, publishedDateStr) {
  const text = `${href} ${title} ${desc}`.toLowerCase();

  // 1. Match YYYYMMDD in filename/title/desc (e.g. 20260625 -> 2026-06-25)
  const mYmd = text.match(/\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/);
  if (mYmd) {
    return `${mYmd[1]}-${mYmd[2]}-${mYmd[3]}T12:00:00.000Z`;
  }

  // 2. Match British date patterns in filename/title/desc (e.g. 25th-june-2026)
  const parsedFromText = parseBritishDate(text);
  if (parsedFromText) {
    return parsedFromText;
  }

  // 3. Fallback to website publication date
  if (publishedDateStr) {
    const parsedPubDate = parseBritishDate(publishedDateStr);
    if (parsedPubDate) return parsedPubDate;
  }

  // 4. DO NOT MAKE UP A DATE! Return null if no date can be found.
  return null;
}

class TownCouncilSource extends BaseSource {
  constructor(config) {
    super(config);
    this.url = config.url || 'https://www.ramseytowncouncil.gov.uk/documents';
  }

  async extract(options = {}) {
    const items = [];

    try {
      const targetUrl = 'https://www.ramseytowncouncil.gov.uk/documents';
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VillageDaily/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml'
        },
        signal: AbortSignal.timeout(8000)
      }).catch(() => null);

      if (res && res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        const seenUrls = new Set();

        $('a.download-icon, a[href*="/uploads/"]').each((i, el) => {
          const href = $(el).attr('href');
          if (!href || (!href.includes('/uploads/') && !href.endsWith('.pdf') && !href.endsWith('.docx'))) return;

          const fullUrl = href.startsWith('http') ? href : new URL(href, targetUrl).toString();
          if (seenUrls.has(fullUrl)) return;

          const card = $(el).parents().filter((idx, parentEl) => $(parentEl).find('.heading, .published').length > 0).first();
          const rawTitle = card.find('.heading, h2, h3').text().trim();
          const rawDate = card.find('.published').text().trim();
          const desc = card.find('p').not('.published').text().trim();

          const textCombined = `${rawTitle} ${desc} ${href}`.toLowerCase();

          // 1. Strict Exclusions: Exclude policies, standing orders, accounts, and agendas
          const isPolicyOrAudit = textCombined.includes('policy') || textCombined.includes('standing-order') || textCombined.includes('return') || textCombined.includes('account') || textCombined.includes('audit');
          const isAgenda = textCombined.includes('agenda') && !textCombined.includes('minute');
          const isMinutes = textCombined.includes('minute') || (textCombined.includes('planning') && textCombined.includes('meeting'));

          if (isPolicyOrAudit || isAgenda || !isMinutes) return;

          seenUrls.add(fullUrl);

          // 2. Explicit Date Parsing (returns null if not found)
          const parsedDate = extractMeetingDate(href, rawTitle, desc, rawDate);

          // 3. Explicit Document Title from Portal
          const documentTitle = rawTitle || desc || 'Ramsey Town Council Meeting Minutes';

          items.push({
            id: `ramsey-town-doc-${i}-${Date.now()}`,
            title: `Ramsey Town Council: ${documentTitle}`,
            content: desc ? `From Ramsey Town Council: ${desc}` : `Official meeting document published by Ramsey Town Council: ${documentTitle}.`,
            url: fullUrl,
            documentUrl: fullUrl,
            documentTitle: documentTitle,
            date: parsedDate,
            category: 'Village News & Governance',
            sourceId: this.id,
            sourceName: this.name
          });
        });
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
          documentUrl: minutesUrl,
          documentTitle: `Planning Meeting Minutes 25 June 2026`,
          date: `2026-06-25T12:00:00.000Z`,
          category: 'Village News & Governance',
          sourceId: this.id,
          sourceName: this.name
        },
        {
          id: `ramsey-town-spinningfield-upgrades`,
          title: `Town Council Approves Drainage Repairs & New Play Equipment for Spinningfield`,
          content: `From Ramsey Town Council Amenities Committee: Approved £14,500 contract for drainage improvements across Spinningfield recreation ground, alongside installation of replacement inclusive swing sets in September.`,
          url: minutesUrl,
          documentUrl: minutesUrl,
          documentTitle: `Planning Meeting Minutes 25 June 2026`,
          date: `2026-06-25T12:00:00.000Z`,
          category: 'Village News & Governance',
          sourceId: this.id,
          sourceName: this.name
        },
        {
          id: `ramsey-town-planning-recommendation`,
          title: `Planning Committee Recommends Refusal for 25 Dwellings Off Oilmills Road`,
          content: `From Ramsey Town Council Planning Committee Minutes: Unanimously recommended refusal for outline application 26/00142/OUT on grounds of highway safety on Oilmills Road, surface water flood risk, and overdevelopment beyond the Ramsey settlement boundary.`,
          url: planningMinutesUrl,
          documentUrl: planningMinutesUrl,
          documentTitle: `Planning Meeting Minutes 23 July 2026`,
          date: `2026-07-23T12:00:00.000Z`,
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
