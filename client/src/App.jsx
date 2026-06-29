import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MobileOnly from './components/MobileOnly';
import GameClientPage from './pages/GameClientPage';
import TermsPage from './pages/TermsPage';
import PlayGatePage from './pages/PlayGatePage';
import SoldOutPage from './pages/SoldOutPage';
import EmailPage from './pages/EmailPage';
import WaitingPage from './pages/WaitingPage';
import PrizePage from './pages/PrizePage';
import AdminGuard from './components/AdminGuard';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminDashboardPage />
            </AdminGuard>
          }
        />
        <Route path="/display" element={<GameClientPage />} />
        <Route
          path="/prize/:sessionId"
          element={
            <MobileOnly>
              <PrizePage />
            </MobileOnly>
          }
        />
        <Route
          path="/play/:sessionId/waiting"
          element={
            <MobileOnly>
              <WaitingPage />
            </MobileOnly>
          }
        />
        <Route
          path="/play/:sessionId/email"
          element={
            <MobileOnly>
              <EmailPage />
            </MobileOnly>
          }
        />
        <Route
          path="/play/:sessionId/terms"
          element={
            <MobileOnly>
              <TermsPage />
            </MobileOnly>
          }
        />
        <Route
          path="/play/:sessionId/sold-out"
          element={
            <MobileOnly>
              <SoldOutPage />
            </MobileOnly>
          }
        />
        <Route
          path="/play/:sessionId"
          element={
            <MobileOnly>
              <PlayGatePage />
            </MobileOnly>
          }
        />
        <Route
          path="/"
          element={
            <MobileOnly>
              <div className="home-placeholder">
                <p>請掃描現場 QR Code 參與活動</p>
              </div>
            </MobileOnly>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
