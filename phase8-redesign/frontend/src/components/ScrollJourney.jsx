import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Activity, ShieldAlert, ArrowDownToLine } from 'lucide-react';

// Define the 3D flight path (representing a dangerous highway through the mountains)
const CURVE_POINTS = [
  new THREE.Vector3(0, 6, 20),      // Start high up, looking at the valley
  new THREE.Vector3(3, 4, 10),      // Swoop right
  new THREE.Vector3(-4, 2.5, 0),    // Swoop left, deep into terrain
  new THREE.Vector3(5, 1.5, -10),   // Banking right, low altitude
  new THREE.Vector3(-2, 1, -20),    // Final critical hazard zone
  new THREE.Vector3(0, 3, -30),     // Look outwards towards safety
];

const curve = new THREE.CatmullRomCurve3(CURVE_POINTS, false, 'centripetal', 0.5);

// The actual terrain grid
export const ScrollTerrainMesh = () => {
  const { geometry, material } = useMemo(() => {
    // Make it much longer in the Z axis to match our flight path
    const geo = new THREE.PlaneGeometry(60, 80, 128, 128);
    const pos = geo.attributes.position;
    
    // Procedural noise to create mountains and valleys
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        // Create a central "valley" or road path where z is lower
        const distanceToCenterSq = (x*x)/50; 
        
        let z = Math.sin(x * 0.2) * Math.cos(y * 0.2) * 3 + 
                Math.sin(x * 0.5 + y * 0.8) * 1.5;
                
        // Push the sides up to form mountains, keep center low
        z += distanceToCenterSq;
        pos.setZ(i, z);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: '#1a1e14',      // Deep terrain dark
      roughness: 0.9,
      metalness: 0.1,
      wireframe: true,       // Topological look
      transparent: true,
      opacity: 0.5,
      emissive: '#0a0d08',
      emissiveIntensity: 0.5
    });

    return { geometry: geo, material: mat };
  }, []);

  return (
    <mesh 
      geometry={geometry} 
      material={material} 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, -2, -5]} 
    />
  );
};

// Draws a glowing line representing the analyzed "route" or highway
export const RouteLine = () => {
  const linePoints = useMemo(() => curve.getPoints(200), []);
  
  return (
    <>
      <Line 
        points={linePoints} 
        color="#c8f57a" 
        lineWidth={3} 
        dashed={true} 
        dashScale={20} 
        dashSize={2} 
        dashOffset={0} 
        opacity={0.4} 
        transparent 
      />
      <Line 
        points={linePoints} 
        color="#c8f57a" 
        lineWidth={10} 
        opacity={0.1} 
        transparent 
      />
    </>
  );
};

// This moves the camera along the curve based on scroll position
export const FlightCamera = () => {
  const scroll = useScroll();

  useFrame((state) => {
    // scroll.offset goes from 0 (top) to 1 (bottom)
    const t = Math.max(0, Math.min(1, scroll.offset)); 
    
    // Get absolute position on curve
    const pos = curve.getPointAt(t);
    
    // Get target point slightly ahead to look at
    const lookAheadT = Math.min(t + 0.05, 1);
    const tangent = curve.getPointAt(lookAheadT);
    
    // Smoothly interpolate the camera position
    state.camera.position.lerp(pos, 0.08); // 0.08 is the lerp factor for smoothness
    
    // Look ahead
    const target = new THREE.Vector3().copy(tangent);
    // Look slightly down at the terrain
    target.y -= 0.5;
    
    // Smoothly interpolate where the camera is looking
    // We use a dummy object to lerp the quaternion for smooth lookats
    const dummy = new THREE.Object3D();
    dummy.position.copy(state.camera.position);
    dummy.lookAt(target);
    state.camera.quaternion.slerp(dummy.quaternion, 0.08);
  });
  return null;
};

// 3D HTML Overlay Component
export const Hotspot = ({ curveT, risk, title, factor, extraOffset = [1.5, 0.5, 0] }) => {
  const pos = useMemo(() => curve.getPointAt(curveT), [curveT]);
  
  const isCritical = risk === 'CRITICAL';
  const color = isCritical ? 'var(--risk-red)' : 'var(--accent)';
  const badgeColors = isCritical 
    ? 'bg-risk-red/10 border-risk-red/30 text-risk-red shadow-glow-red' 
    : 'bg-accent/10 border-accent/30 text-accent shadow-glow-sm';

  return (
    <group position={[pos.x + extraOffset[0], pos.y + extraOffset[1], pos.z + extraOffset[2]]}>
      {/* Visual anchor point on the road */}
      <mesh position={[-extraOffset[0], -extraOffset[1], -extraOffset[2]]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color={isCritical ? '#ff4d4f' : '#c8f57a'} />
      </mesh>
      
      {/* Line connecting marker to HTML card */}
      <Line 
        points={[[0,0,0], [-extraOffset[0], -extraOffset[1], -extraOffset[2]]]}
        color={isCritical ? '#ff4d4f' : '#c8f57a'}
        lineWidth={1}
        transparent
        opacity={0.5}
      />

      <Html distanceFactor={15} transform occlude>
         <div 
            className="glass-elevated p-4 rounded-lg flex flex-col gap-2 w-72 pointer-events-auto transition-transform hover:scale-105"
            style={{ 
              borderLeft: `4px solid ${color}`,
              background: 'rgba(20, 24, 15, 0.85)' // Extra dark for readability
            }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <span className="font-display text-2xl tracking-wide text-white leading-none">{title}</span>
              <span className={`data-mono text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColors}`}>
                {risk}
              </span>
            </div>
            
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between">
                <span className="data-mono text-[10px] text-silver uppercase">Primary Factor</span>
                <span className="data-mono text-xs text-white uppercase">{factor}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="data-mono text-[10px] text-silver uppercase">FoS Computed</span>
                <span className="data-mono text-xs font-bold" style={{ color }}>{(Math.random() * 0.4 + 0.8).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="data-mono text-[10px] text-silver uppercase">72h Rainfall</span>
                <span className="data-mono text-xs text-white">{(Math.random() * 100 + 50).toFixed(0)}mm</span>
              </div>
            </div>

            <button className="w-full mt-2 py-1.5 border border-white/10 rounded flex items-center justify-center gap-2 hover:bg-white/5 transition-colors group">
              <Activity size={12} className="text-silver group-hover:text-accent" />
              <span className="data-mono text-[10px] uppercase text-silver group-hover:text-white mt-px">Run Flow Simulation</span>
            </button>
         </div>
      </Html>
    </group>
  );
};
