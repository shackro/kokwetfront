import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, Minus, Plus, Ticket, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatEventDateTime } from '../features/home/eventFormatting';
import { getJson } from '../api';
import TicketEmailForm from './TicketEmailForm';

const formatPrice = amount => `KSh ${Number(amount).toLocaleString()}`;

export default function TicketDrawer({ isOpen, onClose, passes, event, initialPassId, onCheckout }) {
  const [quantities, setQuantities] = useState({});
  const [phone, setPhone] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(() => {
    const savedOrderId = sessionStorage.getItem('kokwet-ticket-order-id');
    return savedOrderId ? { order_id: savedOrderId, status: 'Payment pending' } : null;
  });
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const processingRef = useRef(processing);
  onCloseRef.current = onClose;
  processingRef.current = processing;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    const handleKeyDown = event => {
      if (event.key === 'Escape' && !processingRef.current) onCloseRef.current();
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setQuantities(initialPassId ? { [initialPassId]: 1 } : {});
    setError('');
  }, [isOpen, initialPassId]);

  useEffect(() => {
    if (order?.order_id) sessionStorage.setItem('kokwet-ticket-order-id', order.order_id);
    else sessionStorage.removeItem('kokwet-ticket-order-id');
  }, [order?.order_id]);

  useEffect(() => {
    if (!isOpen || !order?.order_id || order.status !== 'Payment pending') return undefined;
    let active = true;
    async function refreshOrder() {
      try {
        const latest = await getJson(`/v1/tickets/orders/${encodeURIComponent(order.order_id)}`);
        if (active) setOrder(latest);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to check payment status.');
      }
    }
    void refreshOrder();
    const timer = window.setInterval(() => void refreshOrder(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isOpen, order?.order_id, order?.status]);

  const totalTickets = useMemo(
    () => Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0),
    [quantities],
  );
  const totalPrice = useMemo(
    () => passes.reduce((sum, pass) => sum + pass.price * (quantities[pass.id] || 0), 0),
    [passes, quantities],
  );

  function updateQuantity(pass, delta) {
    setError('');
    setQuantities(current => {
      const next = Math.max(0, Math.min(pass.stock, (current[pass.id] || 0) + delta));
      return { ...current, [pass.id]: next };
    });
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }

    const items = passes
      .filter(pass => quantities[pass.id] > 0)
      .map(pass => ({ pass_id: pass.id, quantity: quantities[pass.id] }));
    if (!items.length) {
      setError('Choose at least one available pass to continue.');
      return;
    }

    setError('');
    setProcessing(true);
    try {
      setOrder(await onCheckout(items, phone));
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to initialize checkout.');
    } finally {
      setProcessing(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="ticket-drawer-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !processing) onClose();
      }}
    >
      <section
        ref={panelRef}
        className="ticket-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-drawer-title"
        tabIndex="-1"
      >
        <div className="ticket-drawer-handle" aria-hidden="true"><span /></div>
        <header className="ticket-drawer-header">
          <div>
            <p className="ticket-drawer-eyebrow">Kokwet Festival · Ticket selection</p>
            <h2 id="ticket-drawer-title">{event?.title || 'Choose your festival pass'}</h2>
            {event && (
              <p className="ticket-drawer-event">
                <Clock3 size={14} aria-hidden="true" />
                {formatEventDateTime(event.date)} · {event.venue}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} disabled={processing} className="ticket-drawer-close" aria-label="Close ticket selection">
            <X size={20} />
          </button>
        </header>

        {order ? (
          <div className="ticket-drawer-success" role="status">
            <Ticket size={34} aria-hidden="true" />
            <p className="ticket-drawer-eyebrow">Kokwet Festival · Ticket payment</p>
            <h3>{order.status === 'Paid' ? 'Payment confirmed' : order.status === 'Payment pending' ? 'Approve the M-Pesa prompt' : order.status === 'Expired' ? 'Reservation expired' : order.status === 'Payment cancelled' ? 'Payment was cancelled' : order.status === 'Payment failed' ? 'Payment was not completed' : 'Payment needs support'}</h3>
            <p>
              {order.status === 'Paid'
                ? 'Your paid admission tickets are ready. Open or export them below; each QR code is valid for one gate scan.'
                : order.status === 'Payment pending'
                  ? `A KSh ${Number(order.total || totalPrice).toLocaleString()} M-Pesa prompt was sent to your phone. This reservation expires in 10 minutes; tickets appear after verified payment.`
                  : order.status === 'Expired'
                    ? 'This unpaid reservation expired and the passes returned to availability.'
                    : order.status === 'Payment cancelled'
                      ? 'The M-Pesa prompt was cancelled. No ticket was issued, and the passes returned to availability.'
                      : order.status === 'Payment failed'
                      ? 'No ticket was issued. You can start a new checkout.'
                      : 'We could not confirm the payment state. Do not retry if you received an M-Pesa prompt; contact support with the order reference below.'}
            </p>
            {order.status !== 'Paid' && <p className="text-xs text-brown/55">Order reference: <code>{order.order_id}</code></p>}
            {error && <p role="alert" className="ticket-drawer-error">{error}</p>}
            <div className="ticket-drawer-tokens">
              {order.tickets?.map(ticket => (
                <div key={ticket.token}>
                  <span>{ticket.pass}</span>
                  <QRCodeSVG value={ticket.ticket_id || ticket.token} title={`${ticket.pass} entry ticket QR`} size={160} level="M"/>
                  <code>{ticket.token}</code>
                </div>
              ))}
            </div>
            {order.status === 'Paid' && (
              <>
                <Link
                  to={`/tickets/${encodeURIComponent(order.order_id)}`}
                  onClick={onClose}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-green px-4 py-3 text-xs font-bold uppercase tracking-wide text-green transition hover:bg-green hover:text-white"
                >
                  Open tickets on this website
                </Link>
                <TicketEmailForm
                  orderId={order.order_id}
                  emailSent={order.email_sent}
                  onSent={() => setOrder(current => ({ ...current, email_sent: true }))}
                />
              </>
            )}
            <button
              type="button"
              onClick={() => {
                if (order.status !== 'Payment pending') setOrder(null);
                onClose();
              }}
              className="ticket-drawer-primary"
            >
              {order.status === 'Payment pending' ? 'Close and check later' : 'Start another order'}
            </button>
          </div>
        ) : (
          <>
            <form id="ticket-drawer-form" className="ticket-drawer-content" onSubmit={submitOrder}>
              {passes.length ? passes.map(pass => {
                const quantity = quantities[pass.id] || 0;
                const soldOut = pass.stock <= 0;
                return (
                  <article className={`ticket-tier ${soldOut ? 'is-sold-out' : ''}`} key={pass.id}>
                    <div className="ticket-tier-details">
                      <div>
                        <h3>{pass.name}</h3>
                        <p>{pass.note}</p>
                      </div>
                      <div className="ticket-tier-price">
                        <strong>{formatPrice(pass.price)}</strong>
                        <span>{soldOut ? 'Sold out' : `${pass.stock} available`}</span>
                      </div>
                    </div>
                    {!soldOut && (
                      <div className="ticket-tier-controls" aria-label={`${pass.name} quantity`}>
                        <button type="button" onClick={() => updateQuantity(pass, -1)} disabled={quantity === 0} aria-label={`Remove one ${pass.name}`}>
                          <Minus size={15} />
                        </button>
                        <output aria-live="polite" aria-label={`${quantity} ${pass.name} tickets`}>{quantity}</output>
                        <button type="button" onClick={() => updateQuantity(pass, 1)} disabled={quantity >= pass.stock} aria-label={`Add one ${pass.name}`}>
                          <Plus size={15} />
                        </button>
                      </div>
                    )}
                  </article>
                );
              }) : (
                <p className="ticket-drawer-empty">Passes are currently unavailable. Please try again shortly.</p>
              )}
              <label className="ticket-drawer-phone">
                M-Pesa mobile number
                <input
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  pattern="(?:\+254|254|0)7\d{8}"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  placeholder="0712345678"
                  aria-describedby="ticket-drawer-payment-note"
                />
              </label>
              <p id="ticket-drawer-payment-note" className="ticket-drawer-note">
                Secure checkout sends an M-Pesa STK prompt. Passes are reserved for 10 minutes and tickets are issued only after payment confirmation.
              </p>
            </form>

            <footer className="ticket-drawer-footer">
              <div className="ticket-drawer-total">
                <span>{totalTickets} {totalTickets === 1 ? 'pass' : 'passes'}</span>
                <strong>{formatPrice(totalPrice)}</strong>
              </div>
              {error && <p className="ticket-drawer-error" role="alert">{error}</p>}
              <button
                type="submit"
                form="ticket-drawer-form"
                className="ticket-drawer-primary"
                disabled={!totalTickets || processing || !passes.length}
              >
                {processing ? 'Sending M-Pesa prompt…' : 'Pay with M-Pesa'}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
