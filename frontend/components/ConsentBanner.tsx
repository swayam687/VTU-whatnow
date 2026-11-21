"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { IconShield, IconClose, IconKey } from "./Icons";
import { sfx } from "../lib/sfx";

interface ConsentBannerProps {
  isObsidian?: boolean;
  onOpenAuth?: () => void;
  onOpenPrivacySettings?: () => void;
  isLoggedIn?: boolean;
}

export default function ConsentBanner({
  isObsidian = true,
  onOpenAuth,
  onOpenPrivacySettings,
  isLoggedIn = false,
}: ConsentBannerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem("vtu_disclaimer_accepted");
      if (!accepted) {
        // Small delay so entrance feels smooth and deliberate
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDismiss = () => {
    sfx.playMechanicalClick();
    setIsVisible(false);
    try {
      localStorage.setItem("vtu_disclaimer_accepted", "true");
    } catch {
      // ignore
    }
  };

  const handleManageClick = () => {
    sfx.playMechanicalClick();
    if (isLoggedIn && onOpenPrivacySettings) {
      onOpenPrivacySettings();
    } else if (onOpenAuth) {
      onOpenAuth();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-lg z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div
        className={`p-4 sm:p-5 rounded-2xl border shadow-2xl backdrop-blur-md transition-all ${
          isObsidian
            ? "bg-[#0c0e12]/95 border-cyan-500/30 text-slate-100 shadow-cyan-950/20"
            : "bg-white/95 border-slate-300 text-slate-900 shadow-xl"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
              isObsidian
                ? "bg-cyan-950/50 border-cyan-800/50 text-cyan-400"
                : "bg-blue-50 border-blue-200 text-blue-600"
            }`}
          >
            <IconShield className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                Notice &amp; Student Transparency
              </span>
              <button
                onClick={handleDismiss}
                className="opacity-50 hover:opacity-100 transition-opacity p-0.5 -mr-1 -mt-1 text-xs"
                title="Dismiss"
              >
                <IconClose className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs mt-1.5 leading-relaxed opacity-90">
              VTU WhatNow is a student-run analytics project. Data is sourced from VTU&apos;s public
              results portal. If you want your data hidden, log in with your USN and manage your
              privacy settings.
            </p>

            <div className="mt-3.5 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleDismiss}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400 active:scale-[0.98] ${
                  isObsidian
                    ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                    : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                Got It
              </button>

              <button
                type="button"
                onClick={handleManageClick}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400 ${
                  isObsidian
                    ? "border-slate-800 hover:border-slate-700 bg-white/5 text-slate-200 hover:text-white"
                    : "border-slate-200 hover:bg-slate-100 text-slate-700"
                }`}
              >
                <IconKey className="w-3 h-3 text-cyan-400" />
                <span>{isLoggedIn ? "My Privacy Settings" : "Manage Privacy Settings"}</span>
              </button>

              <Link
                href="/privacy"
                onClick={() => sfx.playMechanicalClick()}
                className="text-[11px] underline opacity-70 hover:opacity-100 ml-auto transition-opacity"
              >
                Privacy Policy &amp; Opt-Out
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
