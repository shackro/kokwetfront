import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { postJson } from '../api';

export default function StaffActivationPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    phone: '',
    activation_code: '',
    full_name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function activate(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await postJson('/v1/staff/auth/activate', form);
      sessionStorage.setItem('kokwet-staff-token', data.token);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to activate this account.');
    } finally {
      setBusy(false);
    }
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <section className="min-h-[75vh] bg-offwhite px-5 py-14">
      <div className="mx-auto max-w-md rounded-2xl border border-brown/10 bg-white p-6 shadow-lg sm:p-9">
        <span className="inline-flex items-center gap-2 rounded-full bg-green/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-green">Kokwet staff invitation</span>
        <h1 className="mt-4 font-display text-3xl font-bold text-brown">Activate your account</h1>
        <p className="mt-2 text-sm leading-6 text-brown/60">Use the phone number and one-time code shared by your administrator. Choose your own sign-in password.</p>
        <form onSubmit={activate} className="mt-6 space-y-4">
          <label className="block text-xs font-bold">Invited phone number
            <input autoComplete="tel" type="tel" inputMode="tel" pattern="(?:\+254|254|0)7[0-9]{8}" placeholder="+254712345678" required value={form.phone} onChange={(event) => update('phone', event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-3 text-sm font-normal outline-none focus:border-green"/>
          </label>
          <label className="block text-xs font-bold">Six-digit activation code
            <input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={form.activation_code} onChange={(event) => update('activation_code', event.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-3 text-sm font-normal tracking-[.25em] outline-none focus:border-green"/>
          </label>
          <label className="block text-xs font-bold">Your full name
            <input autoComplete="name" minLength={2} maxLength={80} required value={form.full_name} onChange={(event) => update('full_name', event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-3 text-sm font-normal outline-none focus:border-green"/>
          </label>
          <label className="block text-xs font-bold">Your email
            <input autoComplete="email" type="email" maxLength={254} required value={form.email} onChange={(event) => update('email', event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-3 text-sm font-normal outline-none focus:border-green"/>
          </label>
          <label className="block text-xs font-bold">Create password
            <input autoComplete="new-password" type="password" minLength={12} maxLength={256} required value={form.password} onChange={(event) => update('password', event.target.value)} className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-3 text-sm font-normal outline-none focus:border-green"/>
            <span className="mt-1 block text-[10px] font-normal text-brown/50">Use at least 12 characters. Your password is stored as a secure hash.</span>
          </label>
          {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-brown px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-green disabled:opacity-60">{busy ? 'Activating…' : 'Activate and sign in'}</button>
        </form>
        <p className="mt-5 text-center text-xs text-brown/60">Already activated? <Link to="/login" className="font-bold text-green underline">Sign in</Link></p>
      </div>
    </section>
  );
}
