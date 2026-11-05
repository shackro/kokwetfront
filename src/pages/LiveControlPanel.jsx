import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Radio, Trash2 } from 'lucide-react';
import { resolveApiUrl, staffRequest } from '../api';

const emptyLiveForm = { creator_name: '', platform: 'tiktok', stream_url: '', topic_title: '' };

export default function LiveControlPanel({ token, canManageSessions = true, canModerateMessages = true }) {
  const [form, setForm] = useState(emptyLiveForm);
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [sessionData, messageData] = await Promise.all([
      canManageSessions ? staffRequest('/v1/staff/live', token) : Promise.resolve({ sessions: [] }),
      canModerateMessages ? staffRequest('/v1/staff/live/messages', token) : Promise.resolve({ messages: [] }),
    ]);
    setSessions(sessionData.sessions);
    setMessages(messageData.messages);
  }, [canManageSessions, canModerateMessages, token]);

  useEffect(() => {
    let active = true;
    refresh()
      .then(() => {
        if (active) setError('');
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load live controls.');
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  async function startLive(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        ...form,
        creator_name: form.creator_name.trim() || 'Kokwet Community',
        platform: form.stream_url.trim() ? form.platform : null,
        stream_url: form.stream_url.trim() || null,
      };
      await staffRequest('/v1/staff/live', token, { method: 'POST', body: payload });
      setForm(emptyLiveForm);
      await refresh();
      setNotice('Conversation room created. It is now available in Kokwet Voice Circle.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to start the live companion.');
    } finally {
      setBusy(false);
    }
  }

  async function endLive(sessionId) {
    setError('');
    try {
      await staffRequest(`/v1/staff/live/${sessionId}/end`, token, { method: 'PATCH' });
      await refresh();
      setNotice('Live companion ended.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to end this live session.');
    }
  }

  async function hideMessage(messageId) {
    setError('');
    try {
      await staffRequest(`/v1/staff/live/messages/${messageId}`, token, { method: 'DELETE' });
      await refresh();
      setNotice('Message hidden from the live chat.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to hide the live message.');
    }
  }

  return (
    <div className="space-y-5">
      {canManageSessions && <section className="rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 border-b border-brown/10 pb-4">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-green/10 text-green"><Radio size={19}/></span><h2 className="font-display text-xl font-bold text-brown sm:text-2xl">Create a conversation room</h2></div>
          <p className="mt-2 text-sm leading-6 text-brown/60">Create the active room for a topic or community group. Add a TikTok or Instagram stream link only when the room is tied to a live broadcast; opening a new room closes the previous active topic.</p>
        </div>
        <form onSubmit={startLive} className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold">Room host or group (optional)
            <input minLength={2} maxLength={80} value={form.creator_name} onChange={(event) => setForm({ ...form, creator_name: event.target.value })} placeholder="Kokwet Community" className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
          </label>
          <label className="text-xs font-bold">Streaming platform (optional)
            <select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 bg-white px-3 py-2.5 text-sm font-normal"><option value="tiktok">TikTok</option><option value="instagram">Instagram</option></select>
          </label>
          <label className="text-xs font-bold sm:col-span-2">Room topic or category
            <input required minLength={3} maxLength={160} value={form.topic_title} onChange={(event) => setForm({ ...form, topic_title: event.target.value })} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
          </label>
          <label className="text-xs font-bold sm:col-span-2">External live stream URL (optional)
            <input type="url" value={form.stream_url} onChange={(event) => setForm({ ...form, stream_url: event.target.value })} placeholder={form.platform === 'tiktok' ? 'https://www.tiktok.com/…' : 'https://www.instagram.com/…'} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal"/>
          </label>
          <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green px-5 py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60">{busy ? 'Creating…' : 'Create active room'}<Radio size={15}/></button>
        </form>
      </section>}

      {canManageSessions && <section className="rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-display text-xl font-bold text-brown">Conversation rooms</h2>
        <div className="mt-4 space-y-3">
          {sessions.map((session) => (
            <article key={session.session_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brown/10 p-4">
              <div className="min-w-0">
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${session.is_active ? 'bg-green/10 text-green' : 'bg-brown/5 text-brown/50'}`}>{session.is_active ? session.stream_url ? 'Live now' : 'Room open' : 'Ended'}</span>
                <h3 className="mt-2 font-bold">{session.topic_title}</h3>
                <p className="mt-1 text-xs text-brown/55">{session.creator_name} · {session.platform ? `${session.platform} stream · ` : 'Chat room · '}{new Date(session.started_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <a href={`/culture?session_id=${encodeURIComponent(session.session_id)}&open_chat=1#live-lounge`} className="inline-flex items-center gap-1 rounded-lg border border-brown/15 px-3 py-2 text-[10px] font-bold">Open room<ExternalLink size={12}/></a>
                {session.is_active && <button type="button" onClick={() => void endLive(session.session_id)} className="rounded-lg border border-red-200 px-3 py-2 text-[10px] font-bold text-red-700">End</button>}
              </div>
            </article>
          ))}
          {!sessions.length && <p className="text-sm text-brown/55">No live sessions yet.</p>}
        </div>
      </section>}

      {canModerateMessages && <section className="rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="font-display text-xl font-bold text-brown">Recent live chat</h2><p className="mt-1 text-xs text-brown/55">Hide messages that violate community expectations.</p></div>
          <button type="button" onClick={() => void refresh().catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Unable to refresh live messages.'))} className="rounded-lg border border-brown/15 px-3 py-2 text-[10px] font-bold">Refresh</button>
        </div>
        <div className="mt-4 space-y-2">
          {messages.filter((message) => !message.is_hidden).map((message) => (
            <article key={message.message_id} className="flex items-start justify-between gap-3 rounded-lg border border-brown/10 p-3">
              <div className="min-w-0"><p className="text-[10px] font-bold text-green">{message.author_name} · {message.channel === 'topic' ? 'Topic' : 'Public'}</p>
                {message.message_type === 'tag' && <span className="mt-1 inline-flex rounded-full bg-orange/10 px-2.5 py-1 text-xs font-bold text-orange">#{message.tag_name}</span>}
                {message.message_text && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-brown/75">{message.message_text}</p>}
                {message.message_type === 'voice' && message.audio_url && <audio controls preload="none" src={resolveApiUrl(message.audio_url)} className="mt-2 h-9 max-w-sm"/>}
              </div>
              <button type="button" onClick={() => void hideMessage(message.message_id)} aria-label={`Hide message from ${message.author_name}`} className="shrink-0 rounded-lg border border-red-200 p-2 text-red-700"><Trash2 size={14}/></button>
            </article>
          ))}
          {!messages.some((message) => !message.is_hidden) && <p className="text-sm text-brown/55">No live messages to review.</p>}
        </div>
      </section>}

      {(error || notice) && <p role={error ? 'alert' : 'status'} className={error ? 'rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700' : 'rounded-lg bg-green/5 px-4 py-3 text-sm text-green'}>{error || notice}</p>}
    </div>
  );
}
