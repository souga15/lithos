import React, { useEffect, useRef, useState } from 'react';

const ImageSequencePlayer = ({ framePaths, fps = 24 }) => {
  const canvasRef = useRef(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [images, setImages] = useState([]);
  const requestRef = useRef();
  const frameIdxRef = useRef(0);
  const lastDrawTimeRef = useRef(0);

  // Preload images
  useEffect(() => {
    let loaded = 0;
    const imgArray = [];

    const loadImages = async () => {
      framePaths.forEach((src, idx) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
          loaded++;
          setLoadedCount(loaded);
        };
        imgArray[idx] = img;
      });
      setImages(imgArray);
    };

    if (framePaths.length > 0) {
      loadImages();
    }
  }, [framePaths]);

  // Handle window resize
  const resizeCanvas = (canvas, ctx) => {
    const parent = canvas.parentElement;
    if (!parent) return null;
    
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return rect;
  };

  // Animation loop
  useEffect(() => {
    // Wait until 85% of frames are loaded to ensure smooth playback
    if (images.length === 0 || loadedCount < framePaths.length * 0.85) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency
    
    let rect = resizeCanvas(canvas, ctx);
    
    const handleResize = () => {
      rect = resizeCanvas(canvas, ctx);
    };
    window.addEventListener('resize', handleResize);

    const frameDuration = 1000 / fps;

    const drawFrame = (time) => {
      if (time - lastDrawTimeRef.current >= frameDuration && rect) {
        const img = images[frameIdxRef.current];
        if (img && img.complete) {
          // Object-fit: cover math
          const imgRatio = img.width / img.height;
          const canvasRatio = rect.width / rect.height;
          
          let drawWidth, drawHeight, offsetX, offsetY;

          if (imgRatio > canvasRatio) {
            drawHeight = rect.height;
            drawWidth = img.width * (rect.height / img.height);
            offsetX = (rect.width - drawWidth) / 2;
            offsetY = 0;
          } else {
            drawWidth = rect.width;
            drawHeight = img.height * (rect.width / img.width);
            offsetX = 0;
            offsetY = (rect.height - drawHeight) / 2;
          }

          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, rect.width, rect.height);
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        }

        frameIdxRef.current = (frameIdxRef.current + 1) % images.length;
        lastDrawTimeRef.current = time;
      }
      requestRef.current = requestAnimationFrame(drawFrame);
    };

    requestRef.current = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [images, loadedCount, fps, framePaths.length]);

  const isBuffering = loadedCount < framePaths.length * 0.85;

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, backgroundColor: '#000' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          opacity: isBuffering ? 0 : 1,
          transition: 'opacity 1s ease-in-out'
        }}
      />
      
      {/* Loading State */}
      {isBuffering && (
        <div style={{
          position: 'absolute', inset: 0, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '14px',
          background: 'radial-gradient(ellipse at center, #0a1128 0%, #000 100%)',
          zIndex: 10
        }}>
           <div style={{
             width: 44, height: 44, borderRadius: '50%',
             border: '2px solid rgba(0,194,255,0.1)',
             borderTopColor: '#00C2FF',
             animation: 'earth-spin-fallback 0.8s linear infinite',
           }} />
           <p style={{ color: '#00C2FF', fontFamily: '"Inter", monospace', fontSize: '11px', letterSpacing: '0.25em', fontWeight: 600 }}>
             INITIALISING SYSTEMS... {Math.round((loadedCount / framePaths.length) * 100)}%
           </p>
           <style>{`@keyframes earth-spin-fallback { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
};

export default ImageSequencePlayer;
