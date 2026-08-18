function isDeathNotice(item) {
  const title = (item.title || '').trim();
  const text = `${title} ${item.content || ''}`.toLowerCase();
  const deathKeywords = [
    'death notice',
    'death notices',
    'obituary',
    'obituaries',
    'in memoriam',
    'acknowledgements',
    'passed away peacefully',
    'sadly passed away',
    'funeral service',
    'crematorium service',
    'family flowers only'
  ];

  for (const kw of deathKeywords) {
    if (text.includes(kw)) {
      return true;
    }
  }

  // Detect Hunts Post obituary / death notice columns (e.g. ALL CAPS name + "- The Hunts Post")
  if (text.includes('the hunts post')) {
    if (text.includes('death') || text.includes('notice') || text.includes('funeral') || text.includes('memoriam')) {
      return true;
    }
    const namePart = title.replace(/\s*-\s*The Hunts Post$/i, '').trim();
    if (namePart.length >= 4 && namePart === namePart.toUpperCase() && !namePart.includes('COUNCIL') && !namePart.includes('RAMSEY')) {
      return true;
    }
  }

  return false;
}

function preFilterItems(rawItems, config = {}, nowDate = new Date()) {
  const { maxDays = 30, maxItemSnippetLength = 800, maxTotalItems = 80 } = config;

  const seenTitles = new Set();
  const filtered = [];

  // Group items into distinct categories so general news is guaranteed slots
  const generalNews = [];
  const schoolNews = [];
  const governanceAndPlanning = [];
  const events = [];

  for (const item of rawItems) {
    if (!item || !item.title || !item.url) continue;
    if (isDeathNotice(item)) continue;

    const catStr = (item.category || '').toLowerCase();
    const srcStr = (item.sourceName || '').toLowerCase();
    const srcIdStr = (item.sourceId || '').toLowerCase();

    const isSchool = srcIdStr.includes('school') || srcIdStr.includes('college') || srcIdStr.includes('abbey-college') || catStr.includes('school') || srcStr.includes('college');
    const isGovOrPlan = catStr.includes('governance') || catStr.includes('plan') || srcStr.includes('council') || srcIdStr === 'ramsey-town' || srcIdStr === 'cambs-county' || srcIdStr === 'hdc-planning';
    const isEvent = catStr.includes('event') || srcIdStr.includes('event');

    if (isSchool) {
      schoolNews.push(item);
    } else if (isGovOrPlan) {
      governanceAndPlanning.push(item);
    } else if (isEvent) {
      events.push(item);
    } else {
      generalNews.push(item);
    }
  }

  // Sort each group by date descending
  generalNews.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  governanceAndPlanning.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  events.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  schoolNews.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // Combine with general news & governance first, capping internal school items to 3 max
  const combinedRaw = [
    ...generalNews,
    ...governanceAndPlanning,
    ...events,
    ...schoolNews.slice(0, 3)
  ];

  for (const item of combinedRaw) {
    // Clean title by removing source prefixes/suffixes and filesize noise
    let cleanTitle = item.title.trim()
      .replace(/^FOWL Blog:\s*/i, '')
      .replace(/^Warboys Parish Council:\s*/i, '')
      .replace(/^Ramsey Town Council:\s*/i, '')
      .replace(/^Village Scene Magazine:\s*/i, '')
      .replace(/\s*-\s*The Hunts Post$/i, '')
      .replace(/\s*-\s*The Hunts Post News$/i, '')
      .replace(/\b\d+(?:KB|MB)\b/gi, '')
      .trim();

    // Check date cutoff (allow up to 60 days for governance items so latest monthly meeting minutes are preserved)
    if (item.date) {
      const d = new Date(item.date);
      const isGov = (item.sourceId === 'ramsey-town' || item.sourceId === 'warboys-parish') || (item.category || '').toLowerCase().includes('governance');
      const itemMaxDays = isGov ? 60 : maxDays;
      const itemCutoff = new Date(nowDate);
      itemCutoff.setDate(itemCutoff.getDate() - itemMaxDays);
      if (!isNaN(d.getTime()) && d < itemCutoff) continue;
    }

    // Deduplicate by normalized title + date key
    const normalizedTitle = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dateKey = (item.eventDate || item.date || '').slice(0, 10);
    const dedupeKey = `${normalizedTitle}_${dateKey}`;
    if (seenTitles.has(dedupeKey)) continue;

    seenTitles.add(dedupeKey);

    // Clean text snippet and strip social sharing UI fluff like "Share Share" & file sizes
    let cleanedContent = (item.content || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^(?:share\s*)+/i, '')
      .replace(/^(?:share\s*(?:facebook|twitter|whatsapp|email)?\s*)+/i, '')
      .replace(/\b\d+(?:KB|MB)\b/gi, '')
      .trim();

    if (cleanedContent.length > maxItemSnippetLength) {
      cleanedContent = cleanedContent.slice(0, maxItemSnippetLength) + '...';
    }

    filtered.push({
      ...item,
      title: cleanTitle,
      content: cleanedContent
    });

    if (filtered.length >= maxTotalItems) break;
  }

  return filtered;
}

module.exports = { preFilterItems, isDeathNotice };
