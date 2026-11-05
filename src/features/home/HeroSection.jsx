import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Ticket } from 'lucide-react';
import { shieldNodes } from './data';
import { formatEventDate } from './eventFormatting';
import KokwetLogo from '../../components/KokwetLogo';
import FestivalStories from './FestivalStories';
import { resolveMediaUrl } from '../../api';

export default function HeroSection({ festivalEvent, activeShieldNode, setActiveShieldNode, shieldImageSetIndex, visibleShieldImages, shieldNodes, heroContent, shieldContent, logoUrl, onGetTickets }) {
  const videoRef = useRef(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const mobile = window.matchMedia('(max-width: 767px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    let active = true;

    function updateVideo() {
      const slowConnection = connection?.saveData
        || connection?.effectiveType === 'slow-2g'
        || connection?.effectiveType === '2g';

      if (!reducedMotion.matches && !slowConnection) {
        if (video.hasAttribute('src')) return;
        const useWebm = !mobile.matches && video.canPlayType('video/webm');
        const preferredSource = useWebm ? video.dataset.webmSrc : video.dataset.mp4Src;
        const fallbackSource = useWebm ? video.dataset.mp4Src : video.dataset.webmSrc;
        if (!preferredSource) return;
        delete video.dataset.fallbackUsed;
        video.dataset.fallbackSrc = fallbackSource;
        video.src = preferredSource;
        video.load();
        void video.play()
          .then(() => {
            if (active) setIsVideoPlaying(true);
          })
          .catch(() => {
            if (active) setIsVideoPlaying(false);
          });
        return;
      }

      if (video.hasAttribute('src')) {
        video.pause();
        video.removeAttribute('src');
        video.load();
        setIsVideoPlaying(false);
      }
    }

    updateVideo();
    reducedMotion.addEventListener('change', updateVideo);
    connection?.addEventListener?.('change', updateVideo);

    return () => {
      active = false;
      delete video.dataset.fallbackUsed;
      delete video.dataset.fallbackSrc;
      reducedMotion.removeEventListener('change', updateVideo);
      connection?.removeEventListener?.('change', updateVideo);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [heroContent?.video_mp4_url, heroContent?.video_webm_url]);

  function handleVideoError() {
    setIsVideoPlaying(false);
    const video = videoRef.current;
    if (!video) return;
    const fallbackSource = video.dataset.fallbackSrc;
    if (!fallbackSource || video.dataset.fallbackUsed) return;

    video.dataset.fallbackUsed = 'true';
    video.src = fallbackSource;
    video.load();
    void video.play()
      .then(() => setIsVideoPlaying(true))
      .catch(() => setIsVideoPlaying(false));
  }

  return (
    <section className="hero-cinematic relative isolate min-h-[calc(100vh-5rem)] overflow-hidden text-white">
      <div className="hero-cinematic__image absolute inset-0 -z-30" aria-hidden="true">
        <img className="hero-cinematic__poster" src={resolveMediaUrl(heroContent?.poster_image_url || '/images/hero-poster.jpg')} alt="" loading="eager" decoding="async"/>
        <video
          ref={videoRef}
          className={`hero-cinematic__video${isVideoPlaying ? ' is-playing' : ''}`}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          poster={resolveMediaUrl(heroContent?.poster_image_url || '/images/hero-poster.jpg')}
          onPlaying={() => setIsVideoPlaying(true)}
          onError={handleVideoError}
          aria-hidden="true"
          data-webm-src={resolveMediaUrl(heroContent?.video_webm_url || '/videos/hero-bg.webm')}
          data-mp4-src={resolveMediaUrl(heroContent?.video_mp4_url || '/videos/hero-bg.mp4')}
        >
        </video>
      </div>
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(36,18,6,.92)_0%,rgba(36,18,6,.68)_48%,rgba(36,18,6,.18)_100%),linear-gradient(180deg,rgba(36,18,6,.05)_45%,rgba(36,18,6,.9)_100%)]"/>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1800px] flex-col px-[clamp(1rem,4vw,4rem)] pb-6 pt-2 sm:pb-14 sm:pt-5">
      <div className="relative z-20 -mx-[clamp(1rem,4vw,4rem)] mb-2 border-y border-white/10 bg-brown/35 backdrop-blur-sm sm:mb-3">
          <FestivalStories/>
        </div>
        <div className="grid flex-1 items-center gap-4 pt-2 sm:gap-6 sm:pt-5 lg:grid-cols-[.8fr_1.2fr] lg:pt-0">
        <div className="hero-copy max-w-3xl">
          <div className="hero-reveal hero-reveal-1 mb-4 flex flex-nowrap items-center gap-2 sm:mb-5 sm:gap-5">
            <KokwetLogo tone="light" src={resolveMediaUrl(logoUrl)} className="w-32 shrink-0 sm:w-56"/>
            <button type="button" onClick={onGetTickets} className="hero-ticket-cta group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[10px] font-black uppercase tracking-[.08em] text-brown transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold sm:h-14 sm:gap-2.5 sm:px-6 sm:text-sm sm:tracking-[.12em]">
              <Ticket size={15} className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110 sm:h-5 sm:w-5"/>
              <span>Get Tickets</span>
              <ArrowRight size={13} className="transition-transform duration-300 group-hover:translate-x-1 sm:h-[15px] sm:w-[15px]"/>
            </button>
          </div>
          <p className="hero-reveal hero-reveal-1 mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-gold sm:mb-7 sm:gap-3 sm:text-xs sm:tracking-[.34em]"><span className="h-px w-8 bg-gold sm:w-14"/>{festivalEvent?`${festivalEvent.title} · ${festivalEvent.venue} · ${formatEventDate(festivalEvent.date)}`:'Kokwet Festival'}</p>
          <h1 className="hero-reveal hero-reveal-2 font-display text-[clamp(2.35rem,11.5vw,3.8rem)] font-bold leading-[.9] tracking-[-.045em] text-white sm:text-8xl lg:text-[7.5rem]">{heroContent?.title_first || 'Culture'}<br/><span className="text-gold">{heroContent?.title_highlight || 'Meets'}</span> {heroContent?.title_last || 'the Future.'}</h1>
          <p className="hero-reveal hero-reveal-3 mt-5 max-w-xl text-base leading-7 text-white/78 sm:mt-8 sm:text-lg sm:leading-8 md:text-2xl">{heroContent?.subheadline || 'A new generation. Diverse cultures. One shared future.'}</p>
          <div className="hero-reveal hero-reveal-4 mt-6 flex flex-wrap gap-3 sm:mt-9"><a href="#noticeboard" className="action-trigger-token inline-flex items-center gap-2 px-5 py-3 sm:px-7 sm:py-4">{heroContent?.explore_cta_label || 'Explore the gathering'} <ArrowRight size={18}/></a></div>
        </div>
        <div className="shield-stage hero-reveal hero-reveal-4 mx-auto w-full" aria-label="Intergenerational community shield">
          <div className="shield-pattern" aria-hidden="true"/>
          <svg className="shield-mask-defs" aria-hidden="true"><clipPath id="kokwet-shield" clipPathUnits="objectBoundingBox"><path d="M.50 0 C.69 .02 .88 .12 1 .36 C1.02 .58 .91 .76 .50 1 C.09 .76 -.02 .58 0 .36 C.12 .12 .31 .02 .50 0 Z"/></clipPath></svg>
          <div className="shield-backdrop" aria-hidden="true"><img src={resolveMediaUrl(shieldContent?.backdrop_image_url || 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=82')} alt=""/></div>
          <div className="shield-frame">
            <img className="shield-artwork" src={resolveMediaUrl(shieldContent?.artwork_image_url || 'https://media.istockphoto.com/id/165549580/vector/masai-shield-spears.jpg?s=612x612&w=0&k=20&c=tT4uDtEcOws-7HTDRkAvNmbYIMY8VdbhdgGwAuqBxOA=')} alt="" aria-hidden="true"/>
            <div className="shield-half shield-half-children">
              {shieldNodes.filter(node=>node.id==='children').map(node=><button type="button" key={node.id} className={`shield-value shield-value-${node.id}${activeShieldNode?.id===node.id?' is-active':''}`} style={{'--value-accent':node.accent}} onMouseEnter={()=>setActiveShieldNode(node)} onFocus={()=>setActiveShieldNode(node)} onClick={()=>setActiveShieldNode(node)} aria-pressed={activeShieldNode?.id===node.id}><span>{node.word}</span><small>{node.group}</small></button>)}
            </div>
            <div className="shield-split" aria-hidden="true"/>
            <div className="shield-half shield-half-youth">
              {shieldNodes.filter(node=>node.id==='youth').map(node=><button type="button" key={node.id} className={`shield-value shield-value-youth${activeShieldNode?.id===node.id?' is-active':''}`} style={{'--value-accent':node.accent}} onMouseEnter={()=>setActiveShieldNode(node)} onFocus={()=>setActiveShieldNode(node)} onClick={()=>setActiveShieldNode(node)} aria-pressed={activeShieldNode?.id===node.id}><span>{node.word}</span><small>{node.group}</small></button>)}
            </div>
            </div>
          <article key={`children-${shieldImageSetIndex}`} className="shield-photo-popout shield-photo-popout-children" aria-label={`Magnified ${visibleShieldImages[0].label} image`}><span>{visibleShieldImages[0].label} <b>2.5×</b></span><img src={resolveMediaUrl(visibleShieldImages[0].image)} alt={visibleShieldImages[0].caption}/></article>
          <article key={`youth-${shieldImageSetIndex}`} className="shield-photo-popout shield-photo-popout-youth" aria-label={`Magnified ${visibleShieldImages[1].label} image`}><span>{visibleShieldImages[1].label} <b>2.5×</b></span><img src={resolveMediaUrl(visibleShieldImages[1].image)} alt={visibleShieldImages[1].caption}/></article>
          <div className="shield-ring" aria-hidden="true"/>
        </div>
        </div>
      </div>
      <p className="absolute bottom-8 right-5 hidden origin-bottom-right rotate-90 text-[9px] font-bold uppercase tracking-[.48em] text-white/55 lg:block">Heritage · Enterprise · Youth · Unity</p>
    </section>
  );
}
