import SectionTitle from '../../components/SectionTitle';
import { resolveMediaUrl } from '../../api';
export default function EnterpriseShowcase({ content, enterprises = [] }) {
  return (
    <section id="showcases" className="scroll-mt-24 bg-[#efe8dc] px-5 py-20"><div className="mx-auto max-w-7xl"><SectionTitle eyebrow={content?.eyebrow || 'Featured enterprise'} title={content?.title || 'The exhibition showcase'} copy={content?.description || "Discover youth-led ventures, regional makers and agricultural teams shaping Kokwet's next economy."}/><div className="mt-10 grid gap-5 md:grid-cols-3">{enterprises.map((enterprise)=><article key={enterprise.id} className="overflow-hidden rounded-lg bg-white shadow-sm"><img src={resolveMediaUrl(enterprise.image)} alt={enterprise.title} className="h-56 w-full object-cover"/><div className="p-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-orange">Community enterprise</p><h3 className="mt-3 font-display text-2xl">{enterprise.title}</h3><p className="mt-3 text-sm leading-7 text-brown/60">{enterprise.description}</p></div></article>)}</div></div></section>
  );
}
