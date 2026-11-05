import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanType, Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, CameraOff, Ticket } from 'lucide-react';
import { staffRequest } from '../api';

const resultStyles = {
  valid: 'border-green/20 bg-green/5 text-green',
  duplicate: 'border-orange/30 bg-orange/10 text-brown',
  unpaid: 'border-red-200 bg-red-50 text-red-800',
  invalid: 'border-red-200 bg-red-50 text-red-800',
};

export default function TicketGatePanel({ token, isAdmin }) {
  const [ticketId, setTicketId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [reviewOrders, setReviewOrders] = useState([]);
  const [reviewError, setReviewError] = useState('');
  const inputRef = useRef(null);
  const scannerRef = useRef(null);
  const scanLockedRef = useRef(false);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    staffRequest('/v1/staff/ticket-orders/review', token)
      .then((data) => {
        if (active) setReviewOrders(data.orders);
      })
      .catch((requestError) => {
        if (active) setReviewError(requestError instanceof Error ? requestError.message : 'Unable to load payment reviews.');
      });
    return () => {
      active = false;
    };
  }, [isAdmin, token]);

  async function validateTicket(scannedId) {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await staffRequest('/v1/tickets/validate', token, {
        method: 'POST',
        body: { ticket_id: scannedId },
      });
      setResult(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ticket scan failed.');
    } finally {
      setTicketId('');
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  useEffect(() => {
    if (!cameraEnabled) return undefined;
    let active = true;
    const scanner = new Html5QrcodeScanner(
      'ticket-qr-camera',
      {
        fps: 10,
        qrbox: { width: 230, height: 230 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        showTorchButtonIfSupported: true,
      },
      false,
    );
    scannerRef.current = scanner;
    scanner.render((decodedText) => {
      if (!active || scanLockedRef.current) return;
      scanLockedRef.current = true;
      scanner.pause(true);
      void validateTicket(decodedText);
    }, undefined);
    return () => {
      active = false;
      scannerRef.current = null;
      void scanner.clear().catch((clearError) => {
        console.error('Unable to stop the ticket camera scanner.', clearError);
      });
    };
  }, [cameraEnabled, token]);

  async function submitManualScan(event) {
    event.preventDefault();
    const scannedId = ticketId.trim();
    if (!scannedId || scanLockedRef.current) return;
    scanLockedRef.current = true;
    scannerRef.current?.pause(true);
    await validateTicket(scannedId);
  }

  function resumeScanning() {
    setError('');
    setResult(null);
    scanLockedRef.current = false;
    if (cameraEnabled) scannerRef.current?.resume();
    else inputRef.current?.focus();
  }

  function toggleCamera() {
    if (!cameraEnabled && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)) {
      setError('Camera scanning needs a secure HTTPS page. Enter the ticket token manually instead.');
      return;
    }
    setError('');
    setCameraEnabled((enabled) => !enabled);
  }

  return (
    <section className="rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-center gap-3 border-b border-brown/10 pb-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-green/10 text-green"><Ticket size={19}/></span>
        <div>
          <h2 className="font-display text-xl font-bold text-brown sm:text-2xl">Festival gate scanning</h2>
          <p className="mt-1 text-xs text-brown/55">Scan each paid ticket QR once. Camera scanning requires HTTPS and permission.</p>
        </div>
      </div>

      <div className="space-y-4">
        <button type="button" onClick={toggleCamera} aria-pressed={cameraEnabled} className="inline-flex items-center gap-2 rounded-lg border border-green/25 px-4 py-2.5 text-xs font-bold text-green">
          {cameraEnabled ? <CameraOff size={16}/> : <Camera size={16}/>}
          {cameraEnabled ? 'Stop camera' : 'Start QR camera'}
        </button>
        {cameraEnabled && <div id="ticket-qr-camera" className="max-w-xl overflow-hidden rounded-xl border border-brown/10"/>}
        <form onSubmit={submitManualScan} className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="gate-ticket-token">Ticket token</label>
          <input
            ref={inputRef}
            id="gate-ticket-token"
            autoFocus
            autoComplete="off"
            inputMode="text"
            value={ticketId}
            onChange={(event) => setTicketId(event.target.value)}
            placeholder="Or enter ticket token"
            className="min-w-0 flex-1 rounded-lg border border-brown/20 px-4 py-3 font-mono text-sm outline-none focus:border-green"
          />
          <button type="submit" disabled={busy || !ticketId.trim()} className="rounded-lg bg-green px-6 py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50">
            {busy ? 'Checking…' : 'Validate entry'}
          </button>
        </form>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {result && (
        <div role="status" aria-live="assertive" className={`mt-4 rounded-xl border p-5 ${resultStyles[result.status] || resultStyles.invalid}`}>
          <p className="text-sm font-black uppercase tracking-wider">
            {result.status === 'valid' ? 'Access granted' : result.status === 'duplicate' ? 'Already scanned' : result.status === 'unpaid' ? 'Payment not confirmed' : 'Ticket not valid'}
          </p>
          <p className="mt-2 text-sm">{result.message}</p>
          {result.pass && <p className="mt-2 text-xs font-bold">{result.pass}</p>}
          {result.status === 'valid' && result.owner_phone_last4 && (
            <div className="mt-3 rounded-lg border border-green/15 bg-white/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-brown/55">Purchaser phone check</p>
              <p className="mt-1 font-mono text-lg font-black tracking-widest text-green">
                *** *** **{result.owner_phone_last4}
              </p>
              <p className="mt-1 text-[10px] text-brown/55">Ask the attendee to confirm the last four digits.</p>
            </div>
          )}
          {result.scanned_at && <time className="mt-2 block text-[10px]">{new Date(result.scanned_at).toLocaleString()}</time>}
          <button type="button" onClick={resumeScanning} className="mt-4 rounded-lg bg-brown px-4 py-2.5 text-xs font-bold text-white">
            Scan next ticket
          </button>
        </div>
      )}
      {error && cameraEnabled && (
        <button type="button" onClick={resumeScanning} className="mt-4 rounded-lg border border-brown/20 px-4 py-2.5 text-xs font-bold">
          Resume camera
        </button>
      )}
      {isAdmin && (
        <div className="mt-7 border-t border-brown/10 pt-5">
          <h3 className="text-sm font-bold text-brown">Ticket payments requiring review</h3>
          <p className="mt-1 text-xs leading-5 text-brown/55">Compare these references with the Daraja transaction record before resolving payment questions.</p>
          {reviewError && <p role="alert" className="mt-3 text-xs text-red-700">{reviewError}</p>}
          {reviewOrders.length
            ? <div className="mt-3 space-y-2">{reviewOrders.map((order) => (
              <article key={order.order_id} className="rounded-lg border border-orange/25 bg-orange/5 p-3 text-xs">
                <p className="font-bold">KSh {Number(order.total).toLocaleString()} · {order.phone}</p>
                <code className="mt-1 block break-all">{order.order_id}</code>
                <time className="mt-1 block text-[10px] text-brown/55">{new Date(order.created_at).toLocaleString()}</time>
              </article>
            ))}</div>
            : <p className="mt-3 text-xs text-brown/50">No payment reviews are pending.</p>}
        </div>
      )}
    </section>
  );
}
