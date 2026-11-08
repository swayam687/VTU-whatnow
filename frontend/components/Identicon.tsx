"use client";

import React, { useMemo } from "react";

interface IdenticonProps {
  usn: string;
  name?: string;
  percentage?: number;
  totalBacklogs?: number;
  size?: number; // pixel width & height
  showFingerprint?: boolean;
  className?: string;
}

/**
 * Deterministic hash algorithm (FNV-1a 32-bit).
 */
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

export default function Identicon({
  usn,
  name,
  percentage,
  totalBacklogs,
  size = 40,
  showFingerprint = false,
  className = "",
}: IdenticonProps) {
  const { grid, colorPrimary, colorBg, hexFingerprint, cyberBadge } = useMemo(() => {
    const cleanUsn = (usn || "UNKNOWN").toUpperCase().trim();
    const hash = hashString(cleanUsn);

    // Color palette based on academic standing & hash entropy
    let colorPrimary = "#06b6d4"; // Cyan by default
    let colorBg = "rgba(6, 182, 212, 0.12)";

    if (percentage !== undefined && percentage >= 80 && (totalBacklogs ?? 0) === 0) {
      colorPrimary = "#f59e0b"; // Gold / Amber for Topper
      colorBg = "rgba(245, 158, 11, 0.16)";
    } else if (totalBacklogs !== undefined && totalBacklogs > 0) {
      colorPrimary = totalBacklogs >= 3 ? "#ef4444" : "#f97316"; // Crimson or Flame for Backlogs
      colorBg = totalBacklogs >= 3 ? "rgba(239, 68, 68, 0.16)" : "rgba(249, 115, 22, 0.14)";
    } else {
      // Branch-based color tones
      const palettes = [
        { primary: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)" },   // Cyan
        { primary: "#10b981", bg: "rgba(16, 185, 129, 0.12)" },  // Emerald
        { primary: "#8b5cf6", bg: "rgba(139, 92, 246, 0.12)" },  // Violet
        { primary: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)" },  // Blue
        { primary: "#14b8a6", bg: "rgba(20, 184, 166, 0.12)" },  // Teal
      ];
      const selected = palettes[hash % palettes.length];
      colorPrimary = selected.primary;
      colorBg = selected.bg;
    }

    // Generate 5x5 symmetrical matrix (3 columns, mirrored)
    const grid: boolean[][] = Array.from({ length: 5 }, () => Array(5).fill(false));
    let bitIndex = 0;

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        const bit = ((hash >> bitIndex) & 1) === 1;
        grid[r][c] = bit;
        grid[r][4 - c] = bit; // Mirror for cybernetic symmetry
        bitIndex = (bitIndex + 1) % 30;
      }
    }

    // ASCII fingerprint & hex signature
    const hexFingerprint = (hash & 0xffff).toString(16).toUpperCase().padStart(4, "0");
    const cyberBadge = cleanUsn.length >= 7 ? cleanUsn.slice(-4) : cleanUsn;

    return { grid, colorPrimary, colorBg, hexFingerprint, cyberBadge };
  }, [usn, percentage, totalBacklogs]);

  const cellSize = size / 6.2;
  const padding = (size - cellSize * 5) / 2;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div
        className="relative flex-shrink-0 rounded-lg overflow-hidden border transition-all duration-300"
        style={{
          width: size,
          height: size,
          backgroundColor: colorBg,
          borderColor: `${colorPrimary}40`,
          boxShadow: `0 0 10px ${colorPrimary}20`,
        }}
        title={`Dossier Crypto-Fingerprint: ${usn} [${hexFingerprint}]`}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="block"
        >
          {grid.map((row, r) =>
            row.map((isActive, c) => {
              if (!isActive) return null;
              return (
                <rect
                  key={`${r}-${c}`}
                  x={padding + c * cellSize}
                  y={padding + r * cellSize}
                  width={cellSize * 0.9}
                  height={cellSize * 0.9}
                  rx={cellSize * 0.15}
                  fill={colorPrimary}
                />
              );
            })
          )}
        </svg>

        {/* Cyber scanline indicator */}
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)",
          }}
        />
      </div>

      {showFingerprint && (
        <div className="font-mono leading-none">
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">
            ID::{cyberBadge}
          </span>
          <span className="block text-[9px] font-mono text-cyan-400 opacity-80">
            0x{hexFingerprint}
          </span>
        </div>
      )}
    </div>
  );
}
