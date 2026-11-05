import { useState } from 'react';
import { postJson } from '../api';

export default function TicketEmailForm({ orderId, emailSent = false, onSent }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  async function sendTicketEmail(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await postJson(
        `/v1/tickets/orders/${encodeURIComponent(orderId)}/email`,
        { email },
      );
      setSentTo(result.email);
      setEmail(result.email);
      onSent?.();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send the ticket email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={sendTicketEmail} className="mt-5 rounded-xl border border-brown/10 bg-white p-4 text-left">
      <label className="block text-xs font-bold text-brown">
        Email your tickets
        <input
          required
          type="email"
          maxLength={254}
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="mt-2 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal outline-none focus:border-orange"
        />
      </label>
      <p className="mt-2 text-[11px] leading-5 text-brown/60">
        We’ll email a private link to your tickets and entry QR codes.
      </p>
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
      {sentTo && (
        <p role="status" className="mt-2 text-xs font-semibold text-green">
          Ticket link sent to {sentTo}.
        </p>
      )}
      {!sentTo && emailSent && (
        <p role="status" className="mt-2 text-xs font-semibold text-green">
          A ticket email was sent previously. Enter an address to send it again.
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !email.trim()}
        className="mt-3 w-full rounded-lg bg-green px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brown disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Sending ticket email…' : sentTo || emailSent ? 'Send ticket link again' : 'Email my tickets'}
      </button>
    </form>
  );
}
