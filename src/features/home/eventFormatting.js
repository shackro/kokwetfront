const EVENT_TIME_ZONE = 'Africa/Nairobi';

export function formatEventDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: EVENT_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatEventDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: EVENT_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

export function getGoogleCalendarUrl(event) {
  const start = new Date(event.date);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const calendarDate = (date) => date.toISOString().replaceAll(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const parameters = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${calendarDate(start)}/${calendarDate(end)}`,
    details: `${event.focus} Official event information: ${event.external_url}`,
    location: event.venue,
  });
  return `https://calendar.google.com/calendar/render?${parameters}`;
}
