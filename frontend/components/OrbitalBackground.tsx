"use client";

import React, { useEffect } from "react";
import { motion, useMotionValue, useSpring, useMotionTemplate } from "framer-motion";

export function OrbitalBackground() {
  // 1. Direct cursor coordinates for the soft light glow
  const mouseX = useMotionValue(-300);
  const mouseY = useMotionValue(-300);

  // 2. Heavy-damped spring coordinates so the satellite glides slowly & smoothly behind the mouse
  const satX = useSpring(mouseX, { stiffness: 18, damping: 28, mass: 2.2 });
  const satY = useSpring(mouseY, { stiffness: 18, damping: 28, mass: 2.2 });

  useEffect(() => {
    // Initialize near top-right/center before first mouse move
    mouseX.set(window.innerWidth * 0.65);
    mouseY.set(window.innerHeight * 0.3);

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  // Continuous soft light halo around the cursor
  const cursorLight = useMotionTemplate`radial-gradient(380px circle at ${mouseX}px ${mouseY}px, rgba(20, 54, 38, 0.085), rgba(143, 168, 147, 0.04) 45%, transparent 75%)`;

  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#F7F5EE]">
      {/* 1. Continuous Soft Light Glow on Cursor */}
      <motion.div
        className="absolute inset-0"
        style={{ background: cursorLight }}
      />

      {/* 2. Subtle Orbital Arc Decoration */}
      <svg
        viewBox="0 0 1440 800"
        fill="none"
        className="w-full h-full opacity-35"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          d="M -120 520 Q 720 80 1560 460"
          stroke="#143626"
          strokeOpacity="0.12"
          strokeWidth="1.2"
          strokeDasharray="6 8"
        />
      </svg>

      {/* 3. Slow, Gentle Satellite Gliding Behind the Cursor */}
      <motion.div
        style={{
          x: satX,
          y: satY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        className="fixed top-0 left-0 will-change-transform"
      >
        <div className="relative flex items-center justify-center">
          {/* Gentle Radar Pulse */}
          <motion.div
            animate={{ scale: [0.6, 2.2], opacity: [0.35, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeOut" }}
            className="absolute w-12 h-12 rounded-full border border-[#143626]/40"
          />
          {/* Satellite Icon (Forest Green #143626) */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 36 36"
            fill="none"
            className="text-[#143626] opacity-75 drop-shadow-sm"
          >
            {/* Solar Panels */}
            <rect x="2" y="14" width="9" height="8" rx="1.5" fill="currentColor" fillOpacity="0.8" />
            <rect x="25" y="14" width="9" height="8" rx="1.5" fill="currentColor" fillOpacity="0.8" />
            {/* Connector Arms */}
            <line x1="11" y1="18" x2="14" y2="18" stroke="currentColor" strokeWidth="1.8" />
            <line x1="22" y1="18" x2="25" y2="18" stroke="currentColor" strokeWidth="1.8" />
            {/* Center Core */}
            <rect x="14" y="13" width="8" height="10" rx="2" fill="currentColor" />
            {/* Signal Dish */}
            <path d="M15 24 Q18 28 21 24" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      </motion.div>
    </div>
  );
}
