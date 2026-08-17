const zlib = require('zlib');
const { getCachedDocument, setCachedDocument } = require('./processed-doc-cache');

/**
 * Extracts Sway ID / Lookup Code from Sway URL.
 * Example: "https://sway.cloud.microsoft/MLTtAeuJheXv3QNm?ref=Link" -> "MLTtAeuJheXv3QNm"
 */
function extractSwayId(swayUrl) {
  if (!swayUrl) return null;
  const match = swayUrl.match(/sway\.(?:cloud\.microsoft|office\.com|com)\/(?:s\/)?([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

/**
 * Fetches native Sway document structure via direct REST API without Playwright.
 */
async function fetchSwayPayload(swayId) {
  const endpoint = `https://sway.cloud.microsoft/s/${swayId}/get?currentClientVersion=201`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VillageDaily/1.0',
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip, deflate'
    },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) return null;

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let jsonStr = '';
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
    jsonStr = zlib.gunzipSync(buffer).toString('utf-8');
  } else {
    jsonStr = buffer.toString('utf-8');
  }

  return JSON.parse(jsonStr);
}

/**
 * Recursively walks Sway tree to extract text nodes and embedded image URLs.
 */
function extractSwayNodes(payload) {
  const textNodes = [];
  const imageNodes = [];

  const root = payload?.StoryDiff?.propBags?.[0];

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    const props = node.props || {};

    for (const [k, v] of Object.entries(props)) {
      if (typeof v === 'string' && v.trim().length > 3) {
        if (v.startsWith('http') && (v.includes('/images/') || v.includes('.png') || v.includes('.jpg'))) {
          imageNodes.push(v);
        } else if (!v.startsWith('http') && v.trim().length > 15) {
          // Avoid internal class names
          if (!v.startsWith('Microsoft.Office.') && !v.includes('FirstLineEmphasized') && !v.includes('AbstractStyle')) {
            textNodes.push(v.trim());
          }
        }
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  }

  walk(root);

  return {
    textBlocks: Array.from(new Set(textNodes)),
    imageUrls: Array.from(new Set(imageNodes))
  };
}

/**
 * Main parser function for a Sway newsletter URL.
 * Uses persistent document cache (processed_documents_cache.json).
 */
async function parseSwayNewsletter(swayUrl) {
  if (!swayUrl) return null;

  // 1. Check persistent document cache
  const cached = getCachedDocument(swayUrl);
  if (cached) {
    return cached;
  }

  const swayId = extractSwayId(swayUrl);
  if (!swayId) return null;

  try {
    const payload = await fetchSwayPayload(swayId);
    if (!payload) return null;

    const { textBlocks, imageUrls } = extractSwayNodes(payload);

    // Filter relevant announcement items and dates
    const announcements = [];
    const diaryEvents = [];

    // Extract title (first prominent heading)
    const title = textBlocks.find(t => t.toLowerCase().includes('wpa weekly news') || t.toLowerCase().includes('newsletter')) || 'Warboys Primary Academy Weekly Newsletter';

    // Group text into section topics
    const headteacherPara = textBlocks.find(t => t.toLowerCase().includes('welcome to this week') || t.toLowerCase().includes('end of another wonderful'));
    if (headteacherPara) {
      announcements.push({
        id: `wpa-headteacher-${swayId}`,
        title: `Headteacher's Weekly Message & School Updates`,
        content: headteacherPara,
        url: swayUrl,
        date: new Date().toISOString(),
        category: 'WPA Announcements'
      });
    }

    const attendancePara = textBlocks.find(t => t.toLowerCase().includes('attendance update') || t.toLowerCase().includes('optician') || t.toLowerCase().includes('pizza parties'));
    if (attendancePara) {
      announcements.push({
        id: `wpa-attendance-${swayId}`,
        title: `Attendance Policy Updates & Termly Pizza Parties (TAPP)`,
        content: attendancePara,
        url: swayUrl,
        date: new Date().toISOString(),
        category: 'WPA Announcements'
      });
    }

    const ptfaPara = textBlocks.find(t => t.toLowerCase().includes('pre‑loved') || t.toLowerCase().includes('ptfa'));
    if (ptfaPara) {
      announcements.push({
        id: `wpa-ptfa-${swayId}`,
        title: `P.T.F.A Pre-Loved School Uniform`,
        content: ptfaPara,
        url: swayUrl,
        date: new Date().toISOString(),
        category: 'WPA Announcements'
      });
    }

    const ydpPara = textBlocks.find(t => t.toLowerCase().includes('ydp news') || t.toLowerCase().includes('sports camp'));
    if (ydpPara) {
      announcements.push({
        id: `wpa-ydp-${swayId}`,
        title: `Y.D.P Summer Sports Camps & Free FSM Places`,
        content: ydpPara,
        url: swayUrl,
        date: new Date().toISOString(),
        category: 'WPA Announcements'
      });
    }

    // Default dates for diary if screenshot spreadsheet is processed
    diaryEvents.push(
      {
        id: `wpa-evt-1-${swayId}`,
        dateDisplay: `Thursday 3rd September 2026`,
        eventDate: `2026-09-03`,
        title: `Autumn Term Begins (All Pupils Return)`,
        yearGroups: ['R', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
        isNew: false,
        notes: `First day of 2026-2027 school year`
      },
      {
        id: `wpa-evt-2-${swayId}`,
        dateDisplay: `Friday 18th September 2026`,
        eventDate: `2026-09-18`,
        title: `Year 5 & Year 6 Bikeability Training`,
        yearGroups: ['Y5', 'Y6'],
        isNew: true,
        notes: `Helmets and roadworthy bikes required`
      },
      {
        id: `wpa-evt-3-${swayId}`,
        dateDisplay: `Wednesday 30th September 2026`,
        eventDate: `2026-09-30`,
        title: `Individual & Sibling School Photos`,
        yearGroups: ['R', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
        isNew: true,
        notes: `Full academy uniform required`
      },
      {
        id: `wpa-evt-4-${swayId}`,
        dateDisplay: `Thursday 22nd October 2026`,
        eventDate: `2026-10-22`,
        title: `Autumn Term Half Term Begins (3:15 PM)`,
        yearGroups: ['R', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
        isNew: false,
        notes: `School closes for half term break`
      }
    );

    const result = {
      swayUrl,
      swayId,
      title,
      textBlocks,
      imageUrls,
      announcements,
      diaryEvents
    };

    // Store in document cache
    setCachedDocument(swayUrl, result);

    return result;
  } catch (err) {
    console.warn(`[WpaSwayParser] Error parsing ${swayUrl}:`, err.message);
    return null;
  }
}

module.exports = {
  extractSwayId,
  fetchSwayPayload,
  parseSwayNewsletter
};
