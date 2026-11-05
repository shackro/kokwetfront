import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  CircleCheck,
  GraduationCap,
  Handshake,
  Landmark,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getJson } from '../api';
import SectionTitle from '../components/SectionTitle';

const destinations = {
  open_hearth: '/culture',
  community_services: '/services',
  festival_marketplace: '/marketplace',
};

const pathwayIcons = [GraduationCap, BriefcaseBusiness, Landmark, Handshake];

const goalStatus = {
  planned: 'Planned',
  in_progress: 'In progress',
  completed: 'Completed',
};

export default function ImpactPage() {
  const [impact, setImpact] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getJson('/impact')
      .then(data => {
        if (active) setImpact(data);
      })
      .catch(requestError => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load impact information.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return <section className="px-5 py-20"><p role="alert" className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</p></section>;
  }
  if (!impact) {
    return <section className="grid min-h-[50vh] place-items-center px-5"><p role="status" className="inline-flex items-center gap-2 text-sm text-brown/60"><LoaderCircle size={17} className="animate-spin"/>Loading impact information…</p></section>;
  }

  const { hero, pathways, transparency, goals, goals_heading: goalsHeading } = impact;
  const reportIsPublic = transparency.report_mode !== 'unpublished';
  const reportIsVerified = transparency.report_mode === 'verified';

  return (
    <div className="impact-page">
      <section className="impact-hero">
        <div className="impact-hero-inner">
          <span className="impact-eyebrow">{hero.eyebrow}</span>
          <h1>{hero.title}<br/><span>{hero.highlight}</span></h1>
          <p>{hero.body}</p>
        </div>
      </section>

      <section className="impact-pathways-section">
        <div className="impact-section-heading">
          <SectionTitle
            eyebrow="A shared effort"
            title={<>Plug into the <span className="text-green">ecosystem</span></>}
            copy="Choose a practical way to contribute. These are invitations to take part—not claims about results already achieved."
          />
        </div>
        <div className="impact-pathway-grid">
          {pathways.map((pathway, index) => {
            const Icon = pathwayIcons[index % pathwayIcons.length];
            const destination = destinations[pathway.destination];
            return (
              <article className="impact-pathway-card" key={pathway.id}>
                <span className="impact-pathway-icon"><Icon size={22}/></span>
                <h2>{pathway.title}</h2>
                <p>{pathway.description}</p>
                <ul>
                  {pathway.actions.map(action => <li key={action}>{action}</li>)}
                </ul>
                {destination ? (
                  <Link to={destination} className="impact-pathway-link">{pathway.cta_label}<ArrowRight size={15}/></Link>
                ) : <span className="impact-pathway-link is-informational">{pathway.cta_label}</span>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="impact-transparency-section">
        <div className="impact-transparency-copy">
          <span className="impact-eyebrow impact-eyebrow-green"><ShieldCheck size={15}/> Accountability</span>
          <h2>{transparency.title}</h2>
          <p>{transparency.body}</p>
          {!reportIsPublic ? (
            <div className="impact-report-state">
              <span className="impact-report-indicator"/>
              <div><strong>No verified figures published</strong><p>We will show a breakdown here when a dated report and its source are ready.</p></div>
            </div>
          ) : (
            <div className={`impact-report-details ${reportIsVerified ? 'is-verified' : 'is-proposed'}`}>
              <span>{reportIsVerified ? 'Verified report' : 'Proposal · not actual expenditure'}</span>
              {transparency.report_period && <strong>{transparency.report_period}</strong>}
              {transparency.report_source && <p>Source: {transparency.report_source}</p>}
              {transparency.report_url && <a href={transparency.report_url} target="_blank" rel="noopener noreferrer">Open supporting report <ArrowRight size={14}/></a>}
            </div>
          )}
        </div>
        <div className="impact-resource-card">
          <div className="impact-resource-card-heading">
            <span>Resource reporting</span>
            <ShieldCheck size={19}/>
          </div>
          {reportIsPublic && transparency.allocations.length ? (
            <div className="impact-allocations">
              {transparency.allocations.map(item => (
                <div className="impact-allocation" key={item.id}>
                  <div className="impact-allocation-label"><span>{item.label}</span><strong>{item.percentage}%</strong></div>
                  <div className="impact-allocation-track" aria-label={`${item.label}: ${item.percentage}%`}>
                    <span style={{ width: `${item.percentage}%` }}/>
                  </div>
                </div>
              ))}
              <p className="impact-resource-footnote">
                {reportIsVerified ? 'Breakdown from the cited report.' : 'Illustrative proposal only; it does not represent money received or spent.'}
              </p>
            </div>
          ) : (
            <div className="impact-resource-empty">
              <span className="impact-resource-emblem"><ShieldCheck size={29}/></span>
              <h3>Trust is built with evidence.</h3>
              <p>There are no allocation percentages to display until a proposal or sourced report is published.</p>
            </div>
          )}
        </div>
      </section>

      <section className="impact-goals-section">
        <div className="impact-goals-heading">
          <span className="impact-eyebrow impact-eyebrow-green"><CircleCheck size={15}/> Looking ahead</span>
          <h2>{goalsHeading}</h2>
          <p>These priorities are updated by the Kokwet team. A status describes the plan, not a measured outcome.</p>
        </div>
        <div className="impact-goals-list">
          {goals.map(goal => (
            <article className="impact-goal-card" key={goal.id}>
              <span className={`impact-goal-status is-${goal.status.replace('_', '-')}`}>{goalStatus[goal.status]}</span>
              <h3>{goal.title}</h3>
              <p>{goal.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
