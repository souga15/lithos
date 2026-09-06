import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

// Lazy load ALL pages so a single broken import doesn't crash the whole app
const Navbar      = React.lazy(() => import('./components/Navbar'));
const Home        = React.lazy(() => import('./pages/Home'));
const Dashboard   = React.lazy(() => import('./pages/Dashboard'));
const SafeRoute   = React.lazy(() => import('./pages/SafeRoute'));
const Forecast    = React.lazy(() => import('./pages/Forecast'));
const Alerts      = React.lazy(() => import('./pages/Alerts'));
const Reports     = React.lazy(() => import('./pages/Reports'));
const Regions     = React.lazy(() => import('./pages/Regions'));
const About       = React.lazy(() => import('./pages/About'));
const EngineerPortal = React.lazy(() => import('./pages/EngineerPortal'));
const OfflineBanner = React.lazy(() => import('./components/OfflineBanner'));
const InstallPrompt = React.lazy(() => import('./components/InstallPrompt'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const PrivacyConsent= React.lazy(() => import('./components/PrivacyConsent'));
const PhoneSensor   = React.lazy(() => import('./pages/PhoneSensor'));
const AdminPortal   = React.lazy(() => import('./pages/AdminPortal'));

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-8">
      {/* Wordmark */}
      <div className="flex flex-col items-center gap-2">
        <div
          className="data-mono text-accent animate-pulse-soft"
          style={{ fontSize: '1.1rem', letterSpacing: '0.35em', fontWeight: 700 }}
        >
          LITHOS
        </div>
        <div className="data-mono text-[10px] text-white/25 uppercase tracking-[0.45em]">
          Initialising Systems
        </div>
      </div>
      {/* Skeleton progress bar */}
      <div className="w-64 flex flex-col gap-2">
        <div className="h-px w-full skeleton rounded" />
        <div className="h-px w-3/4 skeleton rounded opacity-60" />
        <div className="h-px w-1/2 skeleton rounded opacity-30" />
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('LITHOS ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex flex-col justify-center p-10 font-mono"
          style={{ background: '#030008', color: 'var(--risk-red)' }}
        >
          <div className="max-w-3xl mx-auto glass-elevated rounded-lg p-8 space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--risk-red)' }}>
                Component Crashed — {this.props.name || 'Unknown'}
              </span>
            </div>
            <pre
              className="text-[11px] text-white/60 bg-black/40 p-4 rounded overflow-auto"
              style={{ borderColor: 'rgba(255,255,255,0.05)', border: '1px solid' }}
            >
              {this.state.error?.toString()}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <Router>
      <ErrorBoundary name="App Shell">
        <Suspense fallback={<LoadingFallback />}>
          <div className="min-h-screen flex flex-col bg-bg text-white noise-overlay">
            <ErrorBoundary name="Navbar">
              <Navbar alertCount={alertCount} isOffline={isOffline} />
            </ErrorBoundary>
            {isOffline && (
              <ErrorBoundary name="OfflineBanner">
                <OfflineBanner />
              </ErrorBoundary>
            )}
            
            <main className="flex-grow relative overflow-hidden">
              <Routes>
                <Route path="/" element={
                  <ErrorBoundary name="Home Page">
                    <Home setAlertCount={setAlertCount} />
                  </ErrorBoundary>
                } />
                <Route path="/dashboard" element={
                  <ErrorBoundary name="Dashboard Page">
                    <Dashboard />
                  </ErrorBoundary>
                } />
                <Route path="/route" element={
                  <ErrorBoundary name="SafeRoute Page">
                    <SafeRoute />
                  </ErrorBoundary>
                } />
                <Route path="/forecast" element={
                  <ErrorBoundary name="Forecast Page">
                    <Forecast />
                  </ErrorBoundary>
                } />
                <Route path="/alerts" element={
                  <ErrorBoundary name="Alerts Page">
                    <Alerts />
                  </ErrorBoundary>
                } />
                <Route path="/reports" element={
                  <ErrorBoundary name="Reports Page">
                    <Reports />
                  </ErrorBoundary>
                } />
                <Route path="/regions" element={
                  <ErrorBoundary name="Regions Page">
                    <Regions />
                  </ErrorBoundary>
                } />
                <Route path="/about" element={
                  <ErrorBoundary name="About Page">
                    <About />
                  </ErrorBoundary>
                } />
                <Route path="/engineer" element={
                  <ErrorBoundary name="Engineer Portal">
                    <EngineerPortal />
                  </ErrorBoundary>
                } />
                <Route path="/privacy" element={
                  <ErrorBoundary name="Privacy Policy Page">
                    <PrivacyPolicy />
                  </ErrorBoundary>
                } />
                <Route path="/sensor" element={
                  <ErrorBoundary name="Phone Slope Sensor">
                    <PhoneSensor />
                  </ErrorBoundary>
                } />
                <Route path="/admin" element={
                  <ErrorBoundary name="Admin Portal">
                    <AdminPortal />
                  </ErrorBoundary>
                } />
              </Routes>
            </main>
            
{/* 
            <ErrorBoundary name="PrivacyConsent">
              <PrivacyConsent />
            </ErrorBoundary>
            */}
            
            <ErrorBoundary name="InstallPrompt">
              <InstallPrompt />
            </ErrorBoundary>
          </div>
        </Suspense>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
