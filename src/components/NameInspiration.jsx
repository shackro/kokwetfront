import { useState } from 'react';
import { ArrowRight, Share2, Sparkles } from 'lucide-react';

const defaultNameIdeas = [
  { id: 'dawn', context_label: 'At dawn', male_name: 'Kipkoech', female_name: 'Chepkoech', meaning: 'A name associated here with dawn and new beginnings.', source_attribution: '' },
  { id: 'rain', context_label: 'During the rains', male_name: 'Kipchirchir', female_name: 'Chepchirchir', meaning: 'A name associated here with the rains, renewal and abundance.', source_attribution: '' },
  { id: 'harvest', context_label: 'During harvest', male_name: 'Kiprono', female_name: 'Chepono', meaning: 'A name associated here with harvest, provision and community sustenance.', source_attribution: '' },
  { id: 'cattle_return', context_label: 'When cattle returned home', male_name: 'Kipkirui', female_name: 'Cherotich', meaning: 'A name associated here with cattle returning home, peace and a journey completed.', source_attribution: '' },
  { id: 'night', context_label: 'At night', male_name: 'Kipkosgei', female_name: 'Chepkosgei', meaning: 'A name associated here with night, reflection and quiet strength.', source_attribution: '' },
];

export default function NameInspiration({ content }) {
  const [gender, setGender] = useState('');
  const [condition, setCondition] = useState('');
  const [resultId, setResultId] = useState(null);
  const ideas = content?.name_ideas || defaultNameIdeas;
  const result = ideas.find((idea) => idea.id === resultId);

  function revealName(event) {
    event.preventDefault();
    if (!gender || !condition) return;
    setResultId(condition);
  }

  const shareText = result
    ? `I explored a traditional name idea: ${gender === 'male' ? result.male_name : result.female_name}. ${result.meaning} Explore the name guide: ${window.location.origin}/services`
    : '';
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <section className="name-inspiration" aria-labelledby="name-inspiration-title">
      <header className="name-inspiration-header">
        <span className="name-inspiration-icon"><Sparkles size={18}/></span>
        <p className="name-inspiration-eyebrow">{content?.name_inspiration_eyebrow || 'Cultural name inspiration'}</p>
        <h2 id="name-inspiration-title">{content?.name_inspiration_title || <>Explore a name <span>inspired by the moment.</span></>}</h2>
        <p>{content?.name_inspiration_description || 'Choose a naming pattern and a circumstance to see an example name and its associated meaning.'}</p>
      </header>

      <form className="name-inspiration-form" onSubmit={revealName}>
        <fieldset>
          <legend>1. Choose a name form</legend>
          <div className="name-inspiration-options">
            {[
              ['male', 'Male name form'],
              ['female', 'Female name form'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={gender === value}
                className={`name-inspiration-option${gender === value ? ' is-selected' : ''}`}
                onClick={() => {
                  setGender(value);
                  setResultId(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="name-inspiration-condition" htmlFor="name-condition">
          <span>2. Choose a circumstance</span>
          <select
            id="name-condition"
            value={condition}
            onChange={event => {
              setCondition(event.target.value);
              setResultId(null);
            }}
          >
            <option value="">Select a circumstance</option>
            {ideas.map((idea) => <option key={idea.id} value={idea.id}>{idea.context_label}</option>)}
          </select>
        </label>

        <button className="name-inspiration-submit" type="submit" disabled={!gender || !condition}>
          Explore this name <ArrowRight size={17}/>
        </button>
      </form>

      {result && (
        <div className="name-inspiration-result" aria-live="polite">
          <p>Your example name</p>
          <h3>{gender === 'male' ? result.male_name : result.female_name}</h3>
          <blockquote>{result.meaning}</blockquote>
          {result.source_attribution && <p className="mt-3 text-xs font-semibold">Source: {result.source_attribution}</p>}
          <a href={shareUrl} target="_blank" rel="noopener noreferrer">
            <Share2 size={16}/> Share on WhatsApp
          </a>
        </div>
      )}

      <p className="name-inspiration-note">{content?.name_inspiration_note || 'Name traditions and meanings vary across families and communities. These are illustrative examples, not an authoritative naming record; please check spellings and interpretations with fluent speakers and cultural elders.'}</p>
    </section>
  );
}
