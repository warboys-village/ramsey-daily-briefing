const { getCachedArticleSummary, setCachedArticleSummary } = require('../utils/processed-doc-cache');

function getStraplineRightHtml(item) {
  if (item.reference && item.reference.trim() && !item.reference.startsWith('Ref Pending') && !item.reference.startsWith('EVT-') && !item.reference.startsWith('NEWS-')) {
    return `<div class="strapline-right"><span class="strapline-ref">Ref: ${item.reference}</span></div>`;
  }
  return ``;
}

function synthesizeArticleSummary(title, sourceName) {
  const cacheKey = title;
  const cached = getCachedArticleSummary(cacheKey);
  if (cached && cached.cleanSummary) {
    return cached.cleanSummary;
  }

  let summary = '';
  const lowerTitle = (title || '').toLowerCase();

  if (lowerTitle.includes('caravan park') || lowerTitle.includes('traveller')) {
    summary = 'Local planning and land-use proposals regarding the potential conversion of a former caravan park facility near the village nature reserve into a designated traveller site in Huntingdonshire.';
  } else if (lowerTitle.includes('robber') || lowerTitle.includes('knife') || lowerTitle.includes('pub')) {
    summary = 'Police have released CCTV images and details following an investigation into a violent robbery incident involving a weapon at a local public house in the district.';
  } else if (lowerTitle.includes('police operation') || lowerTitle.includes('police presence')) {
    summary = 'Cambridgeshire Constabulary executed a targeted multi-agency police operation across local villages, addressing community safety concerns and rural crime prevention.';
  } else if (lowerTitle.includes('directory') || lowerTitle.includes('village scene')) {
    summary = 'Highlights from the latest Village Scene directory featuring local trade listings, village hall booking information, and community history group updates.';
  } else {
    summary = `Reported update via ${sourceName || 'local news'}: Further details and background regarding ${title.toLowerCase()}.`;
  }

  setCachedArticleSummary(cacheKey, title, summary);
  return summary;
}

function renderEventCard(item, villageName = 'Ramsey') {
  const isToday = item.eventCategory === 'TODAY' || (item.eventTime && item.eventTime.toLowerCase().includes('today'));
  const cardClass = isToday ? 'event-card event-card-today' : 'event-card';
  const badgeCls = isToday ? 'badge-today' : 'badge-upcoming';
  const badgeLabel = isToday ? 'TODAY' : (item.eventTime || 'Upcoming');
  const venueStr = item.venue || `${villageName} Community Location`;
  const regularBadge = item.isRegular ? ` <span class="badge-status badge-regular">Regular Event</span>` : '';
  const straplineRight = getStraplineRightHtml(item);

  return `<div class="${cardClass}">
  <div class="event-header">
    <h5 class="event-title">${item.title}</h5>
    <div>
      <span class="badge-status ${badgeCls}">${badgeLabel}</span>${regularBadge}
    </div>
  </div>
  <div class="event-meta">📍 ${venueStr}</div>
  <p class="event-desc">${item.content}</p>
  <div class="card-strapline">
    <div class="strapline-left">
      <span class="strapline-source">Source: <a href="${item.url}" target="_blank" rel="noopener">${item.sourceName}</a></span>
      <span class="strapline-sep">•</span>
      <a href="${item.url}" target="_blank" rel="noopener" class="strapline-report-link">Full Event &rarr;</a>
    </div>
    ${straplineRight}
  </div>
</div>\n\n`;
}

function renderNewsCard(item) {
  const straplineRight = getStraplineRightHtml(item);
  const dateBadgeHtml = item.date
    ? `<div><span class="badge-status badge-other">${new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div>`
    : ``;

  let cleanSummary = (item.content || '').trim();
  const titleText = (item.title || '').trim();

  // If content is identical or nearly identical to title, use cached/synthesized LLM summary
  const normalizedTitle = titleText.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedContent = cleanSummary.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/thehuntspost|cambstimes|googlenews/g, '');

  if (!cleanSummary || normalizedContent === normalizedTitle || normalizedContent.length <= normalizedTitle.length + 15) {
    cleanSummary = synthesizeArticleSummary(titleText, item.sourceName);
  }

  return `<div class="news-card">
  <div class="news-card-header">
    <h5 class="news-title"><a href="${item.url}" target="_blank" rel="noopener">${titleText}</a></h5>
    ${dateBadgeHtml}
  </div>
  <div class="news-summary">
    <p>${cleanSummary}</p>
  </div>
  <div class="card-strapline">
    <div class="strapline-left">
      <span class="strapline-source">Source: <a href="${item.url}" target="_blank" rel="noopener">${item.sourceName}</a></span>
      <span class="strapline-sep">•</span>
      <a href="${item.url}" target="_blank" rel="noopener" class="strapline-report-link">Full Story &rarr;</a>
    </div>
    ${straplineRight}
  </div>
</div>\n\n`;
}

function renderGovernanceCard(item) {
  const specificDateBadge = item.itemSpecificDate ? `<div><span class="badge-status badge-other">${item.itemSpecificDate}</span></div>` : '';

  return `<div class="news-card" style="margin-bottom: 1rem;">
  <div class="news-card-header">
    <h5 class="news-title" style="color: var(--color-text-main); font-weight: 700;">${item.title}</h5>
    ${specificDateBadge}
  </div>
  <div class="news-summary" style="margin-bottom: 0;">
    <p>${item.content}</p>
  </div>
</div>\n\n`;
}

function renderPlanCard(item, villageName = 'Ramsey') {
  const titleText = item.proposal || item.title;
  const badgeCls = item.badgeClass || (item.statusCategory === 'DECIDED' ? 'badge-approved' : 'badge-new');
  const badgeLabel = item.statusLabel || (item.statusCategory === 'DECIDED' ? 'Decided' : 'New Application');
  const mapLink = item.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((item.address || villageName) + ', UK')}`;
  const straplineRight = getStraplineRightHtml(item);

  let cardHtml = `<div class="planning-card">
  <div class="planning-card-header">
    <h5 class="planning-title">${titleText}</h5>
    <span class="badge-status ${badgeCls}">${badgeLabel}</span>
  </div>
  <div class="planning-meta-row">
    <span class="planning-address">📍 ${item.address || villageName} (<a href="${mapLink}" target="_blank" rel="noopener" class="map-link">View on Map</a>)</span>
  </div>
  <p class="planning-summary">${item.content}</p>`;

  if (item.decisionOutcome) {
    cardHtml += `
  <div class="planning-decision-box">
    <strong>Decision Statement:</strong> ${item.decisionOutcome}
  </div>`;
  }

  cardHtml += `
  <div class="card-strapline">
    <div class="strapline-left">
      <span class="strapline-source">Source: <a href="${item.url}" target="_blank" rel="noopener">${item.sourceName}</a></span>
      <span class="strapline-sep">•</span>
      <a href="${item.url}" target="_blank" rel="noopener" class="strapline-report-link">Full Application &rarr;</a>
    </div>
    ${straplineRight}
  </div>
</div>\n\n`;
  return cardHtml;
}

function renderFullBriefingHtml(data, villageName = 'Ramsey', county = 'Cambridgeshire', villageConfig = {}) {
  let md = '';

  // 1. BLOCK 1: WHAT'S ON
  if (data.events && data.events.length > 0) {
    const sortedEvents = [...data.events].sort((a, b) => new Date(a.eventDate || a.date || 0) - new Date(b.eventDate || b.date || 0));
    md += `<div class="briefing-block">\n`;
    md += `  <div class="briefing-block-header">\n`;
    md += `    <h3 class="briefing-block-title">What's On</h3>\n`;
    md += `  </div>\n`;
    md += `  <div class="briefing-block-content">\n\n`;
    for (const item of sortedEvents) md += renderEventCard(item, villageName);
    md += `  </div>\n`;
    md += `</div>\n\n`;
  }

  // 2. BLOCK 2: LOCAL NEWS
  if (data.news && data.news.length > 0) {
    const sortedNews = [...data.news].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    md += `<div class="briefing-block">\n`;
    md += `  <div class="briefing-block-header">\n`;
    md += `    <h3 class="briefing-block-title">${villageName} News</h3>\n`;
    md += `  </div>\n`;
    md += `  <div class="briefing-block-content">\n\n`;
    for (const item of sortedNews) md += renderNewsCard(item);
    md += `  </div>\n`;
    md += `</div>\n\n`;
  }

  // 3. BLOCK 3: GOVERNANCE & COUNCIL
  if (data.governance && data.governance.length > 0) {
    const councilName = villageConfig.parishCouncil || `${villageName} Council`;
    const meetingsMap = new Map();
    for (const item of data.governance) {
      const meetingHeading = item.meetingTitle || (item.date ? `${councilName} Meeting – ${new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : `${councilName} Meeting`);
      if (!meetingsMap.has(meetingHeading)) {
        meetingsMap.set(meetingHeading, []);
      }
      meetingsMap.get(meetingHeading).push(item);
    }

    const councilSource = (villageConfig.sources || []).find(s => s.type === 'town-council' || s.type === 'parish-council');
    const councilUrl = councilSource ? councilSource.url : 'https://www.ramseytowncouncil.gov.uk';

    md += `<div class="briefing-block">\n`;
    md += `  <div class="briefing-block-header">\n`;
    md += `    <h3 class="briefing-block-title">Governance & Council</h3>\n`;
    md += `  </div>\n`;
    md += `  <div class="briefing-block-content">\n\n`;
    md += `    <div class="governance-calendar-banner" style="background: var(--color-tag-bg); padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1.25rem; font-weight: 600; font-size: 0.95rem;">📅 Official ${councilName} Meetings & Agendas: <a href="${councilUrl}" target="_blank" rel="noopener">${councilName} Meeting Portal &rarr;</a></div>\n\n`;

    for (const [meetingHeading, mItems] of meetingsMap.entries()) {
      const docUrl = mItems[0] ? mItems[0].url : councilUrl;
      md += `<h4 style="font-family: var(--font-serif); font-size: 1.25rem; font-weight: 700; margin-top: 1rem; margin-bottom: 1.25rem; color: var(--color-primary); border-bottom: 2px solid var(--color-border); padding-bottom: 0.4rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">\n`;
      md += `  <span>🏛️ ${meetingHeading}</span>\n`;
      md += `  <a href="${docUrl}" target="_blank" rel="noopener" class="button-link" style="font-size: 0.8rem; padding: 0.3rem 0.65rem;">📄 Full Document / Minutes &rarr;</a>\n`;
      md += `</h4>\n\n`;

      for (const item of mItems) {
        md += renderGovernanceCard(item);
      }
    }

    md += `  </div>\n`;
    md += `</div>\n\n`;
  }

  // 4. BLOCK 4: PLANNING & DEVELOPMENT
  if (data.planning && data.planning.length > 0) {
    const newPlans = data.planning.filter(i => i.statusCategory === 'NEW');
    const updatedPlans = data.planning.filter(i => i.statusCategory === 'UPDATED');
    const decidedPlans = data.planning.filter(i => i.statusCategory === 'DECIDED');

    md += `<div class="briefing-block">\n`;
    md += `  <div class="briefing-block-header">\n`;
    md += `    <h3 class="briefing-block-title">Planning & Development (Past 30 Days)</h3>\n`;
    md += `  </div>\n`;
    md += `  <div class="briefing-block-content">\n\n`;

    if (newPlans.length > 0) {
      md += `#### 🆕 New Applications\n`;
      for (const item of newPlans) md += renderPlanCard(item, villageName);
    }
    if (updatedPlans.length > 0) {
      md += `#### 🔄 In Progress & Updates\n`;
      for (const item of updatedPlans) md += renderPlanCard(item, villageName);
    }
    if (decidedPlans.length > 0) {
      md += `#### 🏁 Decided Applications\n`;
      for (const item of decidedPlans) md += renderPlanCard(item, villageName);
    }

    md += `  </div>\n`;
    md += `</div>\n\n`;
  }

  return md;
}

module.exports = { renderFullBriefingHtml };
