"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { sfx } from "../lib/sfx";
import { IconInstallApp, IconKey, IconShield } from "./Icons";
import InstallAppModal from "./InstallAppModal";
import { AuthSession } from "../lib/api";

interface NavbarProps {
  currentView?: "dashboard" | "topology" | "backlogs";
  onSelectView?: (view: "dashboard" | "topology" | "backlogs") => void;
  isObsidian?: boolean;
  onToggleTheme?: () => void;
  studentSession?: AuthSession | null;
  onOpenAuth?: () => void;
  onSignOut?: () => void;
}

export default function Navbar({
  currentView = "dashboard",
  onSelectView,
  isObsidian = true,
  onToggleTheme,
  studentSession,
  onOpenAuth,
  onSignOut,
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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
        {/* Brand Logo */}
        <Link
          href="/"
          onClick={() => sfx.playMechanicalClick()}
          className="flex items-center gap-2 group shrink-0"
        >
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs transition-transform group-hover:scale-105 overflow-hidden relative shrink-0 ${
              isObsidian
                ? "bg-slate-900 border border-white/15 text-white"
                : "bg-slate-900 text-white"
            }`}
          >
            <img
              src="/app-icon.png"
              alt="VTU WhatNow Logo"
              className="w-full h-full object-cover relative z-10"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <svg
              className="w-4 h-4 sm:w-4.5 sm:h-4.5 absolute"
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
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold text-sm sm:text-lg tracking-tight">
                VTU <span className={isObsidian ? "text-cyan-400" : "text-blue-600"}>WhatNow</span>
              </span>
              <span
                className={`hidden md:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
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

        {/* Right Actions: Mobile-first compact cluster */}
        <div className="flex items-center gap-1 sm:gap-2 text-xs shrink-0">
          {/* Download App to Homescreen (hidden on small mobile because bottom bar has it) */}
          <button
            onClick={() => {
              sfx.playMechanicalClick();
              setIsInstallModalOpen(true);
            }}
            title="Download app into homescreen for mobile"
            className={`p-2 rounded-xl border transition-all hidden sm:flex items-center gap-1.5 ${
              isObsidian
                ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
                : "bg-slate-100/80 border-slate-200 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <IconInstallApp className="w-4 h-4 text-cyan-400 stroke-[2.2]" />
            <span className="hidden sm:inline text-[11px] font-medium">Get App</span>
          </button>

          {/* SFX Audio Switch (desktop only to preserve mobile header width) */}
          <button
            onClick={handleToggleMute}
            title={muted ? "Unmute Audio" : "Mute Audio"}
            className={`p-2 rounded-xl border transition-all hidden md:flex items-center gap-1 ${
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
              className={`p-1.5 sm:px-2.5 sm:py-2 rounded-xl border transition-all flex items-center gap-1 shrink-0 ${
                isObsidian
                  ? "bg-slate-900 border-slate-800 text-slate-200 hover:text-white"
                  : "bg-slate-100/80 border-slate-200 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span>{isObsidian ? "🌙" : "☀️"}</span>
              <span className="hidden md:inline text-[11px] font-medium">
                {isObsidian ? "Dark" : "Light"}
              </span>
            </button>
          )}

          {/* Student Auth / Profile Pill */}
          {studentSession ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  sfx.playMechanicalClick();
                  onOpenAuth?.();
                }}
                title={`Signed in as ${studentSession.name} (${studentSession.usn})`}
                className={`flex items-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all shrink-0 ${
                  isObsidian
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono font-bold max-w-[85px] sm:max-w-none truncate">{studentSession.usn}</span>
              </button>
              <button
                onClick={() => {
                  sfx.playMechanicalClick();
                  onSignOut?.();
                }}
                title="Sign Out"
                className={`p-1.5 rounded-xl border text-[10px] sm:text-[11px] transition-all shrink-0 ${
                  isObsidian
                    ? "bg-slate-900 border-slate-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/30"
                    : "bg-slate-100 border-slate-200 text-zinc-600 hover:text-rose-600 hover:border-rose-300"
                }`}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                sfx.playMechanicalClick();
                onOpenAuth?.();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 font-medium text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-[0.98] transition-all shrink-0"
            >
              <IconKey className="w-3.5 h-3.5" />
              <span className="text-[11px] sm:text-xs">Login</span>
            </button>
          )}

          {/* Admin Room Link with clean icon and proper margins */}
          <Link
            href="/admin"
            onClick={() => sfx.playMechanicalClick()}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-2 font-medium text-xs rounded-xl transition-all shadow-xs shrink-0 ${
              isObsidian
                ? "bg-slate-900 hover:bg-slate-800 text-slate-100 border border-white/10"
                : "bg-slate-900 hover:bg-slate-800 text-white"
            }`}
          >
            <IconShield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin</span>
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
