"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { sfx } from "../lib/sfx";

export default function CyberNavbar() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [sfxEnabled, setSfxEnabled] = useState(true);

  useEffect(() => {
    // Default is dark (off - clean dark without vintage scanlines)
    const storedTheme = localStorage.getItem("vtu_theme") as "dark" | "light" | null;
    const initialTheme = storedTheme === "light" ? "light" : "dark";
    setTheme(initialTheme);
    applyTheme(initialTheme);

    setSfxEnabled(sfx.isEnabled());
  }, []);

  const applyTheme = (mode: "dark" | "light") => {
    if (typeof document !== "undefined") {
      document.body.classList.remove("theme-dark", "theme-light", "crt-overlay", "crt-bloom");
      document.body.classList.add(mode === "light" ? "theme-light" : "theme-dark");
    }
  };

  const handleToggleTheme = () => {
    sfx.playClick();
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("vtu_theme", nextTheme);
    applyTheme(nextTheme);
  };

  const handleToggleSfx = () => {
    const next = sfx.toggle();
    setSfxEnabled(next);
  };

  return (
    <header className="bg-[#08090a]/95 border-b border-cyan-500/20 sticky top-0 z-40 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Logo and Tactical Tag */}
        <Link
          href="/"
          onClick={() => sfx.playClick()}
          className="flex items-center gap-2.5 sm:gap-3 group select-none"
        >
          <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-950/80 border border-cyan-400/60 text-cyan-400 font-mono font-black text-xs sm:text-sm flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.25)] group-hover:border-cyan-300 transition-all">
            1R
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-base sm:text-lg text-slate-100 tracking-tight">
                VTU <span className="text-cyan-400">WHATNOW</span>
              </span>
              <span className="hidden md:inline-block text-[9px] font-mono uppercase tracking-widest text-cyan-400/90 bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded">
                LIVE
              </span>
            </div>
            <p className="text-[9px] font-mono text-slate-400 hidden xs:block">
              CAMPUS RESULTS &amp; ANALYTICS
            </p>
          </div>
        </Link>

        {/* Tactical Actions (Theme toggle, SFX toggle, Admin Room) */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          {/* Theme Switcher: Dark (Obsidian) vs Light (Clean White) */}
          <button
            type="button"
            onClick={handleToggleTheme}
            title={theme === "dark" ? "Switch to Normal Clean White Theme" : "Switch to Obsidian Dark Theme"}
            className={`px-2.5 py-1.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              theme === "light"
                ? "bg-white border-slate-300 text-slate-800 shadow-sm"
                : "bg-slate-900/90 border-cyan-500/40 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
            }`}
          >
            <span>{theme === "light" ? "☀️" : "🌙"}</span>
            <span className="text-[11px] font-bold">{theme === "light" ? "WHITE" : "DARK"}</span>
          </button>

          {/* Web Audio SFX Toggle */}
          <button
            type="button"
            onClick={handleToggleSfx}
            title={sfxEnabled ? "Mute SFX" : "Enable SFX"}
            className={`p-1.5 sm:p-2 rounded-xl font-mono text-xs font-semibold border transition-all flex items-center gap-1 ${
              sfxEnabled
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                : "bg-slate-900 border-slate-800 text-slate-500"
            }`}
          >
            <span className="text-xs">{sfxEnabled ? "🔊" : "🔇"}</span>
            <span className="hidden sm:inline text-[10px] tracking-wider uppercase font-bold">SFX</span>
          </button>

          {/* Admin Room */}
          <Link
            href="/admin"
            onClick={() => sfx.playSonar()}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-mono font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 rounded-xl shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-all"
          >
            <span>⚡</span>
            <span>ADMIN</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
