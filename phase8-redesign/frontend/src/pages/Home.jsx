import React from 'react';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { ScrollControls, Environment, ContactShadows, Scroll } from '@react-three/drei';
import { ScrollTerrainMesh, RouteLine, FlightCamera, Hotspot } from '../components/ScrollJourney';
import { ArrowDownToLine } from 'lucide-react';

const Home = ({ alertCount }) => {
  return (
    <motion.div 
      className="relative w-full h-full bg-bg overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Canvas camera={{ position: [0, 8, 25], fov: 60 }} shadows>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} color="#c8f57a" />
        <Environment preset="city" />
        <ContactShadows resolution={1024} scale={50} blur={2} opacity={0.5} far={20} color="#000000" position={[0,-3,0]} />
        
        {/* ScrollControls creates a virtual scroll container. The numbers of pages determines how much scrolling is required. */}
        <ScrollControls pages={4} damping={0.2}>
          
          {/* The Camera Logic */}
          <FlightCamera />

          {/* 3D Scene Assets */}
          <ScrollTerrainMesh />
          <RouteLine />
          
          {/* HTML Data Hotspots placed along the 3D curve (Curve parameter goes 0.0 to 1.0) */}
          <Hotspot curveT={0.15} title="VALLEY ENTRANCE" risk="ELEVATED" factor="High Soil Moisture" extraOffset={[2, 0.5, 0]} />
          <Hotspot curveT={0.45} title="SECTOR 7 SLOPE" risk="CRITICAL" factor="Gouge Saturation" extraOffset={[-2.5, 0.5, 0]} />
          <Hotspot curveT={0.85} title="NH-10 CHOKEPOINT" risk="CRITICAL" factor="Runout Hazard" extraOffset={[2, 0.5, -2]} />

          {/* Fixed Screen-Space HTML Overlay */}
          <Scroll html style={{ width: '100%', height: '100%' }}>
            
            <div className="absolute top-8 left-8 pointer-events-none">
              <motion.div 
                className="flex flex-col"
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <h1 className="font-display text-7xl md:text-9xl leading-none text-white mix-blend-difference select-none pointer-events-auto">
                  SCROLL<br />TO DEPLOY
                </h1>
                <p className="data-mono text-accent text-xs md:text-sm tracking-[0.2em] uppercase mt-4 max-w-sm bg-bg/80 backdrop-blur-md p-3 border-l-2 border-accent pointer-events-auto shadow-glow-sm">
                  Active Flight Path Mode. Scroll down to advance camera through the critical topography route.
                </p>
                <div className="mt-6 flex flex-col items-center w-12 animate-bounce pointer-events-none">
                  <span className="data-mono text-[9px] text-accent mb-2">SCROLL</span>
                  <ArrowDownToLine size={20} className="text-accent" />
                </div>
              </motion.div>
            </div>

            <div className="absolute top-8 right-8 pointer-events-none">
               <motion.div 
                className="glass p-4 rounded-lg flex flex-col gap-2 min-w-[200px] pointer-events-auto"
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <span className="label-micro">Global Status</span>
                  <div className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-risk-red opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-risk-red"></span>
                  </div>
                </div>
                
                <div className="flex flex-col gap-1 mt-1">
                  <span className="data-mono text-2xl font-bold text-risk-red shadow-glow-red">CRITICAL</span>
                  <span className="data-mono text-[10px] text-silver uppercase">2 Active Hotspots</span>
                </div>
              </motion.div>
            </div>

          </Scroll>
        </ScrollControls>

      </Canvas>
      
      {/* Edge vignettes to make the dark UI look dramatic */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_var(--tw-gradient-stops))] from-transparent via-bg/30 to-bg pointer-events-none z-10" />
    </motion.div>
  );
};

export default Home;
