/**
 * RFC 5545 iCalendar (.ics) Feed Generator
 */

function formatIcsDate(dateStr) {
  if (!dateStr) return '20260901';
  const clean = dateStr.replace(/[^0-9]/g, '');
  if (clean.length >= 8) return clean.slice(0, 8);
  
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '20260901';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function formatIcsNextDay(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '20260902';
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function escapeIcsText(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generates an RFC 5545 iCalendar string from an array of event objects.
 */
function generateIcs(calendarName, events = []) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Warboys Daily Briefing//Village Events Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'X-WR-TIMEZONE:Europe/London'
  ];

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  for (const evt of events) {
    const startDateStr = formatIcsDate(evt.eventDate || evt.date);
    const endDateStr = formatIcsNextDay(evt.eventDate || evt.date);

    const uid = evt.id || `evt-${startDateStr}-${Math.random().toString(36).slice(2, 6)}`;
    const summary = escapeIcsText(evt.title || 'Warboys Community Event');
    const description = escapeIcsText(evt.content || evt.notes || evt.title);
    const location = escapeIcsText(evt.venue || 'Warboys, PE28');
    const url = evt.url || 'https://www.warboysparishcouncil.gov.uk/';

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}@village-daily`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;VALUE=DATE:${startDateStr}`,
      `DTEND;VALUE=DATE:${endDateStr}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      `URL:${url}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

module.exports = {
  generateIcs,
  formatIcsDate
};
