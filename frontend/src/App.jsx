import React, { useState, useEffect, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { useLanguage } from "./context/LanguageContext.jsx";
import Toaster from "./components/Toaster.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import Footer from "./components/Footer.jsx";
import FabAssistant from "./components/FabAssistant.jsx";
import MobileTabs from "./components/MobileTabs.jsx";
import ResponsiveTables from "./components/ResponsiveTables.jsx";
import Login from "./pages/Login.jsx";
import Navbar from "./components/Navbar.jsx";
import BackgroundHero from "./components/BackgroundHero.jsx";
import LoginNavbar from "./components/LoginNavbar.jsx";
// Sidebar removed in favor of top navbar menu
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { ROLE_GROUPS } from "./utils/roleAccess.js";
const ImporterForm = React.lazy(() => import("./pages/ImporterForm.jsx"));
const ShipmentForm = React.lazy(() => import("./pages/ShipmentForm.jsx"));
const DeclarationForm = React.lazy(() => import("./pages/DeclarationForm.jsx"));
const Inspection = React.lazy(() => import("./pages/Inspection.jsx"));
const Payment = React.lazy(() => import("./pages/Payment.jsx"));
const PaymentGateway = React.lazy(() => import("./pages/PaymentGateway.jsx"));
const FinanceOfficer = React.lazy(() => import("./pages/FinanceOfficer.jsx"));
const Clearance = React.lazy(() => import("./pages/Clearance.jsx"));
const Performance = React.lazy(() => import("./pages/Performance.jsx"));
const Users = React.lazy(() => import("./pages/Users.jsx"));
const NotificationsAdmin = React.lazy(() => import("./pages/NotificationsAdmin.jsx"));
const Reports = React.lazy(() => import("./pages/Reports.jsx"));
const Profile = React.lazy(() => import("./pages/Profile.jsx"));
const MyTracking = React.lazy(() => import("./pages/MyTracking.jsx"));
const Home = React.lazy(() => import("./pages/Home.jsx"));
const DeclarationsAdmin = React.lazy(() => import("./pages/DeclarationsAdmin.jsx"));
const Devices = React.lazy(() => import("./pages/Devices.jsx"));
const SingleWindow = React.lazy(() => import("./pages/SingleWindow.jsx"));
const SmartAnalytics = React.lazy(() => import("./pages/SmartAnalytics.jsx"));
const DataHealth = React.lazy(() => import("./pages/DataHealth.jsx"));
const Search = React.lazy(() => import("./pages/Search.jsx"));
const Locations = React.lazy(() => import("./pages/Locations.jsx"));
const FileUpload = React.lazy(() => import("./pages/FileUpload2.jsx"));
const AboutUser = React.lazy(() => import("./pages/AboutUser.jsx"));
const UiShowcase = React.lazy(() => import("./pages/UiShowcase.jsx"));

const PUBLIC_PORTAL_PAGES = {
  "/home": {
    title: "Home",
    subtitle: "Portal overview and entry point.",
    summary:
      "Start here to move into the customs portal, find key services, and review the main entry points used by traders and officers.",
    points: [
      "Access the import, tracking, and guidance tools from one place.",
      "Use the login button to enter the authenticated workspace.",
      "Check the portal sections before starting a transaction.",
    ],
  },
  "/importers": {
    title: "Importers",
    subtitle: "Importer services and registration access.",
    summary:
      "Importer services are centered on registration, profile management, shipment follow-up, and customs-facing submissions.",
    points: [
      "Register or update importer details.",
      "Track import activity linked to your account.",
      "Use importer support channels for onboarding help.",
    ],
  },
  "/single-window": {
    title: "Services",
    subtitle: "Single window services and transaction shortcuts.",
    summary:
      "The single window area groups the main clearance workflows used for customs processing and document exchange.",
    points: [
      "Launch e-SAD, manifest, VIN, and T1 workflows.",
      "Move across service modules without leaving the portal.",
      "Keep transaction data in a single operational flow.",
    ],
  },
  "/search": {
    title: "Customs Guide",
    subtitle: "Search tools and procedural guidance.",
    summary:
      "Use the customs guide to look up tariffs, codification help, and tax simulation references before submission.",
    points: [
      "Search customs tariff details.",
      "Review codification lists and filing guidance.",
      "Estimate duties with the tax simulator.",
    ],
  },
  "/reports": {
    title: "Resources",
    subtitle: "Documents, reports, and reference material.",
    summary:
      "Resources collect the supporting documents and reference material used by traders and customs users.",
    points: [
      "Open downloadable forms and reference files.",
      "Review notices, reports, and supporting material.",
      "Use the resource library before filing a request.",
    ],
  },
  "/support/faq": {
    title: "Contact",
    subtitle: "Help desk details and support routes.",
    summary:
      "Contact paths point you toward customs support for login issues, account questions, and portal assistance.",
    points: [
      "Use the help desk for login and access problems.",
      "Use the support email for account and system questions.",
      "Return to sign in once your issue is resolved.",
    ],
  },
};

function GlobalHotkeys() {
  const navigate = useNavigate();
  const { role } = useAuth();
  useEffect(() => {
    const onKey = (e) => {
      try {
        // Ignore when typing in fields
        const tag = (e.target && e.target.tagName || '').toLowerCase();
        const inField = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable;
        if (!inField && e.altKey) {
          const k = e.key.toLowerCase();
          if (k === 'n') {
            e.preventDefault();
            navigate(role === "Importer" || role === "Port Officer" ? "/shipments" : role === "Finance Officer" ? "/finance" : "/declarations-admin");
          }
          if (k === 'f') { e.preventDefault(); navigate('/search'); }
        }
      } catch {}
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, role]);
  return null;
}

function HomeRedirect() {
  const { role } = useAuth();
  const to = role === "Finance Officer" ? "/finance" : "/home";
  return <Navigate to={to} replace />;
}

function ImporterOnboardingGuard() {
  const { token, role, importerId } = useAuth();
  const location = useLocation();

  if (!token || role !== "Importer") return null;
  if (importerId) return null;
  if (location.pathname === "/importers") return null;

  return <Navigate to="/importers" replace />;
}

function ActiveNotificationPanel() {
  const location = useLocation();
  const [item, setItem] = useState(null);

  useEffect(() => {
    let next = location.state?.notification || null;
    if (!next) {
      try {
        const raw = sessionStorage.getItem("active_notification");
        next = raw ? JSON.parse(raw) : null;
      } catch {
        next = null;
      }
    }
    setItem(next);
  }, [location.key, location.pathname, location.state]);

  if (!item) return null;

  const close = () => {
    try {
      sessionStorage.removeItem("active_notification");
    } catch {}
    setItem(null);
  };

  return (
    <div className="active-notification-panel" role="status">
      <div className="active-notification-main">
        <div className="active-notification-title">{item.title || "Notification"}</div>
        <div className="active-notification-message">{item.message || "No message details."}</div>
        <div className="active-notification-meta">
          {[item.type, item.category, item.reference_id].filter(Boolean).join(" | ")}
        </div>
      </div>
      <button type="button" onClick={close} aria-label="Close notification details">
        Close
      </button>
    </div>
  );
}

function ConditionalNavbar() {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) return null;
  if (location.pathname === "/home") return null;
  return <Navbar />;
}

function ConditionalMobileTabs() {
  const location = useLocation();
  if (location.pathname === "/home") return null;
  return <MobileTabs />;
}

function ConditionalFooter() {
  const location = useLocation();
  if (location.pathname === "/home") return null;
  return <Footer />;
}

function PublicPortalPreview({ pageKey, title, subtitle }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const page = PUBLIC_PORTAL_PAGES[pageKey] || {};
  const points = page.points || [];

  return (
    <div className="login-page">
      <BackgroundHero />
      <LoginNavbar />

      <main className="login-page__content">
        <section className="login-card login-card--preview" aria-label={title}>
          <div className="login-card__previewBadge">{title}</div>
          <h1 className="login-card__title">{title}</h1>
          <p className="login-card__subtitle">{subtitle}</p>
          <p className="login-card__previewSummary">{page?.summary}</p>
          <ul className="login-card__previewList">
            {points.map((point) => (
              <li key={point} className="login-card__previewItem">
                {point}
              </li>
            ))}
          </ul>
          <button type="button" className="login-primary" onClick={() => navigate("/")}>
            {t("signIn")}
          </button>
        </section>
      </main>
    </div>
  );
}

function AuthenticatedPortalHome() {
  const navigate = useNavigate();
  const { name, role, logout } = useAuth();
  const { t } = useLanguage();
  const cards = [
    { title: "Importers", body: "Manage importer records and onboarding steps.", to: "/importers" },
    { title: "Declarations", body: "Create and submit customs declarations.", to: "/declarations" },
    { title: "Services", body: "Open the main single-window transaction tools.", to: "/single-window" },
    { title: "Customs Guide", body: "Search tariffs, codification, and process help.", to: "/search" },
    { title: "Resources", body: "Open references, reports, and downloads.", to: "/reports" },
  ];

  return (
    <div className="login-page">
      <BackgroundHero />
      <LoginNavbar />

      <main className="login-page__content">
        <section className="login-card login-card--preview login-card--home" aria-label="Portal home">
          <div className="login-card__previewBadge">Portal Home</div>
          <h1 className="login-card__title">{name ? `Welcome, ${name}` : "Welcome"}</h1>
          <p className="login-card__subtitle">{role || "Authorized user"}</p>
          <p className="login-card__previewSummary">
            This is the authenticated entry point for the customs portal. Use the quick links below to move into your workspace.
          </p>
          <div className="login-card__homeGrid">
            {cards.map((card) => (
              <button key={card.to} type="button" className="login-card__homeTile" onClick={() => navigate(card.to)}>
                <strong>{card.title}</strong>
                <span>{card.body}</span>
              </button>
            ))}
          </div>
          <div className="login-card__homeActions">
            <button type="button" className="login-primary" onClick={() => navigate("/declarations")}>
              Declarations
            </button>
            <button type="button" className="login-primary" onClick={() => navigate("/single-window")}>
              Open workspace
            </button>
            <button type="button" className="login-secondary" onClick={logout}>
              {t("logout")}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function AppContent() {
  const { token, role } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const publicPage = !token ? PUBLIC_PORTAL_PAGES[location.pathname] : null;

  // Reflect current role on the root element for role-based theming
  useEffect(() => {
    try {
      const root = document.documentElement;
      if (token && role) root.setAttribute('data-role', role);
      else root.removeAttribute('data-role');
    } catch {}
  }, [token, role]);

  return publicPage ? (
    <PublicPortalPreview pageKey={location.pathname} title={publicPage.title} subtitle={publicPage.subtitle} />
  ) : !token ? (
    <Login />
  ) : (
    <div className="app-system-shell">
      <ImporterOnboardingGuard />
      <main className="app-main">
        <GlobalHotkeys />
        <Suspense fallback={<div style={{ padding: 16 }}>{t("loading")}</div>}>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/home" element={<AuthenticatedPortalHome />} />
            <Route path="/importers" element={<ProtectedRoute roles={["Super Admin","Admin","Customs Officer","Importer"]} unauthorized={<h3>{t("unauthorized")}</h3>}><ImporterForm /></ProtectedRoute>} />
            <Route path="/shipments" element={<ProtectedRoute roles={ROLE_GROUPS.tracking}><ShipmentForm /></ProtectedRoute>} />
            <Route path="/declarations" element={<ProtectedRoute roles={ROLE_GROUPS.declarationEntry}><DeclarationForm /></ProtectedRoute>} />
            <Route path="/declarations-admin" element={<ProtectedRoute roles={ROLE_GROUPS.declarationReview}><DeclarationsAdmin /></ProtectedRoute>} />
            <Route path="/inspections" element={<ProtectedRoute roles={ROLE_GROUPS.inspections} unauthorized={<h3>{t("unauthorized")}</h3>}><Inspection /></ProtectedRoute>} />
            <Route path="/finance/*" element={<ProtectedRoute roles={ROLE_GROUPS.finance} unauthorized={<h3>{t("unauthorized")}</h3>}><FinanceOfficer /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute roles={ROLE_GROUPS.payments} unauthorized={<h3>{t("unauthorized")}</h3>}><Payment /></ProtectedRoute>} />
            <Route path="/payment-gateway/:provider/:intentId" element={<ProtectedRoute roles={ROLE_GROUPS.payments} unauthorized={<h3>{t("unauthorized")}</h3>}><PaymentGateway /></ProtectedRoute>} />
            <Route path="/devices" element={<ProtectedRoute roles={["Super Admin","Admin","Customs Officer","Port Officer"]}><Devices /></ProtectedRoute>} />
            <Route path="/locations" element={<ProtectedRoute roles={["Super Admin","Admin","Port Officer"]}><Locations /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute roles={["Super Admin","Admin","Importer","Inspector","Clearance Officer","Document Officer","Risk Analyst","Port Officer","Auditor"]}><Search /></ProtectedRoute>} />
            <Route path="/single-window" element={<ProtectedRoute roles={["Super Admin","Admin","Customs Officer","Document Officer","Port Officer"]}><SingleWindow /></ProtectedRoute>} />
            <Route path="/smart-analytics" element={<ProtectedRoute roles={ROLE_GROUPS.analytics}><SmartAnalytics /></ProtectedRoute>} />
            <Route path="/data-health" element={<ProtectedRoute roles={ROLE_GROUPS.admin}><DataHealth /></ProtectedRoute>} />
            <Route path="/my-tracking" element={<ProtectedRoute roles={["Importer"]}><MyTracking /></ProtectedRoute>} />
            <Route path="/clearance" element={<ProtectedRoute roles={ROLE_GROUPS.clearance}><Clearance /></ProtectedRoute>} />
            <Route path="/performance" element={<ProtectedRoute roles={ROLE_GROUPS.operations}><Performance /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={ROLE_GROUPS.users} unauthorized={<h3>{t("unauthorized")}</h3>}><Users /></ProtectedRoute>} />
            <Route path="/about-user" element={<ProtectedRoute roles={ROLE_GROUPS.all}><AboutUser /></ProtectedRoute>} />
            <Route path="/notifications-admin" element={<ProtectedRoute roles={ROLE_GROUPS.notifications} unauthorized={<h3>{t("unauthorized")}</h3>}><NotificationsAdmin /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute roles={ROLE_GROUPS.reports}><Reports /></ProtectedRoute>} />
            <Route path="/file-upload" element={<ProtectedRoute roles={ROLE_GROUPS.documents}><FileUpload /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute roles={ROLE_GROUPS.all}><Profile /></ProtectedRoute>} />
            <Route path="/ui-showcase" element={<ProtectedRoute roles={ROLE_GROUPS.all}><UiShowcase /></ProtectedRoute>} />
            <Route path="/frontend-preview" element={<ProtectedRoute roles={ROLE_GROUPS.all}><UiShowcase /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </main>
      <FabAssistant />
      <ConditionalMobileTabs />
      <ConditionalFooter />
    </div>
  );
}

function AppShell() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <ResponsiveTables />
          <Toaster />
          <CommandPalette />
          <ConditionalNavbar />
          <ActiveNotificationPanel />
          <AppContent />
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppShell />
      </LanguageProvider>
    </AuthProvider>
  );
}
