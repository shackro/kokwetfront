import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  Compass,
  Heart,
  Home,
  Map,
  Menu,
  MessageCircle,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import KokwetLogo from '../components/KokwetLogo';
import { useSiteContent } from '../siteContent';
import { resolveMediaUrl } from '../api';

const defaultNavigation = [
  { path: '/', label: 'Home', is_active: true },
  { path: '/culture', label: 'Voice Circle', is_active: true },
  { path: '/impact', label: 'Impact', is_active: true },
  { path: '/roadmap', label: 'Roadmap', is_active: true },
  { path: '/services', label: 'Community', is_active: true },
];

const navigationIcons = {
  '/': Home,
  '/culture': MessageCircle,
  '/impact': Heart,
  '/roadmap': Map,
  '/services': Users,
  '/marketplace': ShoppingBag,
};

function NavigationIcon({ path, ...props }) {
  const Icon = navigationIcons[path] || Compass;
  return <Icon aria-hidden="true" {...props} />;
}

export default function SiteLayout({ children, staffHost = false }) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef(null);
  const { content } = useSiteContent();
  const settings = content?.settings;
  const nav = (settings?.navigation || defaultNavigation)
    .filter(({ path }) => path !== '/live')
    .map((link) => (link.path === '/culture' ? { ...link, label: 'Voice Circle' } : link));
  const whatsappUrl = `https://wa.me/${settings?.whatsapp_number || '254700000000'}?text=${encodeURIComponent(settings?.whatsapp_message || 'Hello Kokwet Festival, I would like to know more.')}`;

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!drawerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (staffHost) return <main className="min-h-screen">{children}</main>;

  const activeNavigation = nav.filter((link) => link.is_active);

  return (
    <div className="flex min-h-screen flex-col bg-offwhite pt-16">
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/15 bg-brown/95 text-white backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-5">
          <Link to="/" className="flex shrink-0 items-center" aria-label="Kokwet Festival home">
            <KokwetLogo
              variant="wordmark"
              tone="light"
              src={resolveMediaUrl(settings?.logo_wordmark_light_url)}
              className="w-28 sm:w-32"
            />
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-2 lg:flex">
            {activeNavigation.map(({ path, label }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => `group inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] transition ${
                  isActive
                    ? 'bg-white/10 text-orange'
                    : 'text-white/75 hover:bg-white/5 hover:text-white'
                }`}
              >
                <NavigationIcon
                  path={path}
                  size={14}
                  className="transition-transform group-hover:scale-110"
                />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2.5">
            <Link
              to="/marketplace"
              className="hidden items-center gap-2 rounded-sm bg-orange px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-brown transition hover:bg-gold lg:flex"
            >
              {settings?.marketplace_button_label || 'Get a pass'}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="grid h-9 w-9 place-items-center rounded-full border border-green bg-green text-white transition hover:bg-gold hover:text-brown"
              aria-label="Contact Kokwet on WhatsApp"
            >
              <MessageCircle size={18} aria-hidden="true" />
            </a>
            <button
              onClick={() => setOpen(!open)}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/40 transition hover:border-orange hover:text-orange"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="site-menu"
            >
              {open ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]">
          <aside
            ref={drawerRef}
            id="site-menu"
            className="site-menu-drawer ml-auto flex h-full w-[min(22rem,88vw)] flex-col border-l border-orange/30 bg-brown px-6 pb-8 pt-5 text-white shadow-2xl"
            aria-label="Site menu"
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-orange">Kokwet Festival</p>
                <span className="mt-1 block font-display text-lg font-semibold uppercase tracking-[.12em]">
                  Explore Kokwet
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/30 transition hover:border-orange hover:text-orange"
                aria-label="Close menu"
              >
                <X size={19} />
              </button>
            </div>

            <nav aria-label="Explore pages" className="mt-5 flex-1 space-y-2 overflow-y-auto">
              {activeNavigation.map(({ path, label }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => `group flex items-center justify-between rounded-xl border px-3 py-3.5 transition ${
                    isActive
                      ? 'border-orange/40 bg-orange/10 text-orange'
                      : 'border-white/10 text-white/80 hover:border-white/25 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3.5">
                    <span className="grid h-10 w-10 place-items-center rounded-lg border border-orange/25 bg-orange/10 text-orange transition group-hover:bg-orange group-hover:text-brown">
                      <NavigationIcon path={path} size={19} />
                    </span>
                    <span className="text-sm font-semibold tracking-wide">{label}</span>
                  </span>
                  <ChevronRight size={17} className="text-white/40 transition group-hover:translate-x-0.5 group-hover:text-orange" aria-hidden="true" />
                </NavLink>
              ))}

              <NavLink
                to="/marketplace"
                onClick={() => setOpen(false)}
                className={({ isActive }) => `group flex items-center justify-between rounded-xl border px-3 py-3.5 transition ${
                  isActive
                    ? 'border-orange/40 bg-orange/10 text-orange'
                    : 'border-white/10 text-white/80 hover:border-white/25 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-orange/25 bg-orange/10 text-orange transition group-hover:bg-orange group-hover:text-brown">
                    <NavigationIcon path="/marketplace" size={19} />
                  </span>
                  <span className="text-sm font-semibold tracking-wide">
                    {settings?.marketplace_navigation_label || 'Marketplace'}
                  </span>
                </span>
                <ChevronRight size={17} className="text-white/40 transition group-hover:translate-x-0.5 group-hover:text-orange" aria-hidden="true" />
              </NavLink>
            </nav>

            <Link
              to="/marketplace"
              onClick={() => setOpen(false)}
              className="mt-5 flex items-center justify-center gap-2 rounded-sm bg-orange px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-brown transition hover:bg-gold"
            >
              {settings?.marketplace_button_label || 'Get a pass'}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </aside>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="bg-brown px-5 py-12 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              to="/"
              className="inline-flex rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange"
              aria-label="Kokwet Festival home"
            >
              <KokwetLogo
                tone="light"
                src={resolveMediaUrl(settings?.logo_full_light_url)}
                className="w-52 sm:w-60"
              />
            </Link>
            <p className="mt-3 max-w-md text-sm text-white/60">
              {settings?.footer_tagline || 'One people. Many houses. A digital home for shared culture and a future built together.'}
            </p>
          </div>
          <p className="flex items-center gap-3 text-xs text-white/50">
            <span>{settings?.footer_copyright || '© 2026 Kokwet Festival · Culture Meets the Future'}</span>
            <Link to="/login" className="font-bold text-white/70 hover:text-orange">
              Staff access
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
