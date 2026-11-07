import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, RefreshCw, Save, ShieldCheck, Wifi } from 'lucide-react';
import { staffRequest } from '../api';

const paymentFields = [
  ['MPESA_CONSUMER_KEY', 'Consumer Key'],
  ['MPESA_CONSUMER_SECRET', 'Consumer Secret'],
  ['MPESA_SHORTCODE', 'Business Short Code'],
  ['MPESA_PASSKEY', 'Passkey'],
  ['MPESA_TRANSACTION_TYPE', 'STK transaction type'],
  ['MPESA_PARTY_B', 'Party B / Till number'],
  ['MPESA_CALLBACK_URL', 'Callback URL'],
  ['CULTURE_WEBHOOK_SECRET', 'Callback webhook secret'],
];

const emptySecrets = {
  consumer_key: '',
  consumer_secret: '',
  passkey: '',
  webhook_secret: '',
};

function SecretField({ label, value, onChange, configured }) {
  return (
    <label className="block text-xs font-bold">
      {label}
      <input
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={configured ? 'Saved securely; leave blank to keep current value' : 'Required to enable payment'}
        className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal outline-none focus:border-green"
      />
    </label>
  );
}

function PaymentPanel({ title, children, icon: Icon }) {
  return (
    <section className="rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-center gap-3 border-b border-brown/10 pb-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-green/10 text-green"><Icon size={19}/></span>
        <h2 className="font-display text-xl font-bold text-brown sm:text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function PaymentSettingsPanel({ token }) {
  const [configuration, setConfiguration] = useState(null);
  const [environment, setEnvironment] = useState('sandbox');
  const [transactionType, setTransactionType] = useState('CustomerPayBillOnline');
  const [shortcode, setShortcode] = useState('');
  const [partyB, setPartyB] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [secrets, setSecrets] = useState(emptySecrets);
  const [confirmProduction, setConfirmProduction] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    staffRequest('/v1/staff/payment-settings', token)
      .then((data) => {
        if (!active) return;
        setConfiguration(data);
        setEnvironment(data.environment);
        setTransactionType(data.transaction_type);
        setShortcode(data.shortcode || '');
        setPartyB(data.party_b || '');
        setCallbackUrl(data.callback_url || '');
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load payment settings.');
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function saveSettings(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const payload = {
      environment,
      shortcode: shortcode.trim(),
      transaction_type: transactionType,
      party_b: partyB.trim(),
      callback_url: callbackUrl.trim(),
      confirm_production: confirmProduction,
      ...Object.fromEntries(
        Object.entries(secrets)
          .filter(([, value]) => value.trim())
          .map(([name, value]) => [name, value.trim()]),
      ),
    };
    try {
      const data = await staffRequest('/v1/staff/payment-settings', token, {
        method: 'PUT',
        body: payload,
      });
      setConfiguration(data);
      setSecrets(emptySecrets);
      setNotice('Payment settings saved securely. They are active immediately and persist across backend restarts.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save payment settings.');
    } finally {
      setBusy(false);
    }
  }

  async function testOAuth() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = await staffRequest('/v1/staff/payment-settings/test-oauth', token, { method: 'POST', body: {} });
      setNotice(`${result.message} Environment: ${result.environment}.`);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Daraja OAuth test failed.');
    } finally {
      setBusy(false);
    }
  }

  async function resetToDeploymentSettings() {
    if (!window.confirm('Remove saved admin overrides and return to the backend deployment environment settings?')) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const data = await staffRequest('/v1/staff/payment-settings', token, { method: 'DELETE' });
      setConfiguration(data);
      setSecrets(emptySecrets);
      setShortcode(data.shortcode || '');
      setTransactionType(data.transaction_type);
      setPartyB(data.party_b || '');
      setCallbackUrl(data.callback_url || '');
      setEnvironment(data.environment);
      setNotice('Admin overrides removed. The backend is using its deployment environment settings.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to reset payment settings.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PaymentPanel title="Daraja M-Pesa payment setup" icon={CreditCard}>
        <p className="mb-5 text-sm leading-6 text-brown/65">
          Configure the backend credentials used by ticket and culture checkout. Only the Super Admin can manage these settings. Secrets are encrypted in the persistent database and are never returned to the browser.
        </p>

        {configuration && (
          <div className={`mb-5 rounded-xl border p-4 ${configuration.ready ? 'border-green/20 bg-green/5' : 'border-orange/25 bg-orange/5'}`}>
            <p className="flex items-center gap-2 text-sm font-bold text-brown">
              {configuration.ready ? <CheckCircle2 size={17} className="text-green"/> : <ShieldCheck size={17} className="text-orange"/>}
              {configuration.ready ? 'Payment configuration is complete' : 'Configuration needs attention'}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {paymentFields.map(([name, label]) => (
                <p key={name} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-brown/70">{label}</span>
                  <span className={configuration.has_values[name] ? 'font-bold text-green' : 'font-bold text-orange'}>
                    {configuration.has_values[name] ? 'Configured' : 'Missing'}
                  </span>
                </p>
              ))}
            </div>
            {configuration.missing?.length > 0 && (
              <p className="mt-3 text-xs text-brown/70">Checkout remains unavailable until every required setting is configured.</p>
            )}
          </div>
        )}

        <form onSubmit={saveSettings} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-bold">
              Daraja environment
              <select
                value={environment}
                onChange={(event) => {
                  setEnvironment(event.target.value);
                  setConfirmProduction(false);
                }}
                className="mt-1.5 w-full rounded-lg border border-brown/15 bg-white px-3 py-2.5 text-sm font-normal"
              >
                <option value="sandbox">Sandbox · test only</option>
                <option value="production">Production · real charges</option>
              </select>
            </label>
            <label className="block text-xs font-bold">
              Business Short Code
              <input
                inputMode="numeric"
                maxLength={10}
                value={shortcode}
                onChange={(event) => {
                  setShortcode(event.target.value);
                  if (transactionType === 'CustomerPayBillOnline') setPartyB(event.target.value);
                }}
                placeholder="e.g. 174379 for sandbox"
                className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal outline-none focus:border-green"
              />
            </label>
            <label className="block text-xs font-bold">
              STK transaction type
              <select
                value={transactionType}
                onChange={(event) => {
                  setTransactionType(event.target.value);
                  if (event.target.value === 'CustomerPayBillOnline') setPartyB(shortcode);
                }}
                className="mt-1.5 w-full rounded-lg border border-brown/15 bg-white px-3 py-2.5 text-sm font-normal"
              >
                <option value="CustomerPayBillOnline">PayBill</option>
                <option value="CustomerBuyGoodsOnline">Buy Goods / Till</option>
              </select>
            </label>
            <label className="block text-xs font-bold">
              Party B / Till number
              <input
                inputMode="numeric"
                maxLength={10}
                value={partyB}
                onChange={(event) => setPartyB(event.target.value)}
                placeholder="Defaults to the Business Short Code"
                className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal outline-none focus:border-green"
              />
              <span className="mt-1.5 block font-normal text-brown/55">For a Till, enter its Party B number. For PayBill, this must match the Business Short Code.</span>
            </label>
            <SecretField label="Consumer Key" value={secrets.consumer_key} configured={configuration?.has_values.MPESA_CONSUMER_KEY} onChange={(value) => setSecrets((current) => ({ ...current, consumer_key: value }))}/>
            <SecretField label="Consumer Secret" value={secrets.consumer_secret} configured={configuration?.has_values.MPESA_CONSUMER_SECRET} onChange={(value) => setSecrets((current) => ({ ...current, consumer_secret: value }))}/>
            <SecretField label="Lipa Na M-Pesa Passkey" value={secrets.passkey} configured={configuration?.has_values.MPESA_PASSKEY} onChange={(value) => setSecrets((current) => ({ ...current, passkey: value }))}/>
            <SecretField label="Callback webhook secret" value={secrets.webhook_secret} configured={configuration?.has_values.CULTURE_WEBHOOK_SECRET} onChange={(value) => setSecrets((current) => ({ ...current, webhook_secret: value }))}/>
            <label className="block text-xs font-bold sm:col-span-2">
              Public HTTPS callback URL
              <input
                type="url"
                value={callbackUrl}
                onChange={(event) => setCallbackUrl(event.target.value)}
                placeholder="https://your-backend.example/api/v1/culture/webhook/extend-lifespan"
                className="mt-1.5 w-full rounded-lg border border-brown/15 px-3 py-2.5 text-sm font-normal outline-none focus:border-green"
              />
              <span className="mt-1.5 block font-normal text-brown/55">Use the deployed HTTPS backend URL. Ticket checkout selects its own callback route automatically; do not append a callback token.</span>
            </label>
          </div>

          {environment === 'production' && (
            <label className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <input type="checkbox" checked={confirmProduction} onChange={(event) => setConfirmProduction(event.target.checked)} className="mt-0.5"/>
              <span><strong>Confirm live payments.</strong> Production credentials can charge real customers when checkout is used.</span>
            </label>
          )}

          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          {notice && <p role="status" className="rounded-lg border border-green/20 bg-green/5 px-4 py-3 text-sm font-semibold text-green">{notice}</p>}

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy || (environment === 'production' && !confirmProduction)} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"><Save size={15}/>{busy ? 'Saving…' : 'Save payment settings'}</button>
            <button type="button" onClick={() => void testOAuth()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-green/25 bg-white px-5 py-3 text-xs font-black uppercase tracking-wider text-green disabled:opacity-50"><Wifi size={15}/>{busy ? 'Please wait…' : 'Test OAuth only'}</button>
            <button type="button" onClick={() => void resetToDeploymentSettings()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-brown/15 bg-white px-5 py-3 text-xs font-bold text-brown/70 disabled:opacity-50"><RefreshCw size={15}/>Use deployment settings</button>
          </div>
        </form>
      </PaymentPanel>
      <p className="px-2 text-xs leading-5 text-brown/55">
        Switching to production affects both ticket and culture payments. Test the sandbox first; use OAuth test only to verify credentials. Never enter production credentials while the environment is set to sandbox.
      </p>
    </div>
  );
}
