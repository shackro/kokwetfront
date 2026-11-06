import { ArrowRight } from 'lucide-react';
import SectionTitle from '../../components/SectionTitle';
import { formatEventDateTime } from './eventFormatting';

export default function PassesSection({ mainEvent, countdownParts, passes, openTickets, sectionContent }) {
  return (
    <section id="passes" className="scroll-mt-24 px-5 py-20"><div className="mx-auto max-w-7xl"><SectionTitle eyebrow={sectionContent?.eyebrow || 'Secure in-house ticketing'} title={sectionContent?.title || 'Choose your festival pass'} copy={sectionContent?.description || 'Every confirmed pass includes reserved inventory, secure checkout and a unique digital entry token.'}/>
      {mainEvent&&<div className="event-countdown"><div className="event-countdown-copy"><span>Main Kokwet Festival countdown · @KokwetFestival</span><h2>{mainEvent.title}</h2><p>{mainEvent.venue} · {formatEventDateTime(mainEvent.date)}</p></div><div className="event-countdown-clock" aria-label={`${countdownParts.map(([value,label])=>`${value} ${label}`).join(', ')} until ${mainEvent.title}`}>{countdownParts.map(([value,label])=><div key={label}><strong>{String(value).padStart(2,'0')}</strong><span>{label}</span></div>)}</div><div className="event-countdown-action"><b>Don’t miss it!</b><a href="#pass-selection">Get tickets <ArrowRight size={16}/></a></div></div>}
      {!mainEvent&&<div className="event-countdown-empty">The Kokwet Festival countdown will appear here when the main event is added to the schedule.</div>}
      <div id="pass-selection" className="mt-10 grid scroll-mt-24 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {passes.map(pass=>{const vip=pass.id==='family';return <article key={pass.id} className={`flex min-h-72 flex-col rounded-lg border p-7 ${vip?'border-brown bg-brown text-white':'border-brown/15 bg-white'}`}><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.16em] text-orange">{vip?'Corporate VIP tier':'Festival access'}</p><span className={`rounded-full px-3 py-1 text-xs font-bold ${vip?'bg-green text-white':'bg-green/10 text-green'}`}>{pass.stock} available</span></div><h3 className="mt-8 font-display text-3xl">{pass.name}</h3><p className={`mt-2 flex-1 text-sm ${vip?'text-white/65':'text-brown/55'}`}>{pass.note}</p><p className={`mt-6 font-display text-4xl ${vip?'text-gold':'text-brown'}`}>KSh {pass.price.toLocaleString()}</p>{vip&&<ul className="mt-5 space-y-2 text-sm text-white/75"><li>• Fast-track validation gate</li><li>• Private lounge seating</li></ul>}<button type="button" onClick={()=>openTickets(pass.id)} disabled={pass.stock<=0} className="mt-6 w-full rounded-md bg-orange py-3 font-bold text-brown transition hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50">{pass.stock>0?'Select this pass':'Sold out'}</button></article>})}
      </div>
      <div className="mt-8 flex justify-center"><button type="button" onClick={()=>openTickets()} className="rounded-md border border-brown/20 px-6 py-3 font-bold text-brown transition hover:border-orange hover:text-orange">Build a multi-pass order</button></div>
    </div></section>
  );
}
