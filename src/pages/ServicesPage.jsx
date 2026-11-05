import { useState } from 'react';
import { ArrowRight, Landmark, QrCode, Users } from 'lucide-react';
import { postJson } from '../api';
import SectionTitle from '../components/SectionTitle';
import NameInspiration from '../components/NameInspiration';
import { useSiteContent } from '../siteContent';

const serviceIcons = { users: Users, landmark: Landmark, ticket: QrCode };
const defaultServices = {
  eyebrow: 'Beyond the festival',
  title: 'The high-utility service hub',
  description: 'A practical bridge between campus ambition, established experience and local enterprise.',
  cards: [
    { id: 'mentorship', title: 'Mentorship nexus', description: 'Request a resume review or career guidance from verified professionals.', icon: 'users' },
    { id: 'enterprise', title: 'Creative enterprise', description: 'Promote a venture, cultural work or agri-enterprise to the wider community.', icon: 'landmark' },
    { id: 'festival-access', title: 'Festival access', description: 'Claim a pass and receive a unique, secure digital token.', icon: 'ticket' },
  ],
  mentorship_eyebrow: 'Intergenerational mentorship',
  mentorship_title: 'Bring your ambition. We’ll find a guide.',
  phone_label: 'Mobile number',
  focus_label: 'What can an elder help you with?',
  submit_label: 'Request mentorship',
  success_message: 'Request received. A mentor coordinator will be in touch.',
};

export default function ServicesPage() {
  const [form, setForm] = useState({ phone: '', focus: '' });
  const [status, setStatus] = useState('');
  const { content } = useSiteContent();
  const page = content?.services || defaultServices;

  async function submit(event) {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
    setStatus('loading');
    try {
      await postJson('/mentorship', form);
      setStatus('received');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to submit');
    }
  }

  return (
    <section className="px-4 py-10 sm:px-5 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <SectionTitle
          eyebrow={page.eyebrow}
          title={page.title}
          copy={page.description}
        />
        <NameInspiration content={page}/>
        <div className="mt-8 grid gap-4 sm:mt-12 sm:gap-5 md:grid-cols-3">
          {page.cards.map((card) => {
            const Icon = serviceIcons[card.icon] || Users;
            return (
            <div key={card.id} className="rounded-3xl border border-brown/10 bg-white p-5 sm:p-7">
              <Icon className="text-orange"/>
              <h2 className="mt-4 font-display text-xl font-bold sm:mt-5 sm:text-2xl">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-brown/55">{card.description}</p>
            </div>
          )})}
        </div>
        <div className="mt-8 grid overflow-hidden rounded-3xl bg-white shadow-sm sm:mt-12 lg:grid-cols-2">
          <div className="pattern bg-brown p-6 text-white sm:p-8 md:p-12">
            <p className="text-xs font-bold uppercase tracking-widest text-gold">{page.mentorship_eyebrow}</p>
            <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{page.mentorship_title}</h2>
          </div>
          <form onSubmit={submit} className="p-6 sm:p-8 md:p-12">
            <label htmlFor="mentorship-phone" className="text-sm font-bold">{page.phone_label}</label>
            <input
              id="mentorship-phone"
              type="tel"
              autoComplete="tel"
              required
              pattern="(?:\+254|254|0)7\d{8}"
              value={form.phone}
              onChange={event => setForm({ ...form, phone: event.target.value })}
              placeholder="0712345678"
              className="mt-2 w-full rounded-xl border border-brown/15 p-3 sm:p-4"
            />
            <label htmlFor="mentorship-focus" className="mt-5 block text-sm font-bold">{page.focus_label}</label>
            <textarea
              id="mentorship-focus"
              required
              minLength={8}
              value={form.focus}
              onChange={event => setForm({ ...form, focus: event.target.value })}
              className="mt-2 h-24 w-full resize-none rounded-xl border border-brown/15 p-3 sm:h-28 sm:p-4"
            />
            <button disabled={status === 'loading'} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange py-3 font-bold disabled:opacity-60 sm:py-4">
              {status === 'loading' ? 'Sending request…' : page.submit_label} <ArrowRight size={17}/>
            </button>
            {status && status !== 'loading' && (
              <p role={status === 'received' ? 'status' : 'alert'} className={`mt-4 font-semibold ${status === 'received' ? 'text-green' : 'text-red-700'}`}>
                {status === 'received' ? page.success_message : status}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
