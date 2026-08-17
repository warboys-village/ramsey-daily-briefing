function isDeathNotice(item) {
  if (!item) return false;

  const rawTitle = (item.title || '').trim();
  const content = (item.content || '').trim();
  const rawUrl = (item.url || '').toLowerCase();
  const combined = `${rawTitle} ${content}`.toLowerCase();

  // Layer 1: URL domain & path pattern check
  const deathUrlPatterns = [
    '/announcements/', '/obituaries/', '/in-memoriam/',
    '/family-notices/', '/notices/death/', 'familynotices.co.uk',
    'funeral-notices.co.uk', 'bmms.co.uk', 'remembering-'
  ];
  if (deathUrlPatterns.some(p => rawUrl.includes(p))) {
    return true;
  }

  // Layer 2: Dynamic suffix cleaning (strips any trailing source suffix like "- huntspost.co.uk", "- The Hunts Post", etc.)
  const cleanTitle = rawTitle
    .replace(/\s*-\s*[a-z0-9.-]+\.(?:co\.uk|com|org|net|gov\.uk)$/i, '')
    .replace(/\s*-\s*(?:The Hunts Post|The Hunts Post News|Cambs Times|Google News)$/i, '')
    .trim();

  // Layer 3: Expanded death notice & obituary keyword/phrase dictionary
  const deathKeywords = [
    'death notice', 'death notices', 'obituary', 'obituaries',
    'funeral notice', 'funeral notices', 'in memoriam',
    'passed away', 'beloved wife', 'beloved husband',
    'beloved mother', 'beloved father', 'beloved son', 'beloved daughter',
     'beloved sister', 'beloved brother', 'beloved grandmother', 'beloved grandfather',
    'in loving memory', 'peacefully on', 'crematorium',
    'funeral service', 'family flowers only', 'donations in lieu',
    'late of', 'deeply missed', 'sadly passed', 'dearly loved'
  ];
  if (deathKeywords.some(kw => combined.includes(kw))) {
    return true;
  }

  // Layer 4: Structural Name + Age Pattern & ALL-CAPS Name Detection
  // Matches "NAME, Age", "NAME (Age)", "NAME - aged Age"
  const nameAgePattern = /^[A-Z\s'-]+(?:,\s*\d{1,3}|\s*\(\d{1,3}\)|\s*-\s*aged\s+\d{1,3})/i;
  if (nameAgePattern.test(cleanTitle)) {
    return true;
  }

  const lettersOnly = cleanTitle.replace(/[^A-Za-z]/g, '');
  if (lettersOnly.length > 5 && lettersOnly === lettersOnly.toUpperCase()) {
    const isSpecialCaps = cleanTitle.includes('RAMSEY') || cleanTitle.includes('WARBOYS') || cleanTitle.includes('COUNCIL') || cleanTitle.includes('NOTICE') || cleanTitle.includes('PLANNING') || cleanTitle.includes('PARISH') || cleanTitle.includes('TOWN') || cleanTitle.includes('ROAD') || cleanTitle.includes('CLOSURE') || cleanTitle.includes('MEETING') || cleanTitle.includes('POLICE') || cleanTitle.includes('SCHOOL');
    if (!isSpecialCaps) {
      return true;
    }
  }

  return false;
}

function preFilterItems(rawItems, config = {}, nowDate = new Date()) {
  const { maxDays = 30, maxItemSnippetLength = 800, maxTotalItems = 24 } = config;

  const seenTitles = new Set();
  const filtered = [];

  // Separate governance, planning, events (high priority) from generic news
  const highPriority = [];
  const genericNews = [];

  for (const item of rawItems) {
    if (!item || !item.title || !item.url) continue;
    if (isDeathNotice(item)) continue;

    const catStr = (item.category || '').toLowerCase();
    const srcStr = (item.sourceName || '').toLowerCase();
    const srcIdStr = (item.sourceId || '').toLowerCase();

    const isHighPriority = catStr.includes('governance') || catStr.includes('event') || catStr.includes('plan') || srcStr.includes('parish council') || srcStr.includes('town council') || srcIdStr === 'ramsey-town' || srcIdStr === 'warboys-parish';
    
    if (isHighPriority) {
      highPriority.push(item);
    } else {
      genericNews.push(item);
    }
  }

  // Sort each group by date descending
  highPriority.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  genericNews.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // Combine with high-priority items first so local governance, planning, and events are never truncated
  const combinedRaw = [...highPriority, ...genericNews];

  for (const item of combinedRaw) {
    // Clean title by removing source prefixes/suffixes
    let cleanTitle = item.title.trim()
      .replace(/^FOWL Blog:\s*/i, '')
      .replace(/^Warboys Parish Council:\s*/i, '')
      .replace(/^Ramsey Town Council:\s*/i, '')
      .replace(/^Village Scene Magazine:\s*/i, '')
      .replace(/\s*-\s*The Hunts Post$/i, '')
      .replace(/\s*-\s*The Hunts Post News$/i, '')
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

    // Clean text snippet and strip social sharing UI fluff like "Share Share"
    let cleanedContent = (item.content || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^(?:share\s*)+/i, '')
      .replace(/^(?:share\s*(?:facebook|twitter|whatsapp|email)?\s*)+/i, '')
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

module.exports = { preFilterItems };
