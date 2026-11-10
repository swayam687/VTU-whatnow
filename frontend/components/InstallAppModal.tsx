"use client";

import React, { useEffect, useState } from "react";
import { sfx } from "../lib/sfx";
import { IconClose, IconInstallApp, IconShare, IconPlusSquare, IconCheck } from "./Icons";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  isObsidian?: boolean;
}

export default function InstallAppModal({
  isOpen,
  onClose,
  isObsidian = true,
}: InstallAppModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installedSuccessfully, setInstalledSuccessfully] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isAppleDevice);

    // Detect standalone display mode (already installed)
    const isApp =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isApp);

    // Listen for Android / Chrome PWA install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    const handleAppInstalled = () => {
      setInstalledSuccessfully(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    sfx.playMechanicalClick();
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalledSuccessfully(true);
        setDeferredPrompt(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl border shadow-2xl p-6 transition-all ${
          isObsidian
            ? "bg-[#0c0e12] border-slate-800 text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-white shadow-xs">
              <IconInstallApp className="w-5 h-5 text-white stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">
                Add to Home Screen
              </h3>
              <p className="text-xs opacity-60">
                Install VTU WhatNow on your phone
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sfx.playMechanicalClick();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-4">
          {isStandalone || installedSuccessfully ? (
            <div className="text-center py-6 space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <IconCheck className="w-6 h-6 stroke-[3]" />
              </div>
              <h4 className="font-semibold text-base">App Already Installed!</h4>
              <p className="text-xs opacity-70 max-w-xs mx-auto">
                You can launch VTU WhatNow anytime directly from your phone's home screen.
              </p>
            </div>
          ) : isIOS ? (
            /* iOS Instructions */
            <div className="space-y-3">
              <p className="text-xs opacity-80">
                To install VTU WhatNow on your iPhone or iPad:
              </p>
              <ol className="space-y-2.5 text-xs">
                <li
                  className={`flex items-start gap-3 p-3 rounded-2xl border ${
                    isObsidian
                      ? "bg-slate-900/60 border-slate-800"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <IconShare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold">1. Tap the Share icon</span>
                    <p className="text-[11px] opacity-60">
                      Located in the bottom menu bar of Safari.
                    </p>
                  </div>
                </li>

                <li
                  className={`flex items-start gap-3 p-3 rounded-2xl border ${
                    isObsidian
                      ? "bg-slate-900/60 border-slate-800"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <IconPlusSquare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold">2. Select &ldquo;Add to Home Screen&rdquo;</span>
                    <p className="text-[11px] opacity-60">
                      Scroll down in the share sheet to find this option.
                    </p>
                  </div>
                </li>

                <li
                  className={`flex items-start gap-3 p-3 rounded-2xl border ${
                    isObsidian
                      ? "bg-slate-900/60 border-slate-800"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0 font-bold text-xs">
                    3
                  </div>
                  <div>
                    <span className="font-semibold">3. Tap &ldquo;Add&rdquo;</span>
                    <p className="text-[11px] opacity-60">
                      Top right corner to confirm and enjoy instant full-screen access!
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          ) : (
            /* Android / Chrome Instructions */
            <div className="space-y-4">
              <p className="text-xs opacity-80">
                Install as a lightweight native web app for offline caching, 1-tap launch, and instant VTU marks explorer.
              </p>

              {deferredPrompt ? (
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3 px-4 rounded-xl font-medium text-sm bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-xs flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                >
                  <IconInstallApp className="w-4 h-4 stroke-[2.5]" />
                  <span>Install App to Home Screen</span>
                </button>
              ) : (
                <div
                  className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                    isObsidian
                      ? "bg-slate-900/60 border-slate-800"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-blue-400">
                    <span>📱 How to install from browser:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 opacity-80 text-[11px]">
                    <li>Tap the <strong>⋮ (three dots menu)</strong> in Chrome/Edge</li>
                    <li>Tap <strong>&ldquo;Install app&rdquo;</strong> or <strong>&ldquo;Add to Home screen&rdquo;</strong></li>
                    <li>Confirm to pin VTU WhatNow to your phone</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800/40 flex justify-end">
          <button
            onClick={() => {
              sfx.playMechanicalClick();
              onClose();
            }}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
              isObsidian
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
            }`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

