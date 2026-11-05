import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ExternalLink } from 'lucide-react';
import SectionTitle from '../../components/SectionTitle';
import { formatEventDateTime } from './eventFormatting';

export default function EventBoard({ activities, sectionContent }) {
  return (
    <section id="noticeboard" className="scroll-mt-24 px-5 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionTitle eyebrow={sectionContent?.eyebrow || 'The live noticeboard'} title={sectionContent?.title || 'Gather with purpose'} copy={sectionContent?.description}/>
          <Link to="/roadmap" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-orange">View roadmap <ArrowRight size={16}/></Link>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
          {activities.map((item,i)=>(
            <article key={item.id} className="border-t-4 border-green bg-white p-6 shadow-[0_12px_50px_rgba(36,18,6,.07)]">
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-orange">0{i+1} · {item.category}</span>
                <CalendarDays className="text-green" size={20}/>
              </div>
              <h3 className="mt-5 font-display text-2xl uppercase">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-brown/60">{item.focus}</p>
              <div className="mt-6 border-t pt-4 text-xs font-semibold text-brown/70">
                {item.venue}<br/>{formatEventDateTime(item.date)}
              </div>
              {item.external_url&&<a href={item.external_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange hover:text-green">Visit event site <ExternalLink size={14}/></a>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
