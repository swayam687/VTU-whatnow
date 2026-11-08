"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { sfx } from "../lib/sfx";

export default function CyberNavbar() {
  const [crtEnabled, setCrtEnabled] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(true);

  useEffect(() => {
    // Restore CRT setting
    const storedCrt = localStorage.getItem("vtu_crt_scanlines");
    if (storedCrt === "true") {
      setCrtEnabled(true);
      document.body.classList.add("crt-overlay", "crt-bloom");
    }
    setSfxEnabled(sfx.isEnabled());
  }, []);

  const handleToggleCrt = () => {
    sfx.playClick();
    const next = !crtEnabled;
    setCrtEnabled(next);
    localStorage.setItem("vtu_crt_scanlines", String(next));
    if (next) {
      document.body.classList.add("crt-overlay", "crt-bloom");
    } else {
      document.body.classList.remove("crt-overlay", "crt-bloom");
    }
  };

  const handleToggleSfx = () => {
    const next = sfx.toggle();
    setSfxEnabled(next);
  };

  return (
    <header className="bg-[#08090a]/90 border-b border-cyan-500/20 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo and Tactical Tag */}
        <Link
          href="/"
          onClick={() => sfx.playClick()}
          className="flex items-center gap-3 group select-none"
        >
          <div className="relative w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-400/60 text-cyan-400 font-mono font-black text-sm flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.3)] group-hover:border-cyan-300 group-hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] transition-all">
            1R
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-lg text-slate-100 tracking-tight">
                VTU <span className="text-cyan-400">WHATNOW</span>
              </span>
              <span className="hidden sm:inline-block text-[9px] font-mono uppercase tracking-widest text-cyan-400/90 bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded">
                GOD VIEW // V2.0
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 hidden xs:block">
              SURVEILLANCE &amp; RESULTS NETWORK
            </p>
          </div>
        </Link>

        {/* Tactical Actions (CRT toggle, SFX toggle, Admin Room) */}
        <nav className="flex items-center gap-2 sm:gap-2.5">
          {/* CRT Scanline Toggle */}
          <button
            type="button"
            onClick={handleToggleCrt}
            title={crtEnabled ? "Disable Vintage CRT Scanlines" : "Enable Vintage CRT Scanlines"}
            className={`px-2.5 py-1.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              crtEnabled
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.35)]"
                : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="hidden md:inline">CRT:</span>
            <span>{crtEnabled ? "ON" : "OFF"}</span>
          </button>

          {/* Web Audio SFX Toggle */}
          <button
            type="button"
            onClick={handleToggleSfx}
            title={sfxEnabled ? "Mute Cybernetic SFX" : "Enable Cybernetic SFX"}
            className={`p-2 rounded-xl font-mono text-xs font-semibold border transition-all flex items-center gap-1 ${
              sfxEnabled
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                : "bg-slate-900/80 border-slate-800 text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className="text-xs">{sfxEnabled ? "🔊" : "🔇"}</span>
            <span className="hidden lg:inline text-[10px] tracking-wider uppercase">SFX</span>
          </button>

          {/* Dashboard link */}
          <Link
            href="/"
            onClick={() => sfx.playClick()}
            className="px-3 py-1.5 text-xs font-mono font-semibold text-slate-300 hover:text-cyan-300 rounded-xl hover:bg-slate-900/80 transition-colors"
          >
            TERMINAL
          </Link>

          {/* Admin Room */}
          <Link
            href="/admin"
            onClick={() => sfx.playSonar()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 rounded-xl shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all"
          >
            <span className="text-xs">⚡</span>
            <span>ADMIN</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
