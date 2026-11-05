import { CalendarPlus, ExternalLink, Share2, Sparkles } from 'lucide-react';
import { formatEventDateTime, getGoogleCalendarUrl } from './eventFormatting';

const POKOTFEST_SITE = 'https://pokotfest.com/';

export default function PokotFestPromotion({ event, now }) {
  const timestamp = Date.parse(event.date);
  const daysUntil = Math.max(0, Math.ceil((timestamp - now) / 86400000));
  const eventIsUpcoming = timestamp > now;
  const shareText = `Join us for ${event.title} on ${formatEventDateTime(event.date)}. Find event details at ${POKOTFEST_SITE}`;
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <aside aria-labelledby="pokotfest-promotion-title" className="pokotfest-promotion">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 sm:px-7 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-gold">
            <Sparkles size={14}/>
            <span>Coming up first</span>
            {eventIsUpcoming&&<span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] tracking-wider text-white">{daysUntil} {daysUntil===1?'day':'days'} to go</span>}
          </div>
          <h2 id="pokotfest-promotion-title" className="mt-1.5 font-display text-xl font-bold text-white sm:text-2xl">
            {event.title}
          </h2>
          <p className="mt-1 text-xs text-white/70">{formatEventDateTime(event.date)} · {event.venue}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={getGoogleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className="pokotfest-promotion__secondary">
            <CalendarPlus size={15}/> Add reminder
          </a>
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="pokotfest-promotion__secondary">
            <Share2 size={15}/> Share event
          </a>
          <a href={POKOTFEST_SITE} target="_blank" rel="noopener noreferrer" className="pokotfest-promotion__primary">
            Visit PokotFest <ExternalLink size={15}/>
          </a>
        </div>
      </div>
    </aside>
  );
}
