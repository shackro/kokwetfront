import Onboarding from './Onboarding';

export default function JoinCta({ content }) {
  return (
    <section className="join-cta">
      <div className="join-cta-copy">
        <p>{content?.eyebrow || 'Join the ecosystem'}</p>
        <h2>{content?.title_first || 'Your place is'} <span>{content?.title_highlight || 'waiting.'}</span></h2>
        <p className="join-cta-description">{content?.description || 'Find your community, share what you need, and take your next step with Kokwet.'}</p>
        <span className="join-cta-note">{content?.note || 'Four paths. One community.'}</span>
      </div>
      <div className="join-cta-form">
        <div className="join-cta-form-inner"><Onboarding content={content}/></div>
      </div>
    </section>
  );
}
