const fs = require('fs');
const path = require('path');

module.exports = function() {
  const dir = path.join(__dirname, 'daily_sources');
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const list = [];

  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8');
      const data = JSON.parse(content);
      list.push(data);
    } catch (err) {
      console.warn(`[dailySources] Error loading ${f}:`, err.message);
    }
  }

  // Sort by date descending
  return list.sort((a, b) => b.date.localeCompare(a.date));
};
