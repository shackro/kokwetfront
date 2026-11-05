export default function SectionTitle({ eyebrow, title, copy }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-orange">{eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl md:text-6xl">{title}</h1>
      {copy && <p className="mt-4 text-base leading-7 text-brown/60 sm:mt-5 sm:text-lg sm:leading-8">{copy}</p>}
    </div>
  );
}
