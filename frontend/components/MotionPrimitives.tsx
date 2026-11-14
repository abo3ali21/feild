"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";

// 1. Ambient Organic Background with Topographic Contours and Floating Blobs
export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#F7F5EE]"
    >
      {/* Subtle Organic Floating Blob 1 */}
      <motion.div
        animate={{
          x: [0, 60, -40, 0],
          y: [0, -80, 50, 0],
          scale: [1, 1.15, 0.95, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          position: "absolute",
          top: "-10%",
          left: "15%",
          width: "55vw",
          height: "55vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(20, 54, 38, 0.035) 0%, rgba(20, 54, 38, 0) 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Subtle Organic Floating Blob 2 */}
      <motion.div
        animate={{
          x: [0, -70, 50, 0],
          y: [0, 70, -60, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          position: "absolute",
          bottom: "-15%",
          right: "10%",
          width: "60vw",
          height: "60vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(143, 168, 147, 0.065) 0%, rgba(143, 168, 147, 0) 70%)",
          filter: "blur(70px)",
        }}
      />

      {/* Topographic Contour Lines SVG (Gentle slow drift) */}
      <motion.svg
        animate={{
          opacity: [0.35, 0.48, 0.35],
          scale: [1, 1.02, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-0 h-full w-full object-cover"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        fill="none"
        stroke="#143626"
        strokeWidth="0.75"
        strokeOpacity="0.06"
      >
        <path d="M-100,120 C300,180 500,-20 850,90 C1200,200 1350,50 1600,130" />
        <path d="M-120,240 C280,310 520,120 880,210 C1240,300 1380,180 1620,250" />
        <path d="M-90,380 C320,440 560,260 920,350 C1280,440 1400,320 1640,390" />
        <path d="M-110,520 C340,580 600,410 960,490 C1320,570 1420,470 1660,530" />
        <path d="M-80,660 C360,720 640,550 1000,630 C1360,710 1440,610 1680,670" />
        <path d="M-100,800 C380,860 680,690 1040,770 C1400,850 1460,750 1700,810" />
      </motion.svg>
    </div>
  );
}

// 2. Global Mouse Spotlight Overlay
export function MouseSpotlight() {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      setCoords({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  if (!coords) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
      style={{
        background: `radial-gradient(650px circle at ${coords.x}px ${coords.y}px, rgba(20, 54, 38, 0.045), transparent 80%)`,
      }}
    />
  );
}

// 3. Interactive 3D Tilt Card with Soft Specular Sheen
interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function TiltCard({
  children,
  className = "",
  maxTilt = 3.5,
  style,
  onClick,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [sheenCoords, setSheenCoords] = useState<{ x: number; y: number; opacity: number }>({
    x: 0,
    y: 0,
    opacity: 0,
  });

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 22, stiffness: 220 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [maxTilt, -maxTilt]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-maxTilt, maxTilt]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseFromCenterX = e.clientX - rect.left - width / 2;
    const mouseFromCenterY = e.clientY - rect.top - height / 2;

    mouseX.set(mouseFromCenterX / width);
    mouseY.set(mouseFromCenterY / height);

    setSheenCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setSheenCoords((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <motion.div
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: 1000,
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        ...style,
      }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className={`relative overflow-hidden ${className}`}
    >
      {children}
      {/* Specular sheen reflection */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: sheenCoords.opacity,
          background: `radial-gradient(400px circle at ${sheenCoords.x}px ${sheenCoords.y}px, rgba(255, 255, 255, 0.45), transparent 75%)`,
        }}
      />
    </motion.div>
  );
}

// 4. Wizard Step Transition Wrapper
export function StepTransition({
  stepKey,
  children,
}: {
  stepKey: string | number;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// 5. Interactive Magnetic & Tactile Button Wrapper
export function TactileButton({
  children,
  className = "",
  onClick,
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ y: -1.5, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.button>
  );
}
