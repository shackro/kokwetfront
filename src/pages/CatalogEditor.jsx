import { useEffect, useState } from 'react';
import { CalendarDays, Save, Ticket } from 'lucide-react';
import { staffRequest } from '../api';

function CatalogField({ label, value, onChange, type = 'text', ...props }) {
  return (
    <label className="block text-xs font-bold">
      {label}
      <input type={type} value={value ?? ''} onChange={(event) => onChange(type === 'number' ? Number(event.target.value) : event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal outline-none focus:border-green" {...props}/>
    </label>
  );
}

export default function CatalogEditor({ token }) {
  const [events, setEvents] = useState([]);
  const [passes, setPasses] = useState([]);
  const [newEventSlugs, setNewEventSlugs] = useState(() => new Set());
  const [newPassIds, setNewPassIds] = useState(() => new Set());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState('');

  useEffect(() => {
    let active = true;
    staffRequest('/v1/staff/catalog', token)
      .then((data) => {
        if (active) {
          setEvents(data.events);
          setPasses(data.passes);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load events and passes.');
      });
    return () => {
      active = false;
    };
  }, [token]);

  function updateEvent(slug, field, value) {
    setEvents((current) => current.map((event) => event.slug === slug ? { ...event, [field]: value } : event));
    setNotice('');
  }

  function updatePass(id, field, value) {
    setPasses((current) => current.map((pass) => pass.id === id ? { ...pass, [field]: value } : pass));
    setNotice('');
  }

  function addEvent() {
    const slug = `new-event-${Date.now()}`;
    setEvents((current) => [...current, {
      id: null,
      slug,
      title: 'New Kokwet event',
      category: 'Community',
      venue: 'To be announced',
      date: new Date().toISOString(),
      focus: 'Add event details before publishing.',
      external_url: null,
      is_main_event: false,
      is_active: false,
      sort_order: 1000,
    }]);
    setNewEventSlugs((current) => new Set(current).add(slug));
    setNotice('');
  }

  function addPass() {
    const id = `new-pass-${Date.now()}`;
    setPasses((current) => [...current, {
      id,
      name: 'New pass option',
      price: 0,
      stock: 0,
      note: 'Add pass details before publishing.',
      is_active: false,
      sort_order: 1000,
    }]);
    setNewPassIds((current) => new Set(current).add(id));
    setNotice('');
  }

  async function saveEvent(event) {
    setBusyKey(event.slug);
    setError('');
    setNotice('');
    try {
      const isNew = newEventSlugs.has(event.slug);
      const saved = await staffRequest(isNew ? '/v1/staff/events' : `/v1/staff/events/${encodeURIComponent(event.slug)}`, token, { method: isNew ? 'POST' : 'PUT', body: event });
      setEvents((current) => current.map((item) => item.slug === event.slug ? saved.event : item));
      if (isNew) setNewEventSlugs((current) => {
        const next = new Set(current);
        next.delete(event.slug);
        return next;
      });
      setNotice(`${event.title} updated.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save this event.');
    } finally {
      setBusyKey('');
    }
  }

  async function savePass(pass) {
    setBusyKey(pass.id);
    setError('');
    setNotice('');
    try {
      const isNew = newPassIds.has(pass.id);
      const saved = await staffRequest(isNew ? '/v1/staff/passes' : `/v1/staff/passes/${encodeURIComponent(pass.id)}`, token, { method: isNew ? 'POST' : 'PUT', body: pass });
      setPasses((current) => current.map((item) => item.id === pass.id ? saved.pass : item));
      if (isNew) setNewPassIds((current) => {
        const next = new Set(current);
        next.delete(pass.id);
        return next;
      });
      setNotice(`${pass.name} updated. Ticket inventory is now persistent.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save this pass.');
    } finally {
      setBusyKey('');
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-brown/10 pb-4">
        <div>
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-green/10 text-green"><CalendarDays size={19}/></span><h2 className="font-display text-xl font-bold text-brown sm:text-2xl">Festival events</h2></div>
          <p className="mt-2 text-sm text-brown/55">These event records power the homepage noticeboard, countdown and festival promotion.</p>
        </div>
        <button type="button" onClick={addEvent} className="rounded-lg border border-green/25 px-3 py-2 text-xs font-bold text-green">Add event</button>
        </div>
        <div className="space-y-4">
          {events.map((event) => (
            <article key={event.slug} className="rounded-xl border border-brown/10 p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <CatalogField label="Event title" value={event.title} onChange={(value) => updateEvent(event.slug, 'title', value)} minLength={3} maxLength={160} required/>
                <CatalogField label="Category" value={event.category} onChange={(value) => updateEvent(event.slug, 'category', value)} maxLength={80} required/>
                <CatalogField label="Venue" value={event.venue} onChange={(value) => updateEvent(event.slug, 'venue', value)} maxLength={160} required/>
                <CatalogField label="Date and time (ISO-8601)" value={event.date} onChange={(value) => updateEvent(event.slug, 'date', value)} placeholder="2026-11-20T12:00:00+03:00" maxLength={40} required/>
                <CatalogField label="External site (optional, HTTPS)" value={event.external_url || ''} onChange={(value) => updateEvent(event.slug, 'external_url', value || null)} type="url" maxLength={1000}/>
                <CatalogField label="Display order" value={event.sort_order} onChange={(value) => updateEvent(event.slug, 'sort_order', value)} type="number" min={0} max={10000}/>
                <label className="text-xs font-bold sm:col-span-2">Event description
                  <textarea value={event.focus} onChange={(inputEvent) => updateEvent(event.slug, 'focus', inputEvent.target.value)} minLength={10} maxLength={600} rows={2} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6"/>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={event.is_main_event} onChange={(inputEvent) => updateEvent(event.slug, 'is_main_event', inputEvent.target.checked)} className="h-4 w-4 accent-green"/>Main countdown event</label>
                  <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={event.is_active} onChange={(inputEvent) => updateEvent(event.slug, 'is_active', inputEvent.target.checked)} className="h-4 w-4 accent-green"/>Published</label>
                </div>
                <button type="button" disabled={busyKey === event.slug} onClick={() => void saveEvent(event)} className="inline-flex items-center gap-2 rounded-lg bg-green px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Save size={14}/>{busyKey === event.slug ? 'Saving…' : 'Save event'}</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-brown/10 pb-4">
        <div>
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-orange/10 text-orange"><Ticket size={19}/></span><h2 className="font-display text-xl font-bold text-brown sm:text-2xl">Passes and inventory</h2></div>
          <p className="mt-2 text-sm text-brown/55">Prices and stock are validated by the backend. Checkout decrements inventory in a SQLite transaction.</p>
        </div>
        <button type="button" onClick={addPass} className="rounded-lg border border-green/25 px-3 py-2 text-xs font-bold text-green">Add pass</button>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {passes.map((pass) => (
            <article key={pass.id} className="space-y-3 rounded-xl border border-brown/10 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-orange">Pass ID · {pass.id}</p>
              <CatalogField label="Public name" value={pass.name} onChange={(value) => updatePass(pass.id, 'name', value)} minLength={2} maxLength={100} required/>
              <div className="grid grid-cols-2 gap-3">
                <CatalogField label="Price (KES)" value={pass.price} onChange={(value) => updatePass(pass.id, 'price', value)} type="number" min={0} max={10000000} required/>
                <CatalogField label="Stock" value={pass.stock} onChange={(value) => updatePass(pass.id, 'stock', value)} type="number" min={0} max={1000000} required/>
              </div>
              <CatalogField label="Display order" value={pass.sort_order} onChange={(value) => updatePass(pass.id, 'sort_order', value)} type="number" min={0} max={10000}/>
              <label className="block text-xs font-bold">Description
                <textarea value={pass.note} onChange={(event) => updatePass(pass.id, 'note', event.target.value)} minLength={2} maxLength={300} rows={2} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal leading-6"/>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={pass.is_active} onChange={(event) => updatePass(pass.id, 'is_active', event.target.checked)} className="h-4 w-4 accent-green"/>Available for sale</label>
              <button type="button" disabled={busyKey === pass.id} onClick={() => void savePass(pass)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Save size={14}/>{busyKey === pass.id ? 'Saving…' : 'Save pass'}</button>
            </article>
          ))}
        </div>
      </section>

      {(error || notice) && <p role={error ? 'alert' : 'status'} className={error ? 'rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700' : 'rounded-lg bg-green/5 px-4 py-3 text-sm text-green'}>{error || notice}</p>}
    </div>
  );
}
