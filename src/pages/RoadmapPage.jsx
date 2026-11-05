import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  LoaderCircle,
  Mountain,
  Shield,
} from 'lucide-react';
import { getJson, postJson } from '../api';

const phaseIcons = [Flame, Shield, Mountain];
const phaseStatus = {
  planned: 'Planned',
  in_progress: 'In progress',
  completed: 'Completed',
};

export default function RoadmapPage() {
  const [roadmap, setRoadmap] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getJson('/roadmap')
      .then(data => {
        if (active) setRoadmap(data);
      })
      .catch(error => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load the roadmap.');
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setSubmitError('');
    try {
      await postJson('/feedback', { message });
      setDone(true);
      setMessage('');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to send your feedback.');
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <section className="roadmap-loading">
        <p role="alert">{loadError}</p>
      </section>
    );
  }
  if (!roadmap) {
    return (
      <section className="roadmap-loading">
        <p role="status"><LoaderCircle size={18} className="animate-spin"/> Loading the Kokwet roadmap…</p>
      </section>
    );
  }

  return (
    <div className="roadmap-page">
      <section className="roadmap-hero">
        <div className="roadmap-hero-inner">
          <span className="roadmap-eyebrow">{roadmap.eyebrow}</span>
          <h1>{roadmap.title}<br/><span>{roadmap.highlight}</span></h1>
          <p>{roadmap.introduction}</p>
          <a className="roadmap-scroll-link" href="#roadmap-phases">Explore the journey <ArrowRight size={16}/></a>
        </div>
        <div className="roadmap-hero-mark" aria-hidden="true">
          <div className="roadmap-hero-ring roadmap-hero-ring-one"/>
          <div className="roadmap-hero-ring roadmap-hero-ring-two"/>
          <Shield size={88} strokeWidth={1}/>
        </div>
      </section>

      <section className="roadmap-journey" id="roadmap-phases">
        <header className="roadmap-section-heading">
          <span className="roadmap-section-kicker">A shared direction</span>
          <h2>One step, <span>together.</span></h2>
          <p>{roadmap.status_note}</p>
        </header>

        <div className="roadmap-timeline">
          {roadmap.phases.map((phase, index) => {
            const Icon = phaseIcons[index % phaseIcons.length];
            return (
              <article className={`roadmap-phase roadmap-phase-${index % 2 ? 'right' : 'left'}`} key={phase.id}>
                <div className="roadmap-phase-marker" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className="roadmap-phase-card">
                  <div className="roadmap-phase-topline">
                    <span className="roadmap-phase-icon"><Icon size={20}/></span>
                    <span className={`roadmap-status roadmap-status-${phase.status}`}>{phaseStatus[phase.status]}</span>
                  </div>
                  <p className="roadmap-phase-subtitle">{phase.subtitle}</p>
                  <h3>{phase.title}</h3>
                  <p className="roadmap-phase-description">{phase.description}</p>
                  <ul>
                    {phase.milestones.map((milestone, milestoneIndex) => (
                      <li key={`${phase.id}-${milestoneIndex}`}><CheckCircle2 size={16}/><span>{milestone}</span></li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="roadmap-feedback">
        <div className="roadmap-feedback-copy">
          <span className="roadmap-eyebrow">Your voice matters</span>
          <h2>{roadmap.feedback_title}</h2>
          <p>{roadmap.feedback_description}</p>
        </div>
        <div className="roadmap-feedback-form">
          {done ? (
            <p role="status" className="roadmap-feedback-success"><CheckCircle2 size={20}/> Thank you. Your voice was recorded.</p>
          ) : (
            <form onSubmit={submit}>
              <label htmlFor="roadmap-feedback-message">{roadmap.feedback_prompt}</label>
              <textarea
                id="roadmap-feedback-message"
                required
                minLength={8}
                maxLength={500}
                value={message}
                onChange={event => setMessage(event.target.value)}
                placeholder="Share an idea or priority…"
              />
              {submitError && <p role="alert" className="roadmap-feedback-error">{submitError}</p>}
              <div className="roadmap-feedback-submit">
                <span>{message.length}/500 characters</span>
                <button disabled={busy}>{busy ? 'Sending…' : 'Send feedback'} <ArrowRight size={16}/></button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
