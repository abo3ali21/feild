"use client";

import React, { useEffect, useRef } from "react";
import createGlobe from "cobe";

export function FarmGlobe3D({ lat = 25.6872, lon = 32.6396 }: { lat?: number; lon?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let phi = 0;
    let width = 0;
    let animationFrameId: number;

    const onResize = () => {
      if (canvasRef.current) {
        width = canvasRef.current.offsetWidth;
      }
    };
    window.addEventListener("resize", onResize);
    onResize();

    // Convert coordinates to angles focusing on the farm
    const targetTheta = (lat * Math.PI) / 180;
    const targetPhi = ((-lon - 90) * Math.PI) / 180;

    if (!canvasRef.current) return;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: (width || 260) * 2,
      height: (width || 260) * 2,
      phi: targetPhi,
      theta: targetTheta * 0.6,
      dark: 0,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.96, 0.95, 0.92],      // #F7F5EE Warm Cream
      markerColor: [0.08, 0.21, 0.15],    // #143626 Deep Forest Green
      glowColor: [0.85, 0.89, 0.86],      // Soft Greenish Glow
      markers: [{ location: [lat, lon], size: 0.09 }],
    });

    const animate = () => {
      phi += 0.008;
      const currentWidth = canvasRef.current?.offsetWidth || width || 260;
      globe.update({
        phi: targetPhi + Math.sin(phi) * 0.25,
        width: currentWidth * 2,
        height: currentWidth * 2,
        markers: [{ location: [lat, lon], size: 0.09 }],
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, [lat, lon]);

  return (
    <div className="relative w-full max-w-[260px] aspect-square mx-auto flex items-center justify-center">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", contain: "layout paint size" }}
        className="w-full h-full opacity-95 transition-opacity duration-500"
      />
    </div>
  );
}
