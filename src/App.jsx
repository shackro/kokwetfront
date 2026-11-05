import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import SiteLayout from './layout/SiteLayout';
import CultureHubPage from './pages/CultureHubPage';
import HomePage from './pages/HomePage';
import ImpactPage from './pages/ImpactPage';
import MarketplacePage from './pages/MarketplacePage';
import RoadmapPage from './pages/RoadmapPage';
import ServicesPage from './pages/ServicesPage';
import StaffPage from './pages/StaffPage';
import StaffActivationPage from './pages/StaffActivationPage';
import { SiteContentProvider } from './siteContent';

const TicketAccessPage = lazy(() => import('./pages/TicketAccessPage'));

function LiveSessionRedirect() {
  const { sessionId } = useParams();
  return <Navigate to={`/culture?session_id=${encodeURIComponent(sessionId || '')}&open_chat=1#live-lounge`} replace/>;
}

export default function App() {
  const isStaffHost = window.location.hostname.toLowerCase().startsWith('staff.');
  return (
    <SiteContentProvider>
      <SiteLayout staffHost={isStaffHost}>
        <Routes>
          <Route path="/" element={isStaffHost ? <StaffPage /> : <HomePage />} />
          <Route path="/admin/artists" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<StaffPage />} />
          <Route path="/dashboard" element={<StaffPage />} />
          <Route path="/staff" element={<Navigate to="/dashboard" replace />} />
          <Route path="/activate" element={<StaffActivationPage />} />
          <Route path="/houses" element={<Navigate to="/culture#nine-houses" replace />} />
          <Route path="/culture" element={<CultureHubPage />} />
          <Route path="/impact" element={<ImpactPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/live" element={<Navigate to="/culture?open_chat=1#live-lounge" replace/>} />
          <Route path="/live/:sessionId" element={<LiveSessionRedirect/>} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route
            path="/tickets/:orderId"
            element={(
              <Suspense fallback={<p className="px-5 py-16 text-center text-sm text-brown/60">Loading your ticket wallet…</p>}>
                <TicketAccessPage />
              </Suspense>
            )}
          />
        </Routes>
      </SiteLayout>
    </SiteContentProvider>
  );
}
