import SectionTitle from '../../components/SectionTitle';
import { resolveMediaUrl } from '../../api';

export default function FeaturedArtists({ artists, sectionContent }) {
  return (
    <section id="artists" className="featured-artists-section scroll-mt-24">
      <div className="mx-auto max-w-7xl px-5 py-20">
        <SectionTitle eyebrow={sectionContent?.eyebrow || 'On the main stage'} title={sectionContent?.title || 'Featured Artists'} copy={sectionContent?.description || 'Meet the headline acts and cultural performers bringing energy, heritage and world-class entertainment to the main stage.'}/>
        <div className="featured-artists-grid">{artists.map((artist,index)=><article className="featured-artist-card" key={artist.id}><div className="featured-artist-photo"><img src={resolveMediaUrl(artist.image)} alt={`${artist.name} performing`}/><span>0{index+1}</span></div><div className="featured-artist-meta"><p>{artist.style}</p><h2>{artist.name}</h2></div></article>)}</div>
        <p className="featured-artists-note">The official lineup is updated by authorized Kokwet staff.</p>
      </div>
    </section>
  );
}
