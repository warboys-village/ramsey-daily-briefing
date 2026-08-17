const BaseSource = require('./base-source');

class HdcPlanningSource extends BaseSource {
  constructor(config) {
    super(config);
    this.parishFilter = config.parishFilter || 'Warboys';
  }

  async extract(options = {}) {
    const { maxDays = 30 } = options;
    const items = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxDays);

    const planitUrl = `https://www.planit.org.uk/api/applics/json?auth=Huntingdonshire&kwords=${encodeURIComponent(this.parishFilter)}&pg_sz=30`;

    try {
      const res = await fetch(planitUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VillageDaily/1.0',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        const records = data.records || data.applications || (Array.isArray(data) ? data : []);

        for (const rec of records) {
          const rawDate = rec.start_date || rec.consulted_date || rec.decision_date || rec.date;
          const itemDate = rawDate ? new Date(rawDate) : new Date();
          if (itemDate < cutoffDate) continue;

          const address = (rec.address || rec.location || '').trim();
          const description = (rec.description || rec.proposal || rec.app_type || 'Planning Application').trim();
          const ref = rec.uid || rec.app_ref || rec.reference || 'Ref Pending';
          const appState = (rec.app_state || rec.status || 'Undecided').trim();
          const decision = (rec.decision || rec.decision_type || '').trim();

          const fullText = `${ref} ${address} ${description}`;
          if (this.parishFilter && !fullText.toLowerCase().includes(this.parishFilter.toLowerCase())) {
            continue;
          }

          let statusCategory = 'UPDATED';
          let decisionOutcome = null;
          let badgeClass = 'badge-progress';
          let statusLabel = appState || 'In Progress';

          if (decision || appState.toLowerCase().includes('decid') || appState.toLowerCase().includes('grant') || appState.toLowerCase().includes('refus') || appState.toLowerCase().includes('permit')) {
            statusCategory = 'DECIDED';
            decisionOutcome = decision || appState;
            if (decisionOutcome.toLowerCase().includes('refus')) {
              badgeClass = 'badge-refused';
              statusLabel = 'Refused';
            } else if (decisionOutcome.toLowerCase().includes('withdrawn')) {
              badgeClass = 'badge-other';
              statusLabel = 'Withdrawn';
            } else {
              badgeClass = 'badge-approved';
              statusLabel = 'Approved';
            }
          } else if (rec.start_date && (new Date() - new Date(rec.start_date)) < (7 * 24 * 60 * 60 * 1000)) {
            statusCategory = 'NEW';
            badgeClass = 'badge-new';
            statusLabel = 'New Application';
          }

          const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ', UK')}`;
          const title = description;

          items.push({
            id: `hdc-plan-${ref}-${itemDate.getTime()}`,
            title,
            reference: ref,
            address,
            proposal: description,
            statusCategory,
            decisionOutcome,
            appState,
            badgeClass,
            statusLabel,
            mapUrl,
            content: description,
            url: rec.url || rec.link || `https://publicaccess.huntingdonshire.gov.uk/online-applications/`,
            date: itemDate.toISOString(),
            category: 'Planning & Development',
            sourceId: this.id,
            sourceName: this.name
          });
        }
      }
    } catch (err) {
      console.warn(`[HdcPlanningSource] PlanIt query warning:`, err.message);
    }

    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Realistic Mock Fallback covering 30-day lifecycle
    if (items.length === 0 && options.includeMockFallback) {
      const today = new Date();
      const dNew = new Date(today); dNew.setDate(dNew.getDate() - 2);
      const dUpdated = new Date(today); dUpdated.setDate(dUpdated.getDate() - 10);
      const dDecided = new Date(today); dDecided.setDate(dDecided.getDate() - 18);

      const placeName = this.parishFilter || 'Ramsey';

      items.push(
        {
          id: `hdc-plan-mock-01`,
          title: `Erection of single-storey rear extension and garage conversion`,
          reference: `26/00189/FUL`,
          address: `14 High Street, ${placeName}, PE26 1AA`,
          proposal: `Proposal for single-storey rear extension and internal alterations in ${placeName} Conservation Area.`,
          statusCategory: `NEW`,
          badgeClass: `badge-new`,
          statusLabel: `New Application`,
          appState: `Awaiting Decision`,
          mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('14 High Street, ' + placeName + ', PE26 1AA')}`,
          content: `Proposal for single-storey rear extension and internal alterations in ${placeName} Conservation Area.`,
          url: `https://publicaccess.huntingdonshire.gov.uk/online-applications/applicationDetails.do?activeTab=summary&keyVal=${placeName.toUpperCase()}NEW01`,
          date: dNew.toISOString(),
          category: 'Planning & Development',
          sourceId: this.id,
          sourceName: this.name
        },
        {
          id: `hdc-plan-mock-02`,
          title: `Outline application for 4 residential dwellings with layout and access`,
          reference: `26/00142/OUT`,
          address: `Land North of Great Whyte, ${placeName}`,
          proposal: `Outline application for 4 residential dwellings with layout and access details submitted for consultation.`,
          statusCategory: `UPDATED`,
          badgeClass: `badge-progress`,
          statusLabel: `Under Consultation`,
          appState: `Under Consultation`,
          mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Land North of Great Whyte, ' + placeName)}`,
          content: `Updated highways authority report and revised site layout drawing submitted for 4 residential dwellings.`,
          url: `https://publicaccess.huntingdonshire.gov.uk/online-applications/applicationDetails.do?activeTab=summary&keyVal=${placeName.toUpperCase()}UPD02`,
          date: dUpdated.toISOString(),
          category: 'Planning & Development',
          sourceId: this.id,
          sourceName: this.name
        },
        {
          id: `hdc-plan-mock-03`,
          title: `Crown reduction of Oak tree by 2.5m`,
          reference: `26/00095/TREE`,
          address: `8 Stocking Fen Road, ${placeName}, PE26 1SA`,
          proposal: `Crown reduction of Oak tree by 2.5m. Tree works consent granted by HDC Arboricultural Officer.`,
          statusCategory: `DECIDED`,
          badgeClass: `badge-approved`,
          statusLabel: `Approved`,
          decisionOutcome: `PERMITTED - Approved with Conditions`,
          appState: `Decided`,
          mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('8 Stocking Fen Road, ' + placeName + ', PE26 1SA')}`,
          content: `Crown reduction of Oak tree by 2.5m in rear garden.`,
          url: `https://publicaccess.huntingdonshire.gov.uk/online-applications/applicationDetails.do?activeTab=summary&keyVal=${placeName.toUpperCase()}DEC03`,
          date: dDecided.toISOString(),
          category: 'Planning & Development',
          sourceId: this.id,
          sourceName: this.name
        }
      );

      items.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    return items;
  }
}

module.exports = HdcPlanningSource;
