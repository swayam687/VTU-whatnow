"use client";

import React, { useState, useEffect, useRef } from "react";
import { updateStudentAvatar } from "../lib/api";
import { IconClose, IconCheck, IconRotateCcw, IconPencil } from "./Icons";
import { sfx } from "../lib/sfx";

interface PixelAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  usn: string;
  name: string;
  percentage?: number;
  totalBacklogs?: number;
  initialPixelArt?: string;
  onAvatarSaved: (newPixelArt: string) => void;
  isObsidian?: boolean;
}

// Built-in 10x10 pixel art presets
export const PIXEL_PRESETS: { name: string; icon: string; pattern: string }[] = [
  {
    name: "Smiley",
    icon: "😊",
    pattern:
      "0011111100" +
      "0100000010" +
      "1010000101" +
      "1010000101" +
      "1000000001" +
      "1010000101" +
      "1001111001" +
      "1000000001" +
      "0100000010" +
      "0011111100",
  },
  {
    name: "Sad Face",
    icon: "🥺",
    pattern:
      "0011111100" +
      "0100000010" +
      "1010000101" +
      "1010000101" +
      "1000000001" +
      "1001111001" +
      "1010000101" +
      "1000000001" +
      "0100000010" +
      "0011111100",
  },
  {
    name: "Heart",
    icon: "❤️",
    pattern:
      "0000000000" +
      "0110000110" +
      "1111001111" +
      "1111111111" +
      "1111111111" +
      "0111111110" +
      "0011111100" +
      "0001111000" +
      "0000110000" +
      "0000000000",
  },
  {
    name: "Star",
    icon: "⭐️",
    pattern:
      "0000110000" +
      "0000110000" +
      "0111111110" +
      "0011111100" +
      "0001111000" +
      "0011111100" +
      "0110110110" +
      "1100000011" +
      "1000000001" +
      "0000000000",
  },
  {
    name: "Arcade Ghost",
    icon: "👻",
    pattern:
      "0001111000" +
      "0011111100" +
      "0111111110" +
      "0101101110" +
      "0101101110" +
      "0111111110" +
      "0111111110" +
      "0111111110" +
      "0101101101" +
      "0100100101",
  },
  {
    name: "Cat",
    icon: "🐱",
    pattern:
      "0110000110" +
      "1110000111" +
      "1100000011" +
      "1111111111" +
      "1011001101" +
      "1011001101" +
      "1111111111" +
      "0110110110" +
      "0011111100" +
      "0001111000",
  },
  {
    name: "Robot",
    icon: "🤖",
    pattern:
      "0000110000" +
      "0000110000" +
      "0111111110" +
      "1101111011" +
      "1101111011" +
      "0111111110" +
      "0101010110" +
      "0111111110" +
      "0010000100" +
      "0011111100",
  },
  {
    name: "Diamond",
    icon: "💎",
    pattern:
      "0001111000" +
      "0011111100" +
      "0111111110" +
      "1111111111" +
      "0111111110" +
      "0011111100" +
      "0001111000" +
      "0000110000" +
      "0000000000" +
      "0000000000",
  },
  {
    name: "Skull",
    icon: "💀",
    pattern:
      "0011111100" +
      "0111111110" +
      "1111111111" +
      "1011111101" +
      "1001111001" +
      "1111111111" +
      "0110110110" +
      "0011111100" +
      "0010101010" +
      "0011111100",
  },
  {
    name: "Invader",
    icon: "👾",
    pattern:
      "0001111000" +
      "0011111100" +
      "0111111110" +
      "1101111011" +
      "1111111111" +
      "0010110100" +
      "0101001010" +
      "1010000101" +
      "0000000000" +
      "0000000000",
  },
];

export function getGradeColorInfo(percentage?: number, totalBacklogs?: number) {
  if (percentage !== undefined && percentage >= 80 && (totalBacklogs ?? 0) === 0) {
    return {
      name: "Distinction Scholar",
      color: "#f59e0b", // Gold Amber
      bg: "rgba(245, 158, 11, 0.15)",
      badge: "Gold Amber",
    };
  }
  if (totalBacklogs !== undefined && totalBacklogs > 0) {
    return {
      name: "Backlogs Challenge",
      color: totalBacklogs >= 3 ? "#ef4444" : "#f97316", // Crimson or Flame
      bg: totalBacklogs >= 3 ? "rgba(239, 68, 68, 0.15)" : "rgba(249, 115, 22, 0.15)",
      badge: totalBacklogs >= 3 ? "Crimson Red" : "Flame Orange",
    };
  }
  if (percentage !== undefined && percentage >= 75) {
    return {
      name: "First Class Distinction",
      color: "#10b981", // Emerald
      bg: "rgba(16, 185, 129, 0.15)",
      badge: "Emerald Green",
    };
  }
  if (percentage !== undefined && percentage >= 60) {
    return {
      name: "First Class",
      color: "#2563eb", // Royal Cobalt Blue
      bg: "rgba(37, 99, 235, 0.15)",
      badge: "Royal Blue",
    };
  }
  return {
    name: "Second Class",
    color: "#06b6d4", // Cyan
    bg: "rgba(6, 182, 212, 0.15)",
    badge: "Cyber Cyan",
  };
}

export default function PixelAvatarModal({
  isOpen,
  onClose,
  usn,
  name,
  percentage,
  totalBacklogs,
  initialPixelArt,
  onAvatarSaved,
  isObsidian = true,
}: PixelAvatarModalProps) {
  const gradeInfo = getGradeColorInfo(percentage, totalBacklogs);
  const [pixels, setPixels] = useState<boolean[]>(Array(100).fill(false));
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [drawMode, setDrawMode] = useState<boolean>(true); // true = fill, false = erase
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Initialize pixels from initialPixelArt, localStorage, or default preset
  useEffect(() => {
    if (isOpen) {
      setSuccessMsg("");
      setErrorMsg("");
      let pattern = initialPixelArt || "";
      if (!pattern && typeof window !== "undefined") {
        pattern = localStorage.getItem(`vtu_avatar_${usn.toUpperCase()}`) || "";
      }
      if (pattern && pattern.length === 100) {
        setPixels(pattern.split("").map((ch) => ch === "1"));
      } else {
        // Default to Smiley face preset
        setPixels(PIXEL_PRESETS[0].pattern.split("").map((ch) => ch === "1"));
      }
    }
  }, [isOpen, initialPixelArt, usn]);

  if (!isOpen) return null;

  const handleCellClick = (index: number) => {
    sfx.playMechanicalClick();
    setPixels((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleCellMouseEnter = (index: number) => {
    if (isMouseDown) {
      setPixels((prev) => {
        const next = [...prev];
        next[index] = drawMode;
        return next;
      });
    }
  };

  const handleMouseDownOnCell = (index: number) => {
    setIsMouseDown(true);
    const newDrawMode = !pixels[index];
    setDrawMode(newDrawMode);
    setPixels((prev) => {
      const next = [...prev];
      next[index] = newDrawMode;
      return next;
    });
  };

  const handleApplyPreset = (pattern: string) => {
    sfx.playSonar();
    if (pattern.length === 100) {
      setPixels(pattern.split("").map((ch) => ch === "1"));
    }
  };

  const handleClear = () => {
    sfx.playMechanicalClick();
    setPixels(Array(100).fill(false));
  };

  const handleInvert = () => {
    sfx.playMechanicalClick();
    setPixels((prev) => prev.map((val) => !val));
  };

  const handleSave = async () => {
    sfx.playMechanicalClick();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    const patternString = pixels.map((b) => (b ? "1" : "0")).join("");

    try {
      // 1. Save locally for 0ms offline retrieval
      if (typeof window !== "undefined") {
        localStorage.setItem(`vtu_avatar_${usn.toUpperCase()}`, patternString);
        window.dispatchEvent(
          new CustomEvent("vtu:avatar-updated", {
            detail: { usn: usn.toUpperCase(), pixelArt: patternString },
          })
        );
      }

      // 2. Persist to backend database for sync across all students
      await updateStudentAvatar(usn, patternString);
      setSuccessMsg("🎉 Custom avatar saved to your verified student profile!");
      sfx.playSonarChime();
      onAvatarSaved(patternString);
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      console.warn("Avatar save error:", err);
      // Even if network fails, local storage holds the change
      setSuccessMsg("Saved locally on your device!");
      onAvatarSaved(patternString);
      setTimeout(() => {
        onClose();
      }, 900);
    } finally {
      setSaving(false);
    }
  };

  const filledCount = pixels.filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onMouseUp={() => setIsMouseDown(false)}
    >
      <div
        className={`relative max-w-lg w-full rounded-2xl sm:rounded-3xl border shadow-2xl p-4 sm:p-6 space-y-4 my-auto transition-all ${
          isObsidian
            ? "bg-[#0c0e12] border-slate-800 text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-inherit">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center border font-bold text-xs"
              style={{
                backgroundColor: gradeInfo.bg,
                borderColor: `${gradeInfo.color}50`,
                color: gradeInfo.color,
              }}
            >
              10x
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base tracking-tight leading-none">
                Pixel Art Avatar Studio
              </h2>
              <p className="text-[11px] opacity-60 font-mono mt-0.5">
                {usn} • {name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        {/* Grade Color Notice */}
        <div
          className="p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs"
          style={{
            backgroundColor: gradeInfo.bg,
            borderColor: `${gradeInfo.color}40`,
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white/20"
              style={{ backgroundColor: gradeInfo.color }}
            />
            <span className="truncate font-medium">
              Grade Color: <strong style={{ color: gradeInfo.color }}>{gradeInfo.name}</strong> ({gradeInfo.badge})
            </span>
          </div>
          <span className="font-mono text-[10px] opacity-75 shrink-0">
            {filledCount}/100 px
          </span>
        </div>

        {/* Main Canvas + Live Previews */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-1">
          {/* 10x10 Interactive Grid */}
          <div
            className="p-2 rounded-2xl border bg-black/40 border-inherit select-none touch-none"
            onMouseLeave={() => setIsMouseDown(false)}
          >
            <div
              className="grid grid-cols-10 gap-1"
              style={{ width: "240px", height: "240px" }}
            >
              {pixels.map((isFilled, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={() => handleMouseDownOnCell(idx)}
                  onMouseEnter={() => handleCellMouseEnter(idx)}
                  onClick={() => handleCellClick(idx)}
                  className="rounded-xs transition-colors duration-75 focus:outline-none"
                  style={{
                    backgroundColor: isFilled ? gradeInfo.color : "rgba(255, 255, 255, 0.05)",
                    border: isFilled
                      ? `1px solid ${gradeInfo.color}`
                      : "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                  title={`Pixel ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Real-time Previews */}
          <div className="flex sm:flex-col items-center justify-center gap-3">
            <div className="text-center space-y-1">
              <span className="text-[10px] uppercase font-bold opacity-50 block">Preview</span>
              <div
                className="w-14 h-14 rounded-xl border flex items-center justify-center overflow-hidden mx-auto shadow-sm"
                style={{
                  backgroundColor: gradeInfo.bg,
                  borderColor: `${gradeInfo.color}50`,
                }}
              >
                <div className="grid grid-cols-10 gap-[1.5px] w-12 h-12">
                  {pixels.map((isFilled, idx) => (
                    <div
                      key={idx}
                      className="rounded-[0.5px]"
                      style={{
                        backgroundColor: isFilled ? gradeInfo.color : "transparent",
                      }}
                    />
                  ))}
                </div>
              </div>
              <span className="text-[9px] font-mono opacity-50">Profile Size</span>
            </div>

            <div className="text-center space-y-1">
              <div
                className="w-8 h-8 rounded-lg border flex items-center justify-center overflow-hidden mx-auto shadow-xs"
                style={{
                  backgroundColor: gradeInfo.bg,
                  borderColor: `${gradeInfo.color}50`,
                }}
              >
                <div className="grid grid-cols-10 gap-[1px] w-7 h-7">
                  {pixels.map((isFilled, idx) => (
                    <div
                      key={idx}
                      className="rounded-[0.2px]"
                      style={{
                        backgroundColor: isFilled ? gradeInfo.color : "transparent",
                      }}
                    />
                  ))}
                </div>
              </div>
              <span className="text-[9px] font-mono opacity-50">Row Size</span>
            </div>
          </div>
        </div>

        {/* Canvas Tools */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-inherit">
          <span className="text-[11px] opacity-60 font-medium">Tools:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleInvert}
              className="px-2.5 py-1 text-xs rounded-lg border border-inherit hover:bg-white/5 transition-colors font-medium"
            >
              Invert
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1 text-xs rounded-lg border border-inherit text-rose-400 hover:bg-rose-500/10 transition-colors font-medium"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Built-in Presets */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">
              Pick a Preset (1-Tap):
            </label>
            <span className="text-[10px] opacity-50">Click to load &amp; tweak</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {PIXEL_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p.pattern)}
                className="py-1.5 px-1 rounded-xl border border-inherit bg-white/[0.02] hover:bg-white/[0.08] active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5 text-center"
              >
                <span className="text-base">{p.icon}</span>
                <span className="text-[9px] font-semibold truncate w-full">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {successMsg && (
          <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl text-center font-medium">
            {successMsg}
          </p>
        )}
        {errorMsg && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl text-center font-medium">
            {errorMsg}
          </p>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-inherit">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            <IconCheck className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{saving ? "Saving Avatar..." : "Save My Pixel Art"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

