import { Link } from 'react-router-dom';
import { ArrowRight, HeartHandshake, Landmark, Users } from 'lucide-react';
import { resolveMediaUrl } from '../../api';

export default function CommunitySpotlight({ content }) {
  const missionPoints = content?.mission_points || [
    { id: 'culture-preserved', title: 'Culture preserved', description: 'Stories and knowledge carried forward.', icon: 'landmark' },
    { id: 'generations-connected', title: 'Generations connected', description: 'Respect, guidance, and shared growth.', icon: 'handshake' },
  ];
  const roleCards = content?.role_cards || [
    { id: 'cultural-stewards', eyebrow: 'Wisdom & heritage', title: 'Cultural stewards', description: 'Intergenerational voices helping keep community history, language, and values alive.', image: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=900&q=82', icon: 'landmark' },
    { id: 'youth-voices', eyebrow: 'Ideas & action', title: 'Youth and campus voices', description: 'Young people building networks, sharing skills, and shaping what comes next.', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=82', icon: 'users' },
  ];
  const pathwayCards = content?.pathways || [
    { id: 'campus-comrades', label: 'Campus comrades', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=700&q=80', destination: '/services' },
    { id: 'creative-leaders', label: 'Creative leaders', image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=700&q=80', destination: '/marketplace' },
    { id: 'young-professionals', label: 'Young professionals', image: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=700&q=80', destination: '/impact' },
  ];
  const missionIcons = { landmark: Landmark, handshake: HeartHandshake };
  const roleIcons = { landmark: Landmark, users: Users };

  return (
    <section className="community-spotlight">
      <div className="community-vision">
        <div className="community-vision-copy">
          <span className="community-eyebrow"><span/>{content?.eyebrow || 'Our core mission'}</span>
          <h2>{content?.title_first || 'Building the future,'}<br/><span>{content?.title_highlight || 'rooted in culture.'}</span></h2>
          <p>{content?.body || 'We connect generations through shared heritage, mentorship, and opportunity—bringing community knowledge into the spaces where young people learn, create, and build.'}</p>
          <div className="community-mission-points">
            {missionPoints.map((point) => {
              const Icon = missionIcons[point.icon] || Landmark;
              return <div key={point.id}><Icon size={19}/><span><b>{point.title}</b><small>{point.description}</small></span></div>;
            })}
          </div>
          <Link to="/impact" className="community-impact-link">{content?.impact_link_label || 'Explore our community impact'} <ArrowRight size={17}/></Link>
        </div>
        <div className="community-vision-visual" aria-label="Community gathering">
          <img className="community-vision-main" src={resolveMediaUrl(content?.main_image_url || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=82')} alt="Young community members gathered together"/>
          <img className="community-vision-inset" src={resolveMediaUrl(content?.inset_image_url || 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=700&q=82')} alt="Families sharing a moment together"/>
          <div className="community-vision-badge"><span>{content?.visual_badge_first || 'Culture meets'}</span><b>{content?.visual_badge_last || 'the future.'}</b></div>
          <span className="community-visual-caption">{content?.visual_caption || 'One community · many generations'}</span>
        </div>
      </div>
      <div className="community-pillars">
        <div className="community-pillars-inner">
          <header className="community-pillars-heading">
            <div><span className="community-eyebrow community-eyebrow-light">{content?.pillars_eyebrow || 'People make the community'}</span><h2>{content?.pillars_title_first || 'Community'} <span>{content?.pillars_title_highlight || 'pillars'}</span></h2></div>
            <p>{content?.pillars_copy || 'Recognizing the roles that preserve our roots and help the next generation thrive.'}</p>
          </header>
          <div className="community-leadership-grid">
            {roleCards.map((card) => {
              const Icon = roleIcons[card.icon] || Users;
              return <article className="community-leadership-card" key={card.id}>
                <img src={resolveMediaUrl(card.image)} alt={card.title}/>
                <div><span>{card.eyebrow}</span><h3>{card.title}</h3><p>{card.description}</p></div>
                <Icon size={22} aria-hidden="true"/>
              </article>;
            })}
          </div>
          <div className="community-members">
            <div className="community-members-heading"><div><span className="community-eyebrow community-eyebrow-light">{content?.members_eyebrow || 'Find your place'}</span><h3>{content?.members_heading || 'Active community pathways'}</h3></div><Link to="/services">{content?.pathways_link_label || 'Explore pathways'} <ArrowRight size={16}/></Link></div>
            <div className="community-pathway-grid">
              {pathwayCards.map((card) => <Link to={card.destination} key={card.id} className="community-pathway-card"><img src={resolveMediaUrl(card.image)} alt={card.label}/><span>{card.label}</span><ArrowRight size={17}/></Link>)}
            </div>
            <p className="community-members-note">{content?.members_note || 'Member spotlights are shared with permission and will grow with the community.'}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
