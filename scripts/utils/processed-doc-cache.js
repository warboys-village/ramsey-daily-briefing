const fs = require('fs');
const path = require('path');

const CACHE_FILE_PATH = path.join(__dirname, '..', '..', 'src', '_data', 'processed_documents_cache.json');

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`[DocCache] Error reading cache file:`, err.message);
  }
  return {};
}

function saveCache(cacheData) {
  try {
    const dir = path.dirname(CACHE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Automatic Cache Pruning: Keep entries < 180 days old, cap at 500 entries
    const cutoffMs = Date.now() - (180 * 24 * 60 * 60 * 1000);
    const maxEntries = 500;

    const entries = Object.keys(cacheData).map(k => ({
      key: k,
      val: cacheData[k],
      time: new Date(cacheData[k]?.processedAt || 0).getTime()
    }));

    const validEntries = entries
      .filter(e => e.time === 0 || e.time >= cutoffMs)
      .sort((a, b) => b.time - a.time)
      .slice(0, maxEntries);

    const prunedCache = {};
    for (const e of validEntries) {
      prunedCache[e.key] = e.val;
    }

    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(prunedCache, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[DocCache] Error saving cache file:`, err.message);
  }
}

function getCachedDocument(docUrl) {
  if (!docUrl) return null;
  const cache = loadCache();
  const entry = cache[docUrl];
  if (entry && Array.isArray(entry.extractedItems)) {
    return entry.extractedItems;
  }
  return null;
}

function setCachedDocument(docUrl, extractedItems) {
  if (!docUrl || !Array.isArray(extractedItems)) return;
  const cache = loadCache();
  cache[docUrl] = {
    processedAt: new Date().toISOString(),
    extractedItems
  };
  saveCache(cache);
}

function getCachedArticleSummary(itemKey) {
  if (!itemKey) return null;
  const cache = loadCache();
  const entry = cache[`summary:${itemKey}`];
  if (entry && entry.cleanTitle && entry.cleanSummary) {
    return { cleanTitle: entry.cleanTitle, cleanSummary: entry.cleanSummary };
  }
  return null;
}

function setCachedArticleSummary(itemKey, cleanTitle, cleanSummary) {
  if (!itemKey || !cleanSummary) return;
  const cache = loadCache();
  cache[`summary:${itemKey}`] = {
    processedAt: new Date().toISOString(),
    cleanTitle,
    cleanSummary
  };
  saveCache(cache);
}

module.exports = {
  loadCache,
  saveCache,
  getCachedDocument,
  setCachedDocument,
  getCachedArticleSummary,
  setCachedArticleSummary
};
