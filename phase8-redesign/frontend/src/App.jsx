import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import LiveRecon from './pages/LiveRecon';

// Placeholder empty component removed because we import the real Dashboard now function
function AnimatedRoutes() {
  const location = useLocation();
  const [alertCount] = useState(3);
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home alertCount={alertCount} />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/recon" element={<LiveRecon />} />
        {/* We will implement other routes shortly */}
        <Route path="*" element={<div className="p-10 font-display text-4xl">Under Construction</div>} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  const [isOffline] = useState(!navigator.onLine);

  return (
    <Router>
      <div className="flex h-screen w-full bg-bg text-white overflow-hidden selection:bg-accent/30 selection:text-white">
        <Sidebar isOffline={isOffline} alertCount={3} />
        
        <main className="flex-1 relative overflow-auto h-full">
          {/* Main topographic background for entire app content area */}
          <div className="fixed inset-0 pointer-events-none topo-texture opacity-[0.03] mix-blend-screen z-0"></div>
          
          <div className="relative z-10 w-full h-full">
             <AnimatedRoutes />
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
