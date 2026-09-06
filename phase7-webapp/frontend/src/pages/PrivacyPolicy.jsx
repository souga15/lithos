import React from 'react';
import { Shield, Lock, Eye, Globe, Database, MapPin } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-bg text-white pb-20 pt-10 px-6">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header Section */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-accent/10 border border-accent/20 mb-4 animate-pulse-slow">
            <Shield className="w-10 h-10 text-accent" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-blue-100 to-accent bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="text-white/50 text-sm font-medium uppercase tracking-widest">
            Last Updated: March 19, 2026
          </p>
        </section>

        {/* Introduction */}
        <div className="glass p-8 rounded-3xl border border-white/10 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -mr-32 -mt-32" />
          <p className="text-lg text-white/80 leading-relaxed">
            LITHOS is committed to protecting the privacy and safety of our users. This policy outlines how we handle data within the Landslide Integrated Topographic Hazard Operating System.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Section 1: Data Collection */}
          <div className="glass p-6 rounded-2xl border border-white/5 hover:border-accent/30 transition-all group">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-6 h-6 text-accent group-hover:scale-110 transition-transform" />
              <h2 className="text-xl font-bold">Data Collection</h2>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              LITHOS primarily processes environmental and topographic data. We do not require account registration or collect personal identifiable information (PII) such as names, emails, or phone numbers.
            </p>
          </div>

          {/* Section 2: Real-Time Monitoring */}
          <div className="glass p-6 rounded-2xl border border-white/5 hover:border-accent/30 transition-all group">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-6 h-6 text-accent group-hover:scale-110 transition-transform" />
              <h2 className="text-xl font-bold">Satellite & Weather</h2>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              We utilize real-time feeds from <strong>Google Earth Engine (Sentinel-1 SAR)</strong> and <strong>Open-Meteo API</strong>. This data is processed to generate landslide risk assessments and is not linked to individual user activity.
            </p>
          </div>

          {/* Section 3: Location Services */}
          <div className="glass p-6 rounded-2xl border border-white/5 hover:border-accent/30 transition-all group">
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="w-6 h-6 text-accent group-hover:scale-110 transition-transform" />
              <h2 className="text-xl font-bold">Location Usage</h2>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Features like "Locate Me" and "Safe Route Finder" process your GPS coordinates <strong>locally on your device</strong>. LITHOS does not store your movement history on our servers.
            </p>
          </div>

          {/* Section 4: News & Reports */}
          <div className="glass p-6 rounded-2xl border border-white/5 hover:border-accent/30 transition-all group">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="w-6 h-6 text-accent group-hover:scale-110 transition-transform" />
              <h2 className="text-xl font-bold">Transparency</h2>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Community reports are sourced from authenticated news feeds and public RSS streams. User-submitted reports are treated as public safety information and are shared within the proximity network.
            </p>
          </div>

        </div>

        {/* Security Section */}
        <section className="bg-white/5 rounded-3xl p-8 border border-white/10 text-center space-y-4">
          <Lock className="w-8 h-8 text-risk-green mx-auto mb-2" />
          <h2 className="text-2xl font-bold">Security Commitment</h2>
          <p className="text-white/60 max-w-2xl mx-auto">
            We use industry-standard encryption for all data transmissions between your device and our backend monitoring systems. Your safety and data integrity are our highest priorities.
          </p>
        </section>

        {/* Contact info footer for the page */}
        <div className="text-center pt-10 border-t border-white/10">
          <p className="text-white/40 text-xs">
            For further inquiries regarding LITHOS data processing, please contact the development team within the LITHOS Engineer Portal.
          </p>
        </div>

      </div>
    </div>
  );
};

export default PrivacyPolicy;
