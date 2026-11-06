import { useEffect, useState } from 'react';
import { Save, Shield } from 'lucide-react';
import { staffRequest } from '../api';
import StaffMediaInput from '../components/StaffMediaInput';

function Field({ label, value, onChange, type = 'text', multiline = false, ...props }) {
  const controlClass = 'mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal outline-none focus:border-green';
  return (
    <label className="block text-xs font-bold">
      {label}
      {multiline
        ? <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} className={`${controlClass} leading-6`} rows={3} {...props}/>
        : <input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} className={controlClass} {...props}/>}
    </label>
  );
}

function setAtPath(source, path, value) {
  const next = structuredClone(source);
  let target = next;
  for (const key of path.slice(0, -1)) target = target[key];
  target[path[path.length - 1]] = value;
  return next;
}

export default function SiteContentEditor({ token }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [mediaUploadCount, setMediaUploadCount] = useState(0);

  useEffect(() => {
    let active = true;
    staffRequest('/v1/staff/site-content', token)
      .then((data) => {
        if (active) setContent(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load site content.');
      });
    return () => {
      active = false;
    };
  }, [token]);

  function update(path, value) {
    setContent((current) => setAtPath(current, path, value));
    setNotice('');
  }

  function onMediaUploadStateChange(isUploading) {
    setMediaUploadCount((current) => Math.max(0, current + (isUploading ? 1 : -1)));
  }

  function addArtist() {
    if (content.artists.length >= 12) return;
    setContent((current) => ({
      ...current,
      artists: [...current.artists, { id: `artist-${Date.now()}`, name: '', style: '', image: '' }],
    }));
    setNotice('');
  }

  function addEnterprise() {
    if (content.home.enterprises.length >= 6) return;
    setContent((current) => ({
      ...current,
      home: {
        ...current.home,
        enterprises: [...current.home.enterprises, { id: `enterprise-${Date.now()}`, title: '', description: '', image: '' }],
      },
    }));
    setNotice('');
  }

  async function save(event) {
    event.preventDefault();
    if (!content) return;
    if (mediaUploadCount > 0) {
      setError('Wait for media uploads to finish before saving site content.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await staffRequest('/v1/staff/site-content', token, { method: 'PUT', body: content });
      setContent(saved);
      setNotice('Site settings saved. Public pages will use these values on their next load.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save site settings.');
    } finally {
      setBusy(false);
    }
  }

  if (!content) {
    return <p role={error ? 'alert' : 'status'} className={error ? 'text-sm text-red-700' : 'text-sm text-brown/60'}>{error || 'Loading site content…'}</p>;
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <section className="rounded-2xl border border-green/15 bg-green/5 p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold text-brown">Edit pages without code</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brown/65">
          Choose a section below to update the words, links, photos or videos shown to visitors.
          Image and video fields include a preview and can use an upload or an HTTPS link.
          Save your changes when you are finished. Impact and Roadmap have their own tabs in the Control Room.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Page content sections">
          {[
            ['page-global', 'Header & footer'],
            ['page-home-hero', 'Homepage hero & shield'],
            ['page-community', 'Community spotlight'],
            ['page-artists', 'Featured artists'],
            ['page-enterprises', 'Homepage cards'],
            ['page-join', 'Join section'],
            ['page-services', 'Services & marketplace'],
            ['page-houses', 'House profiles'],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-full border border-brown/10 bg-white px-3 py-2 text-[10px] font-bold text-brown hover:border-green/40 hover:text-green">
              {label}
            </a>
          ))}
        </nav>
      </section>

      <section id="page-global" className="scroll-mt-24 rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex items-center gap-3 border-b border-brown/10 pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-green/10 text-green"><Shield size={19}/></span>
          <div>
            <h2 className="font-display text-xl font-bold text-brown sm:text-2xl">Global contact and footer</h2>
            <p className="mt-1 text-xs text-brown/55">Edit shared page components, text, navigation, logos and media from this panel. Use the WhatsApp number in international digits, without a plus sign.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp number" value={content.settings.whatsapp_number} onChange={(value) => update(['settings', 'whatsapp_number'], value)} inputMode="numeric" pattern="\d{10,15}" required/>
          <Field label="WhatsApp prefilled message" value={content.settings.whatsapp_message} onChange={(value) => update(['settings', 'whatsapp_message'], value)} maxLength={300} required/>
          <StaffMediaInput token={token} label="Header and hero wordmark" value={content.settings.logo_wordmark_light_url} onChange={(value) => update(['settings', 'logo_wordmark_light_url'], value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy} required/>
          <StaffMediaInput token={token} label="Footer full logo" value={content.settings.logo_full_light_url} onChange={(value) => update(['settings', 'logo_full_light_url'], value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy} required/>
          <Field label="Marketplace button label" value={content.settings.marketplace_button_label} onChange={(value) => update(['settings', 'marketplace_button_label'], value)} maxLength={40} required/>
          <Field label="Marketplace menu label" value={content.settings.marketplace_navigation_label} onChange={(value) => update(['settings', 'marketplace_navigation_label'], value)} maxLength={40} required/>
          <Field label="Footer tagline" value={content.settings.footer_tagline} onChange={(value) => update(['settings', 'footer_tagline'], value)} maxLength={240} required multiline/>
          <Field label="Footer copyright" value={content.settings.footer_copyright} onChange={(value) => update(['settings', 'footer_copyright'], value)} maxLength={160} required/>
        </div>
        <h3 className="mt-6 font-display text-lg font-bold">Navigation</h3>
        <p className="mt-1 text-xs text-brown/55">Change visible link labels and routes. Routes must start with “/”.</p>
        <div className="mt-3 space-y-3">
          {content.settings.navigation.map((link, index) => (
            <div key={`${link.path}-${index}`} className="grid items-end gap-3 rounded-xl border border-brown/10 p-3 sm:grid-cols-[1fr_1.2fr_auto]">
              <Field label={`Link ${index + 1} label`} value={link.label} onChange={(value) => update(['settings', 'navigation', index, 'label'], value)} maxLength={40} required/>
              <Field label="Local path" value={link.path} onChange={(value) => update(['settings', 'navigation', index, 'path'], value)} maxLength={120} required/>
              <label className="flex items-center gap-2 pb-3 text-xs font-semibold"><input type="checkbox" checked={link.is_active} onChange={(event) => update(['settings', 'navigation', index, 'is_active'], event.target.checked)} className="h-4 w-4 accent-green"/> Visible</label>
            </div>
          ))}
        </div>
      </section>

      <section id="page-home-hero" className="scroll-mt-24 rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 border-b border-brown/10 pb-4">
          <h2 className="font-display text-xl font-bold text-brown sm:text-2xl">Homepage hero and shield</h2>
          <p className="mt-1 text-xs text-brown/55">For every editable image or video, paste an HTTPS URL or upload a file. Shield layout stays fixed; only its content and images change.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: 'MP4 background video', path: ['home', 'hero', 'video_mp4_url'], mediaKind: 'video', expectedContentType: 'video/mp4' },
            { label: 'WebM background video', path: ['home', 'hero', 'video_webm_url'], mediaKind: 'video', expectedContentType: 'video/webm' },
            { label: 'Hero fallback / poster image', path: ['home', 'hero', 'poster_image_url'], mediaKind: 'image' },
            { label: 'Hero first line', path: ['home', 'hero', 'title_first'] },
            { label: 'Hero highlighted word', path: ['home', 'hero', 'title_highlight'] },
            { label: 'Hero final line', path: ['home', 'hero', 'title_last'] },
            { label: 'Hero explore button', path: ['home', 'hero', 'explore_cta_label'] },
            { label: 'Hero passes button', path: ['home', 'hero', 'passes_cta_label'] },
          ].map(({ label, path, mediaKind, expectedContentType }) => (
            mediaKind
              ? <StaffMediaInput key={label} token={token} label={label} mediaKind={mediaKind} expectedContentType={expectedContentType} value={path.reduce((value, key) => value[key], content)} onChange={(value) => update(path, value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy} required/>
              : <Field key={label} label={label} value={path.reduce((value, key) => value[key], content)} onChange={(value) => update(path, value)} maxLength={1000} required/>
          ))}
          <Field label="Hero supporting text" value={content.home.hero.subheadline} onChange={(value) => update(['home', 'hero', 'subheadline'], value)} maxLength={300} required multiline/>
          <StaffMediaInput token={token} label="Photo behind shield" value={content.home.shield.backdrop_image_url} onChange={(value) => update(['home', 'shield', 'backdrop_image_url'], value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy} required/>
          <StaffMediaInput token={token} label="Shield artwork image" value={content.home.shield.artwork_image_url} onChange={(value) => update(['home', 'shield', 'artwork_image_url'], value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy} required/>
          <Field label="Shield image rotation interval (seconds)" type="number" value={content.home.shield.rotation_interval_seconds} onChange={(value) => update(['home', 'shield', 'rotation_interval_seconds'], Number(value))} min={10} max={300} required/>
        </div>
        <h3 className="mt-6 font-display text-lg font-bold">Shield values</h3>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {content.home.shield.nodes.map((node, index) => (
            <fieldset key={node.id} className="space-y-3 rounded-xl border border-brown/10 p-4">
              <legend className="px-2 text-xs font-bold">{node.group || `Shield side ${index + 1}`}</legend>
              {[
                ['Word', 'word', 50],
                ['Meaning', 'meaning', 100],
                ['Label', 'group', 80],
                ['Supporting description', 'caption', 250],
                ['Image', 'image', 1000],
                ['Accent color', 'accent', 7],
              ].map(([label, key, maxLength]) => (
                key === 'image'
                  ? <StaffMediaInput key={key} token={token} label={label} value={node[key]} onChange={(value) => update(['home', 'shield', 'nodes', index, key], value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy} required/>
                  : <Field key={key} label={label} value={node[key]} onChange={(value) => update(['home', 'shield', 'nodes', index, key], value)} maxLength={maxLength} required/>
              ))}
            </fieldset>
          ))}
        </div>
        <h3 className="mt-6 font-display text-lg font-bold">Four rotating shield images</h3>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {content.home.shield.image_sets.flatMap((imageSet, setIndex) => imageSet.images.map((image, imageIndex) => {
            const path = ['home', 'shield', 'image_sets', setIndex, 'images', imageIndex];
            return (
              <fieldset key={image.id} className="space-y-3 rounded-xl border border-brown/10 p-4">
                <legend className="px-2 text-xs font-bold">Image {setIndex * 2 + imageIndex + 1}</legend>
                <Field label="Display label" value={image.label} onChange={(value) => update([...path, 'label'], value)} maxLength={80} required/>
                <StaffMediaInput token={token} label="Image" value={image.image} onChange={(value) => update([...path, 'image'], value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy} required/>
                <Field label="Accessible image description" value={image.caption} onChange={(value) => update([...path, 'caption'], value)} maxLength={250} required/>
              </fieldset>
            );
          }))}
        </div>
      </section>

      <section id="page-community" className="scroll-mt-24 rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 border-b border-brown/10 pb-4">
          <h2 className="font-display text-xl font-bold text-brown sm:text-2xl">Homepage community spotlight</h2>
          <p className="mt-1 text-xs text-brown/55">Update the spotlight, mission points, community roles and pathways shown on the homepage.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Eyebrow" value={content.home.community.eyebrow} onChange={(value) => update(['home', 'community', 'eyebrow'], value)} maxLength={80} required/>
          <Field label="First heading line" value={content.home.community.title_first} onChange={(value) => update(['home', 'community', 'title_first'], value)} maxLength={100} required/>
          <Field label="Highlighted heading" value={content.home.community.title_highlight} onChange={(value) => update(['home', 'community', 'title_highlight'], value)} maxLength={100} required/>
          <StaffMediaInput token={token} label="Main community photo" value={content.home.community.main_image_url} onChange={(value) => update(['home', 'community', 'main_image_url'], value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy} required/>
          <StaffMediaInput token={token} label="Inset community photo" value={content.home.community.inset_image_url} onChange={(value) => update(['home', 'community', 'inset_image_url'], value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy} required/>
          <Field label="Supporting copy" value={content.home.community.body} onChange={(value) => update(['home', 'community', 'body'], value)} maxLength={800} required multiline/>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Photo badge (first line)" value={content.home.community.visual_badge_first} onChange={(value) => update(['home', 'community', 'visual_badge_first'], value)} maxLength={60} required/>
          <Field label="Photo badge (second line)" value={content.home.community.visual_badge_last} onChange={(value) => update(['home', 'community', 'visual_badge_last'], value)} maxLength={60} required/>
          <Field label="Photo caption" value={content.home.community.visual_caption} onChange={(value) => update(['home', 'community', 'visual_caption'], value)} maxLength={120} required/>
          <Field label="Impact link label" value={content.home.community.impact_link_label} onChange={(value) => update(['home', 'community', 'impact_link_label'], value)} maxLength={100} required/>
        </div>
        <div className="mt-7">
          <h3 className="mb-3 text-sm font-bold text-brown">Mission points</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {content.home.community.mission_points.map((point, index) => (
              <fieldset key={point.id} className="space-y-3 rounded-xl border border-brown/10 p-4">
                <legend className="px-2 text-xs font-bold">Mission point {index + 1}</legend>
                <Field label="Title" value={point.title} onChange={(value) => update(['home', 'community', 'mission_points', index, 'title'], value)} maxLength={80} required/>
                <Field label="Description" value={point.description} onChange={(value) => update(['home', 'community', 'mission_points', index, 'description'], value)} maxLength={200} required multiline/>
                <label className="block text-xs font-bold">
                  Icon
                  <select value={point.icon} onChange={(event) => update(['home', 'community', 'mission_points', index, 'icon'], event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal outline-none focus:border-green">
                    <option value="landmark">Landmark</option>
                    <option value="handshake">Handshake</option>
                  </select>
                </label>
              </fieldset>
            ))}
          </div>
        </div>
        <div className="mt-7">
          <h3 className="mb-3 text-sm font-bold text-brown">Community pillars</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Section eyebrow" value={content.home.community.pillars_eyebrow} onChange={(value) => update(['home', 'community', 'pillars_eyebrow'], value)} maxLength={100} required/>
            <Field label="Heading first line" value={content.home.community.pillars_title_first} onChange={(value) => update(['home', 'community', 'pillars_title_first'], value)} maxLength={100} required/>
            <Field label="Highlighted heading" value={content.home.community.pillars_title_highlight} onChange={(value) => update(['home', 'community', 'pillars_title_highlight'], value)} maxLength={100} required/>
            <Field label="Supporting copy" value={content.home.community.pillars_copy} onChange={(value) => update(['home', 'community', 'pillars_copy'], value)} maxLength={300} required multiline/>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {content.home.community.role_cards.map((card, index) => (
              <fieldset key={card.id} className="space-y-3 rounded-xl border border-brown/10 p-4">
                <legend className="px-2 text-xs font-bold">Community role {index + 1}</legend>
                <Field label="Eyebrow" value={card.eyebrow} onChange={(value) => update(['home', 'community', 'role_cards', index, 'eyebrow'], value)} maxLength={100} required/>
                <Field label="Title" value={card.title} onChange={(value) => update(['home', 'community', 'role_cards', index, 'title'], value)} maxLength={100} required/>
                <Field label="Description" value={card.description} onChange={(value) => update(['home', 'community', 'role_cards', index, 'description'], value)} maxLength={350} required multiline/>
                <StaffMediaInput token={token} label="Role image" value={card.image} onChange={(value) => update(['home', 'community', 'role_cards', index, 'image'], value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy} required/>
                <label className="block text-xs font-bold">
                  Icon
                  <select value={card.icon} onChange={(event) => update(['home', 'community', 'role_cards', index, 'icon'], event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal outline-none focus:border-green">
                    <option value="landmark">Landmark</option>
                    <option value="users">People</option>
                  </select>
                </label>
              </fieldset>
            ))}
          </div>
        </div>
        <div className="mt-7">
          <h3 className="mb-3 text-sm font-bold text-brown">Community pathways</h3>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <Field label="Section eyebrow" value={content.home.community.members_eyebrow} onChange={(value) => update(['home', 'community', 'members_eyebrow'], value)} maxLength={80} required/>
            <Field label="Section heading" value={content.home.community.members_heading} onChange={(value) => update(['home', 'community', 'members_heading'], value)} maxLength={120} required/>
            <Field label="Pathways link label" value={content.home.community.pathways_link_label} onChange={(value) => update(['home', 'community', 'pathways_link_label'], value)} maxLength={80} required/>
            <Field label="Section note" value={content.home.community.members_note} onChange={(value) => update(['home', 'community', 'members_note'], value)} maxLength={240} required multiline/>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {content.home.community.pathways.map((pathway, index) => (
              <fieldset key={pathway.id} className="space-y-3 rounded-xl border border-brown/10 p-4">
                <legend className="px-2 text-xs font-bold">Pathway {index + 1}</legend>
                <Field label="Label" value={pathway.label} onChange={(value) => update(['home', 'community', 'pathways', index, 'label'], value)} maxLength={100} required/>
                <StaffMediaInput token={token} label="Pathway image" value={pathway.image} onChange={(value) => update(['home', 'community', 'pathways', index, 'image'], value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy} required/>
                <label className="block text-xs font-bold">
                  Destination
                  <select value={pathway.destination} onChange={(event) => update(['home', 'community', 'pathways', index, 'destination'], event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal outline-none focus:border-green">
                    <option value="/services">Services</option>
                    <option value="/marketplace">Marketplace</option>
                    <option value="/impact">Impact</option>
                  </select>
                </label>
              </fieldset>
            ))}
          </div>
        </div>
      </section>

      <section id="page-artists" className="scroll-mt-24 rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 border-b border-brown/10 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-brown sm:text-2xl">Featured artists</h2>
              <p className="mt-1 text-xs text-brown/55">Manage the homepage lineup. Changes are saved for all visitors in the backend.</p>
            </div>
            <button type="button" disabled={content.artists.length >= 12} onClick={addArtist} className="rounded-lg border border-green/25 px-3 py-2 text-xs font-bold text-green disabled:opacity-40">Add artist</button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {content.artists.map((artist, index) => (
            <fieldset key={artist.id} className="space-y-3 rounded-xl border border-brown/10 p-4">
              <legend className="px-2 text-xs font-bold">Lineup slot {index + 1}</legend>
              <Field label="Artist name" value={artist.name} onChange={(value) => update(['artists', index, 'name'], value)} maxLength={70} required/>
              <Field label="Performance style" value={artist.style} onChange={(value) => update(['artists', index, 'style'], value)} maxLength={70} required/>
              <StaffMediaInput token={token} label="Artist photo" value={artist.image} onChange={(value) => update(['artists', index, 'image'], value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy} required/>
              <button type="button" onClick={() => setContent((current) => ({ ...current, artists: current.artists.filter((item) => item.id !== artist.id) }))} className="text-xs font-bold text-red-700">Remove lineup slot</button>
            </fieldset>
          ))}
          {!content.artists.length && <p className="text-sm text-brown/55">No featured artists are published.</p>}
        </div>
      </section>

      <section id="page-enterprises" className="scroll-mt-24 rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 border-b border-brown/10 pb-4">
          <h2 className="font-display text-xl font-bold text-brown sm:text-2xl">Homepage sections and enterprise showcase</h2>
          <p className="mt-1 text-xs text-brown/55">Update section headings, descriptions and published enterprise cards.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['Events section', 'events_section'],
            ['Artists section', 'artists_section'],
            ['Enterprise section', 'enterprise_section'],
            ['Passes section', 'pass_section'],
          ].map(([label, key]) => (
            <fieldset key={key} className="space-y-3 rounded-xl border border-brown/10 p-4">
              <legend className="px-2 text-xs font-bold">{label}</legend>
              <Field label="Eyebrow" value={content.home[key].eyebrow} onChange={(value) => update(['home', key, 'eyebrow'], value)} maxLength={80} required/>
              <Field label="Title" value={content.home[key].title} onChange={(value) => update(['home', key, 'title'], value)} maxLength={120} required/>
              <Field label="Description" value={content.home[key].description} onChange={(value) => update(['home', key, 'description'], value)} maxLength={400} required multiline/>
            </fieldset>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold">Enterprise cards</h3>
            <p className="mt-1 text-xs text-brown/55">Up to six cards. Images accept HTTPS URLs or safe site paths.</p>
          </div>
          <button type="button" disabled={content.home.enterprises.length >= 6} onClick={addEnterprise} className="rounded-lg border border-green/25 px-3 py-2 text-xs font-bold text-green disabled:opacity-40">Add enterprise</button>
        </div>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {content.home.enterprises.map((item, index) => (
            <fieldset key={item.id} className="space-y-3 rounded-xl border border-brown/10 p-4">
              <legend className="px-2 text-xs font-bold">Enterprise {index + 1}</legend>
              <Field label="Name" value={item.title} onChange={(value) => update(['home', 'enterprises', index, 'title'], value)} maxLength={100} required/>
              <Field label="Description" value={item.description} onChange={(value) => update(['home', 'enterprises', index, 'description'], value)} maxLength={350} required multiline/>
              <StaffMediaInput token={token} label="Enterprise photo" value={item.image} onChange={(value) => update(['home', 'enterprises', index, 'image'], value)} onUploadStateChange={onMediaUploadStateChange} disabled={busy} required/>
              <button type="button" onClick={() => setContent((current) => ({ ...current, home: { ...current.home, enterprises: current.home.enterprises.filter((enterprise) => enterprise.id !== item.id) } }))} className="text-xs font-bold text-red-700">Remove enterprise</button>
            </fieldset>
          ))}
        </div>
      </section>

      <section id="page-join" className="scroll-mt-24 rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 border-b border-brown/10 pb-4">
          <h2 className="font-display text-xl font-bold text-brown sm:text-2xl">Homepage join and onboarding</h2>
          <p className="mt-1 text-xs text-brown/55">Cohort names are fixed to backend-supported options; descriptions can be edited.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['Join eyebrow', 'eyebrow', 80],
            ['First heading line', 'title_first', 100],
            ['Highlighted heading', 'title_highlight', 100],
            ['Supporting note', 'note', 120],
            ['Form eyebrow', 'form_eyebrow', 80],
            ['Form heading', 'form_title', 120],
            ['Submit button label', 'submit_label', 80],
          ].map(([label, key, maxLength]) => (
            <Field key={key} label={label} value={content.home.join[key]} onChange={(value) => update(['home', 'join', key], value)} maxLength={maxLength} required/>
          ))}
          <Field label="Join description" value={content.home.join.description} onChange={(value) => update(['home', 'join', 'description'], value)} maxLength={300} required multiline/>
          <Field label="Form description" value={content.home.join.form_copy} onChange={(value) => update(['home', 'join', 'form_copy'], value)} maxLength={250} required multiline/>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {content.home.join.cohorts.map((cohort, index) => (
            <Field key={cohort.name} label={cohort.name} value={cohort.description} onChange={(value) => update(['home', 'join', 'cohorts', index, 'description'], value)} maxLength={120} required/>
          ))}
        </div>
      </section>

      <section id="page-services" className="scroll-mt-24 rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 border-b border-brown/10 pb-4">
          <h2 className="font-display text-xl font-bold text-brown sm:text-2xl">Services and marketplace pages</h2>
          <p className="mt-1 text-xs text-brown/55">Catalog records (events, passes and inventory) have a separate Events & tickets editor.</p>
        </div>
        <fieldset className="grid gap-4 rounded-xl border border-brown/10 p-4 sm:grid-cols-2">
          <legend className="px-2 text-sm font-bold">Services page</legend>
          {[
            ['Eyebrow', 'eyebrow', 80],
            ['Title', 'title', 120],
            ['Mentorship eyebrow', 'mentorship_eyebrow', 80],
            ['Mentorship heading', 'mentorship_title', 160],
            ['Phone field label', 'phone_label', 80],
            ['Focus field label', 'focus_label', 120],
            ['Submit button label', 'submit_label', 80],
            ['Success message', 'success_message', 240],
          ].map(([label, key, maxLength]) => (
            <Field key={key} label={label} value={content.services[key]} onChange={(value) => update(['services', key], value)} maxLength={maxLength} required/>
          ))}
          <Field label="Introduction" value={content.services.description} onChange={(value) => update(['services', 'description'], value)} maxLength={400} required multiline/>
        </fieldset>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {content.services.cards.map((card, index) => (
            <fieldset key={card.id} className="space-y-3 rounded-xl border border-brown/10 p-4">
              <legend className="px-2 text-xs font-bold">Service card {index + 1}</legend>
              <Field label="Title" value={card.title} onChange={(value) => update(['services', 'cards', index, 'title'], value)} maxLength={100} required/>
              <Field label="Description" value={card.description} onChange={(value) => update(['services', 'cards', index, 'description'], value)} maxLength={300} required multiline/>
              <label className="block text-xs font-bold">Icon
                <select value={card.icon} onChange={(event) => update(['services', 'cards', index, 'icon'], event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal">
                  <option value="users">People</option>
                  <option value="landmark">Enterprise</option>
                  <option value="ticket">Ticket</option>
                </select>
              </label>
            </fieldset>
          ))}
        </div>
        <fieldset className="mt-4 space-y-4 rounded-xl border border-brown/10 p-4">
          <legend className="px-2 text-sm font-bold">Name inspiration guide</legend>
          <p className="text-xs leading-5 text-brown/55">These examples are presented as illustrative, not authoritative. Only publish an individual source attribution when explicit consent has been confirmed.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Eyebrow" value={content.services.name_inspiration_eyebrow} onChange={(value) => update(['services', 'name_inspiration_eyebrow'], value)} maxLength={80} required/>
            <Field label="Heading" value={content.services.name_inspiration_title} onChange={(value) => update(['services', 'name_inspiration_title'], value)} maxLength={160} required/>
            <Field label="Introduction" value={content.services.name_inspiration_description} onChange={(value) => update(['services', 'name_inspiration_description'], value)} maxLength={300} required multiline/>
            <Field label="Cultural accuracy note" value={content.services.name_inspiration_note} onChange={(value) => update(['services', 'name_inspiration_note'], value)} maxLength={500} required multiline/>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {content.services.name_ideas.map((idea, index) => (
              <fieldset key={idea.id} className="space-y-3 rounded-xl border border-brown/10 p-4">
                <legend className="px-2 text-xs font-bold">{idea.id.replace('_', ' ')}</legend>
                <Field label="Circumstance label" value={idea.context_label} onChange={(value) => update(['services', 'name_ideas', index, 'context_label'], value)} maxLength={80} required/>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Male form" value={idea.male_name} onChange={(value) => update(['services', 'name_ideas', index, 'male_name'], value)} maxLength={80} required/>
                  <Field label="Female form" value={idea.female_name} onChange={(value) => update(['services', 'name_ideas', index, 'female_name'], value)} maxLength={80} required/>
                </div>
                <Field label="Associated meaning" value={idea.meaning} onChange={(value) => update(['services', 'name_ideas', index, 'meaning'], value)} maxLength={300} required multiline/>
                <Field label="Source attribution (optional)" value={idea.source_attribution} onChange={(value) => update(['services', 'name_ideas', index, 'source_attribution'], value)} maxLength={160}/>
                <label className="flex items-start gap-2 text-xs font-semibold">
                  <input type="checkbox" checked={idea.source_consent} onChange={(event) => update(['services', 'name_ideas', index, 'source_consent'], event.target.checked)} className="mt-0.5 h-4 w-4 accent-green"/>
                  Explicit consent to publish this attribution is confirmed
                </label>
              </fieldset>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-4 grid gap-4 rounded-xl border border-brown/10 p-4 sm:grid-cols-2">
          <legend className="px-2 text-sm font-bold">Marketplace page</legend>
          <Field label="Eyebrow" value={content.marketplace.eyebrow} onChange={(value) => update(['marketplace', 'eyebrow'], value)} maxLength={80} required/>
          <Field label="Title" value={content.marketplace.title} onChange={(value) => update(['marketplace', 'title'], value)} maxLength={120} required/>
          <Field label="Description" value={content.marketplace.description} onChange={(value) => update(['marketplace', 'description'], value)} maxLength={400} required multiline/>
          <Field label="Multi-pass order button" value={content.marketplace.multi_order_label} onChange={(value) => update(['marketplace', 'multi_order_label'], value)} maxLength={100} required/>
        </fieldset>
      </section>

      <section id="page-houses" className="scroll-mt-24 rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 border-b border-brown/10 pb-4">
          <h2 className="font-display text-xl font-bold text-brown sm:text-2xl">Nine Houses profiles</h2>
          <p className="mt-1 text-xs text-brown/55">House names stay fixed; admins can update each description, homeland and dialect text.</p>
        </div>
        <div className="space-y-4">
          {content.houses.map((house, index) => (
            <fieldset key={house.name} className="grid gap-3 rounded-xl border border-brown/10 p-4 sm:grid-cols-2">
              <legend className="px-2 text-sm font-bold">{house.name}</legend>
              {[
                ['Homeland / anchor', 'anchor', 120, false],
                ['Cultural blueprint', 'blueprint', 250, false],
                ['Tagline', 'tagline', 160, false],
                ['House greeting / dialect', 'dialect', 200, false],
                ['Summary', 'summary', 500, true],
                ['History and heritage', 'history', 800, true],
                ['Modern achievement', 'achievement', 500, true],
              ].map(([label, key, maxLength, multiline]) => (
                <Field key={key} label={label} value={house[key]} onChange={(value) => update(['houses', index, key], value)} maxLength={maxLength} required multiline={multiline}/>
              ))}
            </fieldset>
          ))}
        </div>
      </section>

      {(error || notice) && <p role={error ? 'alert' : 'status'} className={error ? 'rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700' : 'rounded-lg bg-green/5 px-4 py-3 text-sm text-green'}>{error || notice}</p>}
      <div className="sticky bottom-3 z-10 flex justify-end">
        <button type="submit" disabled={busy || mediaUploadCount > 0} className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg disabled:opacity-60"><Save size={16}/>{busy ? 'Saving…' : mediaUploadCount ? 'Uploading media…' : 'Save site settings'}</button>
      </div>
    </form>
  );
}
