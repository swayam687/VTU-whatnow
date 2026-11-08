"use client";

import React, { useMemo } from "react";

interface CryptographicAvatarProps {
  usn: string;
  size?: number; // size in px (e.g. 36, 44, 64)
  showSignature?: boolean;
  className?: string;
}

// 32-bit FNV-1a deterministic hash
function hashUsn(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

// Cyberpunk color themes for procedural glyphs
const CYBER_PALETTES = [
  { fg: "#00f0ff", bg: "#04222f", glow: "rgba(0, 240, 255, 0.45)" }, // Cyber Cyan
  { fg: "#06b6d4", bg: "#082f3e", glow: "rgba(6, 182, 212, 0.4)" },  // Electric Aqua
  { fg: "#a855f7", bg: "#250c38", glow: "rgba(168, 85, 247, 0.45)" }, // Neon Amethyst
  { fg: "#10b981", bg: "#052e16", glow: "rgba(16, 185, 129, 0.4)" },  // Matrix Emerald
  { fg: "#f59e0b", bg: "#382305", glow: "rgba(245, 158, 11, 0.4)" },  // Tactical Amber
  { fg: "#38bdf8", bg: "#0c2838", glow: "rgba(56, 189, 248, 0.4)" },  // Deep Sky
];

export default function CryptographicAvatar({
  usn,
  size = 40,
  showSignature = false,
  className = "",
}: CryptographicAvatarProps) {
  const cleanUsn = (usn || "UNKNOWN").trim().toUpperCase();

  const { grid, palette, hexSignature } = useMemo(() => {
    const hash = hashUsn(cleanUsn);
    const paletteIndex = hash % CYBER_PALETTES.length;
    const palette = CYBER_PALETTES[paletteIndex];

    // Generate symmetrical 5x5 matrix using hash bits
    // Column 0 mirrors Column 4, Column 1 mirrors Column 3, Column 2 is center
    const grid: boolean[][] = Array.from({ length: 5 }, () => Array(5).fill(false));
    let bitIndex = 0;

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const bit = ((hash >> bitIndex) & 1) === 1;
        grid[row][col] = bit;
        grid[row][4 - col] = bit; // Mirror symmetry
        bitIndex = (bitIndex + 1) % 28;
      }
    }

    // Hex signature (e.g. "0x7F2A")
    const hex = (hash & 0xffff).toString(16).toUpperCase().padStart(4, "0");

    return { grid, palette, hexSignature: `0x${hex}` };
  }, [cleanUsn]);

  const cellSize = size / 6.5;
  const padding = (size - cellSize * 5) / 2;

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <div
        className="relative rounded-xl overflow-hidden border border-cyan-500/30 flex items-center justify-center transition-all duration-300 group-hover:border-cyan-400 group-hover:shadow-[0_0_12px_rgba(0,240,255,0.25)]"
        style={{
          width: size,
          height: size,
          backgroundColor: palette.bg,
          boxShadow: `inset 0 0 8px ${palette.glow}`,
        }}
        title={`Dossier Fingerprint: ${cleanUsn} [${hexSignature}]`}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="block"
        >
          {grid.map((row, r) =>
            row.map((active, c) => {
              if (!active) return null;
              return (
                <rect
                  key={`${r}-${c}`}
                  x={padding + c * cellSize}
                  y={padding + r * cellSize}
                  width={cellSize * 0.9}
                  height={cellSize * 0.9}
                  rx={cellSize * 0.2}
                  fill={palette.fg}
                  style={{
                    filter: `drop-shadow(0 0 2px ${palette.glow})`,
                  }}
                />
              );
            })
          )}
        </svg>

        {/* Tactical scan corner marks */}
        <span className="absolute top-0.5 left-0.5 w-1 h-1 border-t border-l border-cyan-400/80 pointer-events-none" />
        <span className="absolute top-0.5 right-0.5 w-1 h-1 border-t border-r border-cyan-400/80 pointer-events-none" />
        <span className="absolute bottom-0.5 left-0.5 w-1 h-1 border-b border-l border-cyan-400/80 pointer-events-none" />
        <span className="absolute bottom-0.5 right-0.5 w-1 h-1 border-b border-r border-cyan-400/80 pointer-events-none" />
      </div>

      {showSignature && (
        <span className="mt-1 font-mono text-[9px] tracking-wider text-cyan-400/70 uppercase">
          {hexSignature}
        </span>
      )}
    </div>
  );
}

