const fs = require('fs');
const path = require('path');

const CALENDAR_PATH = path.join(__dirname, '..', '..', 'src', '_data', 'events_calendar.json');

/**
 * Loads persistent events calendar from src/_data/events_calendar.json, filtering out past events.
 */
function loadCalendar(options = {}) {
  const { includePast = false } = options;
  let items = [];

  try {
    if (fs.existsSync(CALENDAR_PATH)) {
      const data = fs.readFileSync(CALENDAR_PATH, 'utf-8');
      items = JSON.parse(data) || [];
    }
  } catch (err) {
    console.warn('[EventsCalendarStore] Error loading calendar store:', err.message);
  }

  if (includePast) return items;

  // Filter out past events (keep current/today and future events, or regular recurring events)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return items.filter(evt => {
    if (evt.isRegular) return true;
    const evtDateStr = evt.eventDate || evt.date;
    if (!evtDateStr) return false;
    const d = new Date(evtDateStr);
    return !isNaN(d.getTime()) && d >= todayStart;
  });
}

/**
 * Saves and deduplicates events in src/_data/events_calendar.json, filtering out past events.
 */
function saveCalendar(newEvents = []) {
  const existing = loadCalendar({ includePast: false });
  const seenKeys = new Set();
  const combined = [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const addEvent = (evt) => {
    if (!evt || !evt.title) return;

    // Filter out past non-regular events
    if (!evt.isRegular) {
      const evtDateStr = evt.eventDate || evt.date;
      if (evtDateStr) {
        const d = new Date(evtDateStr);
        if (!isNaN(d.getTime()) && d < todayStart) return;
      }
    }

    // Clean title key for strict deduplication
    const normTitle = evt.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isoDateStr = (evt.eventDate || evt.date || '').slice(0, 10);
    const dedupeKey = evt.isRegular ? `regular_${normTitle.slice(0, 30)}` : `oneoff_${normTitle.slice(0, 30)}_${isoDateStr}`;

    if (!seenKeys.has(dedupeKey)) {
      seenKeys.add(dedupeKey);
      combined.push({
        id: evt.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: evt.title.trim(),
        eventTime: evt.eventTime || 'Upcoming',
        eventCategory: evt.eventCategory || 'UPCOMING',
        isRegular: !!evt.isRegular,
        venue: evt.venue || 'Warboys Village Location',
        content: (evt.content || evt.title).trim(),
        url: evt.url || 'https://fowl.org.uk/',
        date: evt.date || new Date().toISOString(),
        eventDate: evt.eventDate || evt.date || new Date().toISOString(),
        category: 'Community Events',
        sourceId: evt.sourceId || 'events',
        sourceName: evt.sourceName || 'Community Source'
      });
    }
  };

  for (const item of existing) addEvent(item);
  for (const item of newEvents) addEvent(item);

  // Sort events by eventDate ascending
  combined.sort((a, b) => new Date(a.eventDate || a.date || 0) - new Date(b.eventDate || b.date || 0));

  try {
    fs.mkdirSync(path.dirname(CALENDAR_PATH), { recursive: true });
    fs.writeFileSync(CALENDAR_PATH, JSON.stringify(combined, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[EventsCalendarStore] Error saving calendar store:', err.message);
  }

  return combined;
}

module.exports = {
  loadCalendar,
  saveCalendar,
  CALENDAR_PATH
};
