"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { sfx } from "../lib/sfx";

interface NavbarProps {
  currentView?: "dashboard" | "topology" | "backlogs";
  onSelectView?: (view: "dashboard" | "topology" | "backlogs") => void;
  isObsidian?: boolean;
  onToggleTheme?: () => void;
}

export default function Navbar({
  currentView = "dashboard",
  onSelectView,
  isObsidian = true,
  onToggleTheme,
}: NavbarProps) {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(sfx.isMuted);
  }, []);

  const handleToggleMute = () => {
    const isNowMuted = sfx.toggleMute();
    setMuted(isNowMuted);
  };

  return (
    <header
      className={`border-b sticky top-0 z-40 backdrop-blur-md transition-colors duration-300 ${
        isObsidian
          ? "bg-[#08090a]/90 border-slate-800/80 text-white"
          : "bg-white/95 border-slate-200 text-slate-900 shadow-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          href="/"
          onClick={() => sfx.playMechanicalClick()}
          className="flex items-center gap-2.5 font-mono"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 font-black text-sm flex items-center justify-center shadow-lg shadow-cyan-500/20">
            1R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-lg tracking-tight">
                VTU <span className="text-cyan-400">WhatNow</span>
              </span>
              <span
                className={`hidden md:inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                  isObsidian
                    ? "bg-slate-900 text-cyan-400 border-cyan-800/60"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                GOD::VIEW v2.0
              </span>
            </div>
            <p className="hidden sm:block text-[10px] font-mono opacity-50 -mt-0.5">
              Campus Intelligence &amp; Topology Matrix
            </p>
          </div>
        </Link>

        {/* View Switcher Tabs (If on homepage) */}
        {onSelectView && (
          <nav className="hidden lg:flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs font-mono">
            <button
              onClick={() => {
                sfx.playMechanicalClick();
                onSelectView("dashboard");
              }}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                currentView === "dashboard"
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              📊 Results Table
            </button>
            <button
              onClick={() => {
                sfx.playSonarChime();
                onSelectView("topology");
              }}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                currentView === "topology"
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              🕸️ Network Topology
            </button>
            <button
              onClick={() => {
                sfx.playMechanicalClick();
                onSelectView("backlogs");
              }}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                currentView === "backlogs"
                  ? "bg-rose-500 text-white font-bold shadow-sm shadow-rose-500/30"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              💀 Backlog Graveyard
            </button>
          </nav>
        )}

        {/* Right Actions: Theme Toggle + SFX Mute + Admin Link */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {/* SFX Haptic Audio Switch */}
          <button
            onClick={handleToggleMute}
            title={muted ? "Unmute Tactical SFX" : "Mute Tactical SFX"}
            className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 ${
              isObsidian
                ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
                : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>{muted ? "🔇" : "🔊"}</span>
            <span className="hidden sm:inline text-[10px] uppercase font-bold">
              {muted ? "Mute" : "SFX"}
            </span>
          </button>

          {/* Theme Mode Toggle: Obsidian vs White Paper */}
          {onToggleTheme && (
            <button
              onClick={() => {
                sfx.playMechanicalClick();
                onToggleTheme();
              }}
              title="Toggle Obsidian Terminal / White Paper Mode"
              className={`px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                isObsidian
                  ? "bg-slate-900 border-cyan-800/80 text-cyan-400 hover:border-cyan-600 shadow-sm shadow-cyan-500/10"
                  : "bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200"
              }`}
            >
              <span>{isObsidian ? "⬡" : "📄"}</span>
              <span className="text-[10px] uppercase font-black tracking-wider">
                {isObsidian ? "Obsidian" : "Paper"}
              </span>
            </button>
          )}

          {/* Admin Room Link */}
          <Link
            href="/admin"
            onClick={() => sfx.playMechanicalClick()}
            className="flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white hover:from-cyan-600 hover:to-blue-600 transition-all border border-slate-700 shadow-sm"
          >
            <span>⚡</span>
            <span className="text-xs">Admin</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
