import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const TerrainMesh = () => {
  const meshRef = useRef();

  // Create a terrain geometry with noise
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(20, 20, 128, 128);
    const pos = geo.attributes.position;
    
    // Simple sine wave displacement for topography (a more advanced version would use simplex noise)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = Math.sin(x * 0.5) * Math.cos(y * 0.5) * 1.5 + 
                Math.sin(x * 1.5 + y * 2.1) * 0.5;
      pos.setZ(i, z);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: '#222618',      // Base surface color (dark olive)
      roughness: 0.8,
      metalness: 0.1,
      wireframe: true,       // Topological look
      transparent: true,
      opacity: 0.4,
    });

    return { geometry: geo, material: mat };
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.05; // Slow rotation
    }
  });

  return (
    <mesh 
      ref={meshRef} 
      geometry={geometry} 
      material={material} 
      rotation={[-Math.PI / 3, 0, 0]} 
      position={[0, -2, 0]} 
    />
  );
};

const TerrainMapHero = () => {
  return (
    <div className="absolute inset-0 w-full h-full bg-bg z-0 overflow-hidden">
      <Canvas camera={{ position: [0, 5, 10], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} color="#c8f57a" />
        <Environment preset="city" />
        
        <TerrainMesh />
        
        {/* Adds a cool shadow layer to anchor the scene */}
        <ContactShadows resolution={1024} scale={20} blur={2} opacity={0.5} far={10} color="#000000" />
        
        <OrbitControls 
          enableZoom={false} 
          enablePan={false}
          autoRotate={true}
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI / 2.2} 
          minPolarAngle={Math.PI / 4}
        />
      </Canvas>
      
      {/* Vignette overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-bg/40 to-bg pointer-events-none z-10" />
    </div>
  );
};

export default TerrainMapHero;
