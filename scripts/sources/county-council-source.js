const BaseSource = require('./base-source');
const cheerio = require('cheerio');
const { getCachedDocument, setCachedDocument } = require('../utils/processed-doc-cache');

class CountyCouncilSource extends BaseSource {
  constructor(config = {}) {
    super(config);
    this.url = config.url || 'https://cambridgeshire.cmis.uk.com/ccc_live/';
  }

  async extract(options = {}) {
    const items = [];

    // Target CMIS Committee IDs for Cambridgeshire County Council
    const targetCommittees = [
      { id: '62', name: 'Highways and Transport Committee' },
      { id: '20', name: 'County Council' },
      { id: '67', name: 'Environment and Green Investment Committee' },
      { id: '4', name: 'Children and Young People Committee' },
      { id: '71', name: 'Strategy, Resources and Performance Committee' }
    ];

    try {
      for (const committee of targetCommittees) {
        const committeeUrl = `https://cambridgeshire.cmis.uk.com/ccc_live/Committees/CouncilCommittees/tabid/140/ctl/ViewCMIS_CommitteeDetails/mid/529/id/${committee.id}/Default.aspx`;

        const cachedItems = getCachedDocument(committeeUrl);
        if (cachedItems) {
          items.push(...cachedItems);
          continue;
        }

        const res = await fetch(committeeUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VillageDaily/1.0' },
          signal: AbortSignal.timeout(6000)
        }).catch(() => null);

        if (res && res.ok) {
          const html = await res.text();
          const $ = cheerio.load(html);

          const extractedFromCommittee = [];

          $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();

            if (href.includes('ViewMeetingPublic') || href.includes('Document.ashx')) {
              const fullUrl = href.startsWith('http') ? href : new URL(href, this.url).toString();
              const isRelevant = text.match(/highways|transport|send|school|ramsey|warboys|huntingdonshire|a141|b1040|b1043|environment|bus/i);

              if (isRelevant) {
                extractedFromCommittee.push({
                  id: `ccc-${committee.id}-${i}-${Date.now()}`,
                  title: `Cambridgeshire County Council (${committee.name}): ${text}`,
                  content: `Official committee report and decision pack from Cambridgeshire County Council (${committee.name}) regarding ${text}.`,
                  url: fullUrl,
                  date: new Date().toISOString(),
                  meetingTitle: `Cambridgeshire County Council (${committee.name})`,
                  category: 'Village News & Governance',
                  sourceId: this.id,
                  sourceName: 'Cambridgeshire County Council'
                });
              }
            }
          });

          if (extractedFromCommittee.length > 0) {
            setCachedDocument(committeeUrl, extractedFromCommittee);
            items.push(...extractedFromCommittee);
          }
        }
      }
    } catch (err) {
      console.warn(`[CountyCouncilSource] Web fetch skipped:`, err.message);
    }

    // Mock fallback with pre-extracted County Council decision statement records
    if (items.length === 0 && options.includeMockFallback) {
      const mockCommitteeUrl = 'https://cambridgeshire.cmis.uk.com/ccc_live/MeetingsCalendar/tabid/70/ctl/ViewMeetingPublic/mid/397/Meeting/2800/Committee/62/Default.aspx';

      const cachedMock = getCachedDocument(mockCommitteeUrl);
      if (cachedMock) {
        return cachedMock;
      }

      const mockExtracted = [
        {
          id: `ccc-highways-winter-2026`,
          title: `Cambridgeshire County Council Highways: Winter Readiness & Road Infrastructure Plan`,
          meetingTitle: `Cambridgeshire County Council Highways & Transport Committee (28 July 2026)`,
          content: `Approved updated Highways Asset Management Strategy and winter readiness program. Priority gritting routes across Huntingdonshire and rural connector roads (including B1040) scheduled for pre-winter surface sealing.`,
          url: `https://cambridgeshire.cmis.uk.com/ccc_live/MeetingsCalendar/tabid/70/ctl/ViewMeetingPublic/mid/397/Meeting/2800/Committee/62/Default.aspx`,
          date: `2026-07-28T10:00:00.000Z`,
          category: 'Village News & Governance',
          sourceId: this.id,
          sourceName: 'Cambridgeshire County Council'
        },
        {
          id: `ccc-send-strategy-2026`,
          title: `County Council Children & Young People Committee: SEND Provision & School Transport Update`,
          meetingTitle: `Cambridgeshire County Council Children & Young People Committee (14 July 2026)`,
          content: `Reported strategic review of Special Educational Needs & Disabilities (SEND) funding allocation. Includes improvements to rural home-to-school transport routes across Huntingdonshire.`,
          url: `https://cambridgeshire.cmis.uk.com/ccc_live/MeetingsCalendar/tabid/70/ctl/ViewMeetingPublic/mid/397/Meeting/2704/Committee/4/Default.aspx`,
          date: `2026-07-14T10:00:00.000Z`,
          category: 'Village News & Governance',
          sourceId: this.id,
          sourceName: 'Cambridgeshire County Council'
        }
      ];

      setCachedDocument(mockCommitteeUrl, mockExtracted);
      items.push(...mockExtracted);
    }

    return items;
  }
}

module.exports = CountyCouncilSource;
