import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, ExternalLink, Printer, Ticket } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import TicketEmailForm from '../components/TicketEmailForm';
import { getJson } from '../api';

function downloadQr(ticket) {
  const svg = document.getElementById(`ticket-qr-${ticket.id}`);
  if (!(svg instanceof SVGElement)) return;
  const copy = svg.cloneNode(true);
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const file = new Blob([new XMLSerializer().serializeToString(copy)], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `kokwet-ticket-${ticket.id}.svg`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function TicketAccessPage() {
  const { orderId = '' } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    async function refreshOrder() {
      try {
        const latest = await getJson(`/v1/tickets/orders/${encodeURIComponent(orderId)}`);
        if (active) {
          setOrder(latest);
          setError('');
        }
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load this ticket order.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void refreshOrder();
    const timer = window.setInterval(() => {
      if (active && order?.status === 'Payment pending') void refreshOrder();
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [order?.status, orderId]);

  async function copyTicketLink() {
    setError('');
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setError('Could not copy the ticket link. You can copy it from the address bar.');
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-sm text-brown/60" role="status">Loading your ticket order…</p>;
  }

  if (error && !order) {
    return (
      <section className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="font-display text-3xl font-bold text-brown">Ticket link unavailable</h1>
        <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>
        <Link to="/marketplace" className="mt-6 inline-flex rounded-lg bg-orange px-4 py-3 text-sm font-bold text-brown">
          Return to Marketplace
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="rounded-2xl border border-brown/10 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-green/10 text-green print:hidden">
            <Ticket size={23} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-orange">Kokwet Festival · Ticket wallet</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-brown sm:text-3xl">
              {order?.status === 'Paid' ? 'Your tickets' : 'Payment confirmation'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-brown/65">
              {order?.status === 'Paid'
                ? 'Your payment is confirmed. Keep the QR codes ready for entry.'
                : order?.status === 'Payment pending'
                  ? 'Your M-Pesa payment is still processing. This page checks for confirmation automatically.'
                  : `Order status: ${order?.status || 'unknown'}. Tickets appear here only after payment confirmation.`}
            </p>
            {order?.payment_failure_reason && (
              <p className="mt-2 text-sm leading-6 text-red-700">
                M-Pesa response{order.payment_result_code ? ` (${order.payment_result_code})` : ''}: {order.payment_failure_reason}
              </p>
            )}
          </div>
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {order?.status === 'Paid' && (
          <>
            <div className="mt-6 flex flex-wrap gap-3 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg bg-brown px-4 py-2.5 text-xs font-bold text-white transition hover:bg-green"
              >
                <Printer size={15} aria-hidden="true" />
                Print / Save as PDF
              </button>
              <button
                type="button"
                onClick={() => void copyTicketLink()}
                className="inline-flex items-center gap-2 rounded-lg border border-brown/20 px-4 py-2.5 text-xs font-bold text-brown transition hover:border-orange"
              >
                <ExternalLink size={15} aria-hidden="true" />
                {copied ? 'Link copied' : 'Copy private ticket link'}
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {order.tickets.map((ticket) => (
                <article key={ticket.id} className="break-inside-avoid rounded-xl border border-brown/10 p-4 text-center">
                  <h2 className="text-sm font-bold text-brown">{ticket.pass}</h2>
                  <div className="my-4 flex justify-center">
                    <QRCodeSVG
                      id={`ticket-qr-${ticket.id}`}
                      value={ticket.ticket_id || ticket.token}
                      title={`${ticket.pass} entry ticket QR`}
                      size={192}
                      level="M"
                    />
                  </div>
                  <p className="text-[10px] text-brown/55">Show this QR code once at the festival gate.</p>
                  <button
                    type="button"
                    onClick={() => downloadQr(ticket)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-brown/20 px-3 py-2 text-[11px] font-bold text-brown transition hover:border-orange print:hidden"
                  >
                    <Download size={14} aria-hidden="true" />
                    Download QR (SVG)
                  </button>
                </article>
              ))}
            </div>

            <div className="mt-6 print:hidden">
              <TicketEmailForm
                orderId={orderId}
                emailSent={order.email_sent}
                onSent={() => setOrder((current) => ({ ...current, email_sent: true }))}
              />
            </div>
            <p className="mt-4 text-[11px] leading-5 text-brown/50 print:hidden">
              Anyone with this private link can view these tickets. Do not post or share it publicly.
            </p>
          </>
        )}

        {order?.status !== 'Paid' && (
          <p className="mt-5 rounded-lg bg-offwhite p-3 text-xs text-brown/60">
            Order reference: <code className="break-all">{orderId}</code>
          </p>
        )}
      </div>
    </section>
  );
}
