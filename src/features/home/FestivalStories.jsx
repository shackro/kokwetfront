import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, MessageCircle, Mic, Radio, X } from 'lucide-react';
import { getJson, resolveApiUrl, resolveMediaUrl } from '../../api';

export default function FestivalStories() {
  const [stories, setStories] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loadError, setLoadError] = useState('');
  const [liveSession, setLiveSession] = useState(null);
  const [liveError, setLiveError] = useState('');

  useEffect(() => {
    let active = true;
    getJson('/v1/stories')
      .then((data) => {
        if (active) setStories(data.stories);
      })
      .catch(() => {
        if (active) setLoadError('Stories are temporarily unavailable.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getJson('/v1/live/current')
      .then((data) => {
        if (active) {
          setLiveSession(data.session);
          setLiveError('');
        }
      })
      .catch((error) => {
        if (active) setLiveError(error instanceof Error ? error.message : 'Live updates are unavailable.');
      });
    const timer = window.setInterval(() => {
      getJson('/v1/live/current')
        .then((data) => {
          if (active) {
            setLiveSession(data.session);
            setLiveError('');
          }
        })
        .catch((error) => {
          if (active) setLiveError(error instanceof Error ? error.message : 'Live updates are unavailable.');
        });
    }, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (selectedIndex < 0 || !stories.length) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedIndex(-1);
      if (event.key === 'ArrowRight') setSelectedIndex((index) => (index + 1) % stories.length);
      if (event.key === 'ArrowLeft') setSelectedIndex((index) => (index - 1 + stories.length) % stories.length);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedIndex, stories.length]);

  const selectedStory = stories[selectedIndex];

  return (
    <>
      <section className="w-full" aria-label="Kokwet Festival stories">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-7">
          <div className="hidden shrink-0 border-r border-white/20 pr-4 sm:block">
            <p className="text-[9px] font-black uppercase tracking-[.18em] text-gold">Kokwet</p>
            <p className="mt-1 text-[9px] text-white/55">Stories</p>
          </div>
          <div className="flex min-w-0 flex-1 items-start gap-3 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {liveSession?.is_active && (
                <Link to={`/live/${liveSession.session_id}`} aria-label={`Join active room: ${liveSession.topic_title}`} className="group flex w-[4.5rem] shrink-0 flex-col items-center rounded-lg px-1 py-0.5 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange">
                  <span className={`relative grid h-[3.55rem] w-[3.55rem] place-items-center rounded-full border-2 transition group-hover:scale-105 ${liveSession.stream_url ? 'border-red-500 bg-red-600/20 text-red-100' : 'border-green bg-green/20 text-green-100'}`}>{liveSession.stream_url ? <Radio size={19}/> : <MessageCircle size={19}/>}<span className={`absolute -bottom-1 rounded-full px-2 py-0.5 text-[7px] font-black uppercase tracking-wider text-white ${liveSession.stream_url ? 'bg-red-600' : 'bg-green'}`}>{liveSession.stream_url ? 'Live' : 'Room'}</span></span>
                  <span className="mt-1.5 block w-full truncate text-[9px] font-bold text-white/90">{liveSession.topic_title}</span>
                </Link>
              )}
              <Link to="/live" aria-label="Join the public lounge" className="group flex w-[4.5rem] shrink-0 flex-col items-center rounded-lg px-1 py-0.5 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange">
                <span className="grid h-[3.55rem] w-[3.55rem] place-items-center rounded-full border border-white/35 bg-brown/60 text-white/75 transition group-hover:border-gold"><MessageCircle size={19}/></span>
                <span className="mt-1.5 block w-full truncate text-[9px] font-bold text-white/90">Public lounge</span>
              </Link>
              {stories.map((story, index) => (
                <button
                  type="button"
                  key={story.story_id}
                  onClick={() => setSelectedIndex(index)}
                  aria-label={`${story.audio_clip_url ? 'Listen to' : 'Read'} story: ${story.title}`}
                  className="group flex w-[4.5rem] shrink-0 flex-col items-center rounded-lg px-1 py-0.5 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange"
                >
                  <span className="relative grid h-[3.55rem] w-[3.55rem] place-items-center rounded-full bg-gradient-to-br from-orange via-gold to-green p-[2px] transition group-hover:scale-105">
                    <span className="grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-brown bg-brown">
                      {story.cover_image_url
                        ? <img src={resolveMediaUrl(story.cover_image_url)} alt="" loading="lazy" className="h-full w-full object-cover"/>
                        : <span className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(246,155,16,.22),transparent_58%)] font-display text-lg font-bold text-gold">{story.title.trim().slice(0, 1).toUpperCase() || <BookOpen size={18}/>}</span>}
                    </span>
                    {story.audio_clip_url && <span className="absolute -bottom-0.5 right-0 grid h-5 w-5 place-items-center rounded-full border-2 border-brown bg-green text-white"><Mic size={10}/></span>}
                  </span>
                  <span className="mt-1.5 block w-full truncate text-[9px] font-bold text-white/90">{story.title}</span>
                </button>
              ))}
              {loadError && <p role="status" className="self-center text-[10px] text-white/60">{loadError}</p>}
              {liveError && <p role="status" className="self-center text-[10px] text-white/60">{liveError}</p>}
            </div>
        </div>
      </section>

      {selectedStory && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-brown/90 p-4 backdrop-blur-sm" onClick={() => setSelectedIndex(-1)}>
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-dialog-title"
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-offwhite shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute left-3 right-14 top-3 flex gap-1" aria-hidden="true">
              {stories.map((story) => (
                <span key={story.story_id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/40">
                  <span className={`block h-full bg-white ${stories[selectedIndex]?.story_id === story.story_id ? 'w-full' : 'w-0'}`}/>
                </span>
              ))}
            </div>
            <button type="button" onClick={() => setSelectedIndex(-1)} aria-label="Close story" className="absolute right-3 top-7 z-10 grid h-9 w-9 place-items-center rounded-full bg-brown/80 text-white"><X size={18}/></button>
            {selectedStory.cover_image_url && <img src={resolveMediaUrl(selectedStory.cover_image_url)} alt="" className="max-h-64 w-full object-cover"/>}
            <div className="p-6 sm:p-8">
              <p className="text-[9px] font-black uppercase tracking-[.2em] text-orange">{selectedStory.author_name}</p>
              <h2 id="story-dialog-title" className="mt-2 font-display text-2xl font-bold text-brown sm:text-3xl">{selectedStory.title}</h2>
              {selectedStory.audio_clip_url && <audio controls autoPlay preload="none" className="mt-5 h-10 w-full" src={resolveApiUrl(selectedStory.audio_clip_url)}>Your browser does not support audio playback.</audio>}
              {selectedStory.body && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-brown/75">{selectedStory.body}</p>}
              <div className="mt-6 grid gap-2 border-t border-brown/10 pt-4 sm:grid-cols-2">
                <Link
                  to={`/culture?story=${encodeURIComponent(selectedStory.title)}&open_chat=1#live-lounge`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange px-4 py-3 text-center text-xs font-bold text-brown transition hover:bg-gold"
                >
                  <MessageCircle size={15}/>Continue this story in chat
                </Link>
                <Link
                  to="/live"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brown/15 bg-white px-4 py-3 text-center text-xs font-bold text-brown transition hover:border-green"
                >
                  <MessageCircle size={15}/>Open public chat
                </Link>
              </div>
              {stories.length > 1 && (
                <div className="mt-6 flex justify-between border-t border-brown/10 pt-4">
                  <button type="button" onClick={() => setSelectedIndex((index) => (index - 1 + stories.length) % stories.length)} className="inline-flex items-center gap-2 text-xs font-bold text-green"><ArrowLeft size={15}/> Previous</button>
                  <button type="button" onClick={() => setSelectedIndex((index) => (index + 1) % stories.length)} className="inline-flex items-center gap-2 text-xs font-bold text-green">Next <ArrowRight size={15}/></button>
                </div>
              )}
            </div>
          </article>
        </div>
      )}
    </>
  );
}
