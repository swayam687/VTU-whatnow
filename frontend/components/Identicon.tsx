"use client";

import React, { useMemo, useState, useEffect } from "react";
import { IconPencil } from "./Icons";

interface IdenticonProps {
  usn: string;
  name?: string;
  percentage?: number;
  totalBacklogs?: number;
  size?: number; // pixel width & height
  showFingerprint?: boolean;
  className?: string;
  customPixelArt?: string | null;
  isEditable?: boolean;
  onEditClick?: () => void;
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
  customPixelArt,
  isEditable = false,
  onEditClick,
}: IdenticonProps) {
  const cleanUsn = (usn || "UNKNOWN").toUpperCase().trim();
  const [localPixelArt, setLocalPixelArt] = useState<string | null>(customPixelArt || null);

  // Sync with prop or local storage
  useEffect(() => {
    if (customPixelArt !== undefined) {
      setLocalPixelArt(customPixelArt);
    } else if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`vtu_avatar_${cleanUsn}`);
      if (saved) setLocalPixelArt(saved);
    }
  }, [customPixelArt, cleanUsn]);

  // Listen to cross-component live avatar updates
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ usn: string; pixelArt: string }>;
      if (customEvent.detail?.usn === cleanUsn) {
        setLocalPixelArt(customEvent.detail.pixelArt);
      }
    };
    window.addEventListener("vtu:avatar-updated", handleUpdate);
    return () => window.removeEventListener("vtu:avatar-updated", handleUpdate);
  }, [cleanUsn]);

  const { defaultGrid, colorPrimary, colorBg, hexFingerprint, cyberBadge } = useMemo(() => {
    const hash = hashString(cleanUsn);

    // Color palette based on academic standing & grade
    let colorPrimary = "#06b6d4"; // Cyan by default
    let colorBg = "rgba(6, 182, 212, 0.12)";

    if (percentage !== undefined && percentage >= 80 && (totalBacklogs ?? 0) === 0) {
      colorPrimary = "#f59e0b"; // Gold / Amber for Topper
      colorBg = "rgba(245, 158, 11, 0.16)";
    } else if (totalBacklogs !== undefined && totalBacklogs > 0) {
      colorPrimary = totalBacklogs >= 3 ? "#ef4444" : "#f97316"; // Crimson or Flame for Backlogs
      colorBg = totalBacklogs >= 3 ? "rgba(239, 68, 68, 0.16)" : "rgba(249, 115, 22, 0.14)";
    } else if (percentage !== undefined && percentage >= 75) {
      colorPrimary = "#10b981"; // Emerald
      colorBg = "rgba(16, 185, 129, 0.14)";
    } else if (percentage !== undefined && percentage >= 60) {
      colorPrimary = "#2563eb"; // Royal Cobalt Blue
      colorBg = "rgba(37, 99, 235, 0.14)";
    } else {
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

    // Default 5x5 symmetrical matrix (3 columns, mirrored)
    const defaultGrid: boolean[][] = Array.from({ length: 5 }, () => Array(5).fill(false));
    let bitIndex = 0;

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        const bit = ((hash >> bitIndex) & 1) === 1;
        defaultGrid[r][c] = bit;
        defaultGrid[r][4 - c] = bit; // Mirror for cybernetic symmetry
        bitIndex = (bitIndex + 1) % 30;
      }
    }

    const hexFingerprint = (hash & 0xffff).toString(16).toUpperCase().padStart(4, "0");
    const cyberBadge = cleanUsn.length >= 7 ? cleanUsn.slice(-4) : cleanUsn;

    return { defaultGrid, colorPrimary, colorBg, hexFingerprint, cyberBadge };
  }, [cleanUsn, percentage, totalBacklogs]);

  // Determine if using custom 10x10 pixel art or default 5x5
  const hasCustomArt = Boolean(localPixelArt && localPixelArt.length === 100);

  const padding = size * 0.08;
  const usableSize = size - padding * 2;
  const gridSize = hasCustomArt ? 10 : 5;
  const cellSize = usableSize / gridSize;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div
        onClick={isEditable ? onEditClick : undefined}
        className={`relative flex-shrink-0 rounded-xl overflow-hidden border transition-all duration-200 group ${
          isEditable ? "cursor-pointer hover:scale-105 active:scale-95 hover:border-white/50" : ""
        }`}
        style={{
          width: size,
          height: size,
          backgroundColor: colorBg,
          borderColor: `${colorPrimary}50`,
          boxShadow: `0 0 12px ${colorPrimary}15`,
        }}
        title={isEditable ? "Click to customize your pixel art avatar" : `Student: ${usn}`}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="block"
        >
          {hasCustomArt
            ? // Render 10x10 custom pixel art
              Array.from({ length: 10 }).map((_, r) =>
                Array.from({ length: 10 }).map((__, c) => {
                  const idx = r * 10 + c;
                  const isFilled = localPixelArt![idx] === "1";
                  if (!isFilled) return null;
                  return (
                    <rect
                      key={`px-${r}-${c}`}
                      x={padding + c * cellSize + cellSize * 0.05}
                      y={padding + r * cellSize + cellSize * 0.05}
                      width={cellSize * 0.9}
                      height={cellSize * 0.9}
                      rx={cellSize * 0.2}
                      fill={colorPrimary}
                    />
                  );
                })
              )
            : // Render 5x5 default hash matrix
              defaultGrid.map((row, r) =>
                row.map((isActive, c) => {
                  if (!isActive) return null;
                  return (
                    <rect
                      key={`hash-${r}-${c}`}
                      x={padding + c * cellSize + cellSize * 0.05}
                      y={padding + r * cellSize + cellSize * 0.05}
                      width={cellSize * 0.9}
                      height={cellSize * 0.9}
                      rx={cellSize * 0.2}
                      fill={colorPrimary}
                    />
                  );
                })
              )}
        </svg>

        {/* Scanline texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)",
          }}
        />

        {/* Edit Hover Overlay for logged-in student */}
        {isEditable && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
            <IconPencil className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {showFingerprint && (
        <div className="font-mono leading-none">
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">
            ID::{cyberBadge}
          </span>
          <span className="block text-[9px] font-mono opacity-80" style={{ color: colorPrimary }}>
            0x{hexFingerprint}
          </span>
        </div>
      )}
    </div>
  );
}
