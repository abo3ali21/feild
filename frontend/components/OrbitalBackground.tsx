"use client";

import React from "react";
import { motion } from "framer-motion";

export function OrbitalBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#F7F5EE]">
      {/* 1. Ambient Breathing Light Glows (أنوار هادئة بتروح وتيجي باستمرار) */}
      <motion.div
        animate={{
          scale: [1, 1.18, 1],
          opacity: [0.05, 0.11, 0.05],
          x: [0, 40, 0],
          y: [0, -25, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full bg-[#143626] blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1.1, 0.95, 1.1],
          opacity: [0.06, 0.13, 0.06],
          x: [0, -35, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-40 -left-32 w-[580px] h-[580px] rounded-full bg-[#6B8E78] blur-3xl"
      />

      {/* 2. Orbital Arc & Continuously Moving Earth Observation Satellite */}
      <svg
        viewBox="0 0 1440 800"
        fill="none"
        className="w-full h-full opacity-55"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Subtle Topographic / Orbital Rings */}
        <path
          d="M -120 520 Q 720 80 1560 460"
          stroke="#143626"
          strokeOpacity="0.12"
          strokeWidth="1.5"
          strokeDasharray="6 8"
        />
        <path
          d="M -120 620 Q 720 200 1560 560"
          stroke="#143626"
          strokeOpacity="0.07"
          strokeWidth="1"
        />

        {/* Travelling Light Pulse along the Orbital Path */}
        <motion.path
          d="M -120 520 Q 720 80 1560 460"
          stroke="#143626"
          strokeOpacity="0.35"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0.12, pathOffset: 0 }}
          animate={{ pathOffset: [0, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        />

        {/* Moving Satellite Node with Radar Scan Pulse */}
        <motion.g
          initial={{ x: -60, y: 490 }}
          animate={{
            x: [-60, 360, 720, 1080, 1500],
            y: [490, 290, 235, 285, 445],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        >
          {/* Radar Scan Wave */}
          <motion.circle
            r="26"
            stroke="#143626"
            strokeWidth="1.2"
            fill="none"
            animate={{ scale: [0.4, 2.2], opacity: [0.45, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
          />
          {/* Core Glowing Beacon */}
          <circle r="5" fill="#143626" />
          <circle r="10" fill="#143626" fillOpacity="0.15" />
          {/* Satellite Solar Wings */}
          <rect x="-18" y="-2.5" width="10" height="5" rx="1" fill="#143626" fillOpacity="0.75" />
          <rect x="8" y="-2.5" width="10" height="5" rx="1" fill="#143626" fillOpacity="0.75" />
        </motion.g>

        {/* Ground Sensor Pulsing Nodes (Representing Field IoT Telemetry) */}
        {[
          { cx: 340, cy: 610, delay: 0 },
          { cx: 740, cy: 540, delay: 1.2 },
          { cx: 1120, cy: 630, delay: 2.4 },
        ].map((node, idx) => (
          <g key={idx} transform={`translate(${node.cx}, ${node.cy})`}>
            <motion.circle
              r="18"
              stroke="#143626"
              strokeWidth="1"
              fill="none"
              animate={{ scale: [0.5, 2], opacity: [0.35, 0] }}
              transition={{
                duration: 3.5,
                delay: node.delay,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
            <circle r="3" fill="#143626" fillOpacity="0.45" />
          </g>
        ))}
      </svg>
    </div>
  );
}
