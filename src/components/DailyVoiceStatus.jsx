import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, X } from 'lucide-react';
import { resolveApiUrl } from '../api';

export default function DailyVoiceStatus({ voice, remaining, large = false, emptyHref = '/culture' }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  const bubble = (
    <>
      <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange via-gold to-green ${large ? 'h-[5.75rem] w-[5.75rem] p-[3px]' : 'h-[4.25rem] w-[4.25rem] p-[2px]'}`}>
        <span className="grid h-full w-full place-items-center rounded-full border-2 border-white bg-brown font-display font-bold uppercase text-gold">
          {voice?.speaker_name?.trim()?.[0] || <Mic size={large ? 25 : 19}/>}
        </span>
      </span>
      <span className={`mt-1.5 block max-w-[5.5rem] truncate text-center font-bold ${large ? 'text-xs text-white' : 'text-[9px] text-brown'}`}>
        {voice?.speaker_name || 'Voice today'}
      </span>
    </>
  );

  return (
    <>
      <div className={`flex shrink-0 flex-col items-center ${large ? 'min-w-[7rem]' : 'w-[5.25rem]'}`}>
        {voice ? (
          <button type="button" onClick={() => setIsOpen(true)} aria-label={`Open Voice of the Day by ${voice.speaker_name || 'community voice'}`} className="group flex flex-col items-center rounded-xl p-1 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange">
            {bubble}
          </button>
        ) : (
          <Link to={emptyHref} aria-label="Visit Kokwet Voice Circle" className="group flex flex-col items-center rounded-xl p-1 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange">
            {bubble}
          </Link>
        )}
        {large && (
          <span className="mt-2 text-center text-[9px] font-black uppercase tracking-[.14em] text-gold">
            Voice of the Day
          </span>
        )}
      </div>

      {large && (
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[.2em] text-gold">Voice Circle status</p>
          <h2 className="mt-1 font-display text-xl font-bold text-white">Voice of the Day</h2>
          <p className="mt-1 text-xs leading-5 text-white/65">
            {voice
              ? `Selected community voice${voice.house_name ? ` from ${voice.house_name}` : ''}. Tap the circle to read or listen.`
              : 'No voice has been selected yet. Share a post and nominate it for review.'}
          </p>
          {Number.isInteger(remaining) && (
            <p className="mt-2 text-[10px] font-semibold text-white/50">{remaining} of 100 nominations remain today</p>
          )}
        </div>
      )}

      {isOpen && voice && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-brown/85 p-4 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <article role="dialog" aria-modal="true" aria-labelledby="daily-voice-dialog-title" className="relative w-full max-w-lg rounded-2xl bg-offwhite p-6 text-brown shadow-2xl sm:p-8" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close Voice of the Day" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-brown/10"><X size={18}/></button>
            <div className="flex flex-col items-center text-center">
              <span className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-orange via-gold to-green p-[3px]">
                <span className="grid h-full w-full place-items-center rounded-full border-2 border-white bg-brown font-display text-2xl font-bold uppercase text-gold">{voice.speaker_name?.trim()?.[0] || <Mic size={26}/>}</span>
              </span>
              <p className="mt-4 text-[9px] font-black uppercase tracking-[.2em] text-orange">{voice.house_name || 'Voice Circle'}{voice.dialect ? ` · ${voice.dialect}` : ''}</p>
              <h3 id="daily-voice-dialog-title" className="mt-1 font-display text-2xl font-bold">{voice.speaker_name || 'Community voice'}</h3>
            </div>
            {voice.text_message && <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-brown/80">{voice.text_message}</p>}
            {voice.audio_clip_url && <audio controls autoPlay preload="none" className="mt-5 h-10 w-full" src={resolveApiUrl(voice.audio_clip_url)}>Your browser does not support audio playback.</audio>}
          </article>
        </div>
      )}
    </>
  );
}
