import { useEffect, useState } from 'react';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { getJson, postJson } from '../api';
import SectionTitle from '../components/SectionTitle';
import TicketDrawer from '../components/TicketDrawer';
import { useSiteContent } from '../siteContent';

const defaultPageContent = {
  eyebrow: 'Ticket engine',
  title: 'Festival marketplace',
  description: 'Choose one or more passes, review your total, and continue in the secure ticket drawer.',
  multi_order_label: 'Build a multi-pass order',
};

export default function MarketplacePage() {
  const [passes, setPasses] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [eventError, setEventError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [initialPassId, setInitialPassId] = useState(null);
  const { content } = useSiteContent();
  const pageContent = content?.marketplace || defaultPageContent;

  useEffect(() => {
    let active = true;

    getJson('/passes')
      .then((availablePasses) => {
        if (active) setPasses(availablePasses);
      })
      .catch(error => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load available passes.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    getJson('/activities')
      .then((activities) => {
        if (!active) return;
        setEvent(activities.find(item => item.is_main_event) || null);
      })
      .catch(error => {
        if (active) {
          setEventError(error instanceof Error ? error.message : 'Unable to load festival event details.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function openTickets(passId = null) {
    setInitialPassId(passId);
    setDrawerOpen(true);
  }

  async function checkout(items, phone) {
    return postJson('/checkout/cart', { items, phone });
  }

  return (
    <>
      <section className="px-4 py-10 sm:px-5 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <SectionTitle eyebrow={pageContent.eyebrow} title={pageContent.title} copy={pageContent.description} />
          {loadError && <p className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{loadError}</p>}
          {eventError && !loadError && <p className="mt-4 text-sm text-brown/60" role="status">Passes are available, but festival event details could not be loaded.</p>}
          {loading ? (
            <p className="mt-8 text-sm text-brown/60" role="status">Loading available passes…</p>
          ) : loadError ? null : passes.length === 0 ? (
            <p className="mt-8 text-sm text-brown/60" role="status">No passes are currently available. Please check back soon.</p>
          ) : (
            <>
              <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
                {passes.map(pass => (
                  <article key={pass.id} className="flex flex-col rounded-xl border border-brown/10 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <ShoppingBag className="text-orange" aria-hidden="true" />
                      <span className="rounded-full bg-green/10 px-3 py-1 text-xs font-bold text-green">{pass.stock} available</span>
                    </div>
                    <h2 className="mt-5 font-display text-xl font-bold sm:mt-7 sm:text-2xl">{pass.name}</h2>
                    <p className="mt-3 flex-1 text-sm leading-6 text-brown/60">{pass.note}</p>
                    <p className="mt-5 font-display text-2xl font-bold sm:mt-6 sm:text-3xl">KSh {pass.price.toLocaleString()}</p>
                    <button
                      type="button"
                      onClick={() => openTickets(pass.id)}
                      disabled={pass.stock <= 0}
                      className="mt-5 flex items-center justify-center gap-2 rounded-md bg-orange px-4 py-2.5 font-bold text-brown transition hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50 sm:mt-6 sm:py-3"
                    >
                      {pass.stock > 0 ? 'Select this pass' : 'Sold out'}{pass.stock > 0 && <ArrowRight size={16} />}
                    </button>
                  </article>
                ))}
              </div>
              <div className="mt-8 flex justify-center">
                <button type="button" onClick={() => openTickets()} className="rounded-md border border-brown/20 px-6 py-3 font-bold text-brown transition hover:border-orange hover:text-orange">
                  {pageContent.multi_order_label}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
      <TicketDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        passes={passes}
        event={event}
        initialPassId={initialPassId}
        onCheckout={checkout}
      />
    </>
  );
}
