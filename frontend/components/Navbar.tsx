"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { sfx } from "../lib/sfx";
import { IconInstallApp } from "./Icons";
import InstallAppModal from "./InstallAppModal";

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
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  useEffect(() => {
    setMuted(sfx.isMuted);
  }, []);

  const handleToggleMute = () => {
    const isNowMuted = sfx.toggleMute();
    setMuted(isNowMuted);
  };

  return (
    <header
      className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors ${
        isObsidian
          ? "bg-[#08090a]/90 border-slate-800/80 text-white"
          : "bg-white/90 border-slate-200/80 text-slate-900 shadow-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <Link
          href="/"
          onClick={() => sfx.playMechanicalClick()}
          className="flex items-center gap-2.5 group"
        >
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm transition-transform group-hover:scale-105 ${
              isObsidian
                ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 shadow-cyan-500/20"
                : "bg-blue-600 text-white"
            }`}
          >
            <svg
              className="w-4 h-4 sm:w-4.5 sm:h-4.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
                d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-tight">
                VTU <span className={isObsidian ? "text-cyan-400" : "text-blue-600"}>WhatNow</span>
              </span>
              <span
                className={`hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  isObsidian
                    ? "bg-slate-900 text-slate-300 border-slate-800"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                Results Explorer
              </span>
            </div>
            <p className="hidden md:block text-[11px] opacity-60 -mt-0.5">
              Semester marks, leaderboards &amp; subject analytics
            </p>
          </div>
        </Link>

        {/* View Switcher Tabs (Desktop) */}
        {onSelectView && (
          <nav
            className={`hidden lg:flex items-center gap-1 p-1 rounded-2xl border text-xs font-medium ${
              isObsidian
                ? "bg-slate-900/70 border-slate-800"
                : "bg-slate-100/80 border-slate-200/80"
            }`}
          >
            <button
              onClick={() => {
                sfx.playMechanicalClick();
                onSelectView("dashboard");
              }}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                currentView === "dashboard"
                  ? isObsidian
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                    : "bg-white text-slate-900 font-bold shadow-sm"
                  : isObsidian
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Results
            </button>
            <button
              onClick={() => {
                sfx.playSonarChime();
                onSelectView("topology");
              }}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                currentView === "topology"
                  ? isObsidian
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                    : "bg-white text-slate-900 font-bold shadow-sm"
                  : isObsidian
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Campus Graph
            </button>
            <button
              onClick={() => {
                sfx.playMechanicalClick();
                onSelectView("backlogs");
              }}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                currentView === "backlogs"
                  ? "bg-rose-500 text-white font-bold shadow-sm"
                  : isObsidian
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Subject Analytics
            </button>
          </nav>
        )}

        {/* Right Actions: Download App to Homescreen + Theme Toggle + SFX Mute + Admin Link */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs">
          {/* Download App to Homescreen for Mobile */}
          <button
            onClick={() => {
              sfx.playMechanicalClick();
              setIsInstallModalOpen(true);
            }}
            title="Download app into homescreen for mobile"
            className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 ${
              isObsidian
                ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
                : "bg-slate-100/80 border-slate-200 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <IconInstallApp className="w-4 h-4 text-cyan-400 stroke-[2.2]" />
            <span className="hidden sm:inline text-[11px] font-medium">Get App</span>
          </button>

          {/* SFX Audio Switch */}
          <button
            onClick={handleToggleMute}
            title={muted ? "Unmute Audio" : "Mute Audio"}
            className={`p-2 rounded-xl border transition-all flex items-center gap-1 ${
              isObsidian
                ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
                : "bg-slate-100/80 border-slate-200 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>{muted ? "🔇" : "🔊"}</span>
            <span className="hidden md:inline text-[11px] font-medium">
              {muted ? "Muted" : "Sound"}
            </span>
          </button>

          {/* Theme Mode Toggle: Light vs Dark */}
          {onToggleTheme && (
            <button
              onClick={() => {
                sfx.playMechanicalClick();
                onToggleTheme();
              }}
              title="Toggle Light / Dark theme"
              className={`px-2.5 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${
                isObsidian
                  ? "bg-slate-900 border-slate-800 text-slate-200 hover:text-white"
                  : "bg-slate-100/80 border-slate-200 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span>{isObsidian ? "🌙" : "☀️"}</span>
              <span className="hidden sm:inline text-[11px] font-medium">
                {isObsidian ? "Dark" : "Light"}
              </span>
            </button>
          )}

          {/* Admin Room Link */}
          <Link
            href="/admin"
            onClick={() => sfx.playMechanicalClick()}
            className={`flex items-center gap-1 px-3 py-2 font-semibold text-xs rounded-xl transition-all shadow-sm ${
              isObsidian
                ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                : "bg-slate-900 hover:bg-slate-800 text-white"
            }`}
          >
            <span>Admin</span>
          </Link>
        </div>
      </div>

      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        isObsidian={isObsidian}
      />
    </header>
  );
}
