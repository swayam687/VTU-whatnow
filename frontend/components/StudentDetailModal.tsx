"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Student, AuthSession } from "../lib/api";
import {
  IconClose,
  IconCompare,
  IconPencil,
  IconWifiOff,
  IconKey,
  IconGitHub,
  IconLinkedIn,
  IconRotateCcw,
  IconShield,
  IconArrowLeft,
  IconArrowRight,
} from "./Icons";
import Identicon from "./Identicon";
import RescrapeRequestModal from "./RescrapeRequestModal";
import PrivacySettingsModal from "./PrivacySettingsModal";
import { sfx } from "../lib/sfx";

export interface OriginRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CharScramble {
  char: string;
  isLocked: boolean;
}

/**
 * Custom hook that scrambles a USN character-by-character sequentially:
 * - Digits step sequentially: 0 -> 1, 0 -> 1 -> 2, 0 -> ... -> 5, etc.
 * - Letters step sequentially: A -> B -> ... -> R, A -> ... -> M, etc.
 * - Staggered locking takes exactly 2.0s (2000ms).
 */
function useSequentialUSNScramble(targetUsn: string | null, isActive: boolean) {
  const [displayChars, setDisplayChars] = useState<CharScramble[]>([]);
  const [isScrambleComplete, setIsScrambleComplete] = useState(false);

  useEffect(() => {
    if (!isActive || !targetUsn) {
      setDisplayChars([]);
      setIsScrambleComplete(false);
      return;
    }

    const cleanUsn = targetUsn.trim().toUpperCase();
    const len = cleanUsn.length;
    const TOTAL_MS = 1300; // 1.3 seconds (within 1.2 to 1.5s range)

    // Build the natural progression sequence for each character
    const charSequences: string[][] = [];
    const lockTimes: number[] = [];

    for (let i = 0; i < len; i++) {
      const ch = cleanUsn[i];
      let seq: string[] = [];

      if (ch >= "0" && ch <= "9") {
        const targetDigit = parseInt(ch, 10);
        if (targetDigit === 0) {
          seq = ["7", "8", "9", "0"];
        } else {
          for (let d = 0; d <= targetDigit; d++) {
            seq.push(String(d));
          }
        }
      } else if (ch >= "A" && ch <= "Z") {
        const targetCode = ch.charCodeAt(0);
        if (ch === "A") {
          seq = ["Y", "Z", "A"];
        } else {
          for (let code = 65; code <= targetCode; code++) {
            seq.push(String.fromCharCode(code));
          }
        }
      } else {
        seq = [ch];
      }

      charSequences.push(seq);

      // Stagger lock times from 250ms up to 1250ms so positions resolve smoothly
      const minLock = 250;
      const maxLock = 1250;
      const lockT = len <= 1 ? TOTAL_MS : minLock + (i / (len - 1)) * (maxLock - minLock);
      lockTimes.push(lockT);
    }

    // Set initial frame
    setDisplayChars(charSequences.map((seq) => ({ char: seq[0], isLocked: false })));
    setIsScrambleComplete(false);

    const startTime = performance.now();
    let animId: number;
    let lastTick = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;

      // Throttle updates to ~28ms for fast and smooth stepping
      if (now - lastTick >= 28 || elapsed >= TOTAL_MS) {
        lastTick = now;

        const nextChars: CharScramble[] = [];
        let allLocked = true;

        for (let i = 0; i < len; i++) {
          const isLocked = elapsed >= lockTimes[i];
          if (isLocked) {
            nextChars.push({ char: cleanUsn[i], isLocked: true });
          } else {
            allLocked = false;
            const seq = charSequences[i];
            const progress = Math.max(0, Math.min(1, elapsed / lockTimes[i]));
            const seqIdx = Math.min(seq.length - 1, Math.floor(progress * seq.length));
            nextChars.push({ char: seq[seqIdx], isLocked: false });
          }
        }

        setDisplayChars(nextChars);

        if (elapsed >= TOTAL_MS || allLocked) {
          setIsScrambleComplete(true);
          sfx.playSonarChime();
          return;
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [targetUsn, isActive]);

  return { displayChars, isScrambleComplete };
}

interface StudentDetailModalProps {
  isOpen: boolean;
  usn: string | null;
  student: Student | null;
  isLoading: boolean;
  isCached: boolean;
  cachedAge: string;
  myUsn: string;
  studentSession: AuthSession | null;
  originRect: OriginRect | null;
  compareUsns: string[];
  isObsidian?: boolean;
  onClose: () => void;
  onToggleCompare: (usn: string) => void;
  onCompareWithMe: (student: Student) => void;
  onOpenAuth: () => void;
  onOpenPixelModal: () => void;
  onRetry: (usn: string) => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  currentIndex?: number;
  totalStudents?: number;
}

export default function StudentDetailModal({
  isOpen,
  usn,
  student,
  isLoading,
  isCached,
  cachedAge,
  myUsn,
  studentSession,
  originRect,
  compareUsns,
  isObsidian = false,
  onClose,
  onToggleCompare,
  onCompareWithMe,
  onOpenAuth,
  onOpenPixelModal,
  onRetry,
  onNavigatePrev,
  onNavigateNext,
  hasPrev = false,
  hasNext = false,
  currentIndex,
  totalStudents,
}: StudentDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isRescrapeModalOpen, setIsRescrapeModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // History popstate and hardware back button tracking
  const isClosingViaHistoryRef = useRef(false);
  const isHistoryPushedRef = useRef(false);

  // Touch Swipe-Down to dismiss gesture
  const touchStartY = useRef<number | null>(null);
  const touchDeltaY = useRef<number>(0);

  // Character-by-character sequential scramble hook over 1.3s
  const { displayChars, isScrambleComplete } = useSequentialUSNScramble(usn, isOpen);

  // Smooth closing transition handler (collapses back into origin element smoothly)
  const handleModalClose = () => {
    if (isClosing) return;
    sfx.playMechanicalClick();
    setIsClosing(true);

    // If closed via UI action (not popstate), pop the pushed history entry
    if (isHistoryPushedRef.current && !isClosingViaHistoryRef.current) {
      if (typeof window !== "undefined" && window.history.state?.modal === "student-detail") {
        isHistoryPushedRef.current = false;
        window.history.back();
      }
    }
    isClosingViaHistoryRef.current = false;

    if (originRect && modalRef.current && backdropRef.current) {
      const modalEl = modalRef.current;
      const targetRect = modalEl.getBoundingClientRect();

      const scaleX = Math.max(originRect.width / targetRect.width, 0.1);
      const scaleY = Math.max(originRect.height / targetRect.height, 0.1);
      const deltaX =
        originRect.left + originRect.width / 2 - (targetRect.left + targetRect.width / 2);
      const deltaY =
        originRect.top + originRect.height / 2 - (targetRect.top + targetRect.height / 2);

      modalEl.style.transition =
        "transform 320ms cubic-bezier(0.32, 0, 0.67, 0), opacity 260ms ease-in, border-radius 320ms ease";
      modalEl.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`;
      modalEl.style.opacity = "0";

      backdropRef.current.style.transition = "opacity 320ms ease-in";
      backdropRef.current.style.opacity = "0";
    }

    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 320);
  };

  // Hardware / Android / Swipe Back Button support via History API
  useEffect(() => {
    if (!isOpen) return;

    // Push state once when modal opens
    window.history.pushState({ modal: "student-detail" }, "");
    isHistoryPushedRef.current = true;
    isClosingViaHistoryRef.current = false;

    const handlePopState = () => {
      isClosingViaHistoryRef.current = true;
      isHistoryPushedRef.current = false;
      handleModalClose();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (isHistoryPushedRef.current && typeof window !== "undefined" && window.history.state?.modal === "student-detail") {
        isHistoryPushedRef.current = false;
        window.history.back();
      }
    };
  }, [isOpen]);

  // Touch handlers for pull-down to dismiss gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchDeltaY.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || !modalRef.current) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - touchStartY.current;
    if (delta > 0) {
      touchDeltaY.current = delta;
      // Visual feedback: rubberband card downward
      modalRef.current.style.transform = `translate3d(0, ${Math.min(delta * 0.6, 110)}px, 0)`;
      modalRef.current.style.transition = "none";
    }
  };

  const handleTouchEnd = () => {
    if (touchStartY.current === null || !modalRef.current) return;
    const delta = touchDeltaY.current;
    touchStartY.current = null;
    touchDeltaY.current = 0;

    if (delta > 65) {
      // Swiped down sufficiently -> trigger smooth close
      handleModalClose();
    } else {
      // Snap back smoothly
      modalRef.current.style.transition = "transform 250ms cubic-bezier(0.16, 1, 0.3, 1)";
      modalRef.current.style.transform = "translate3d(0, 0, 0)";
    }
  };

  // Stable refs for navigation callbacks and flags so effects don't re-run
  const onNavigatePrevRef = useRef(onNavigatePrev);
  onNavigatePrevRef.current = onNavigatePrev;
  const onNavigateNextRef = useRef(onNavigateNext);
  onNavigateNextRef.current = onNavigateNext;
  const hasPrevRef = useRef(hasPrev);
  hasPrevRef.current = hasPrev;
  const hasNextRef = useRef(hasNext);
  hasNextRef.current = hasNext;

  // Track if FLIP mount animation has already played to prevent glitchy re-animation on data load
  const hasAnimatedMountRef = useRef(false);

  // Keyboard Escape & Arrow navigation handlers
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleModalClose();
      } else if (e.key === "ArrowLeft" && onNavigatePrevRef.current && hasPrevRef.current) {
        sfx.playMechanicalClick();
        onNavigatePrevRef.current();
      } else if (e.key === "ArrowRight" && onNavigateNextRef.current && hasNextRef.current) {
        sfx.playMechanicalClick();
        onNavigateNextRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // FLIP Shared-Element Expansion on mount - runs ONLY ONCE when modal opens
  useEffect(() => {
    if (!isOpen || !modalRef.current) {
      hasAnimatedMountRef.current = false;
      return;
    }

    // Guard: Prevent re-animating/flashing when state or student props update!
    if (hasAnimatedMountRef.current) return;
    hasAnimatedMountRef.current = true;

    // Lock background page scroll
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const modalEl = modalRef.current;
    const backdropEl = backdropRef.current;

    if (backdropEl) {
      backdropEl.style.opacity = "1";
    }

    if (originRect) {
      // Measure destination rect (Last)
      const targetRect = modalEl.getBoundingClientRect();

      const scaleX = Math.max(originRect.width / targetRect.width, 0.1);
      const scaleY = Math.max(originRect.height / targetRect.height, 0.1);
      const deltaX =
        originRect.left + originRect.width / 2 - (targetRect.left + targetRect.width / 2);
      const deltaY =
        originRect.top + originRect.height / 2 - (targetRect.top + targetRect.height / 2);

      // Invert: position modal card directly on top of the clicked card/row
      modalEl.style.transformOrigin = "center center";
      modalEl.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`;
      modalEl.style.opacity = "0.75";
      modalEl.style.transition = "none";

      // Force browser reflow to commit initial inverted frame
      modalEl.getBoundingClientRect();

      // Play: animate out into full centered modal like an expansive window
      requestAnimationFrame(() => {
        modalEl.style.transition =
          "transform 550ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), border-radius 550ms ease";
        modalEl.style.transform = "translate3d(0, 0, 0) scale(1, 1)";
        modalEl.style.opacity = "1";
      });
    } else {
      // Fallback spring scale if no origin rect was recorded
      modalEl.style.transformOrigin = "center center";
      modalEl.style.transform = "scale(0.92)";
      modalEl.style.opacity = "0";
      modalEl.style.transition = "none";
      modalEl.getBoundingClientRect();

      requestAnimationFrame(() => {
        modalEl.style.transition =
          "transform 500ms cubic-bezier(0.16, 1, 0.3, 1), opacity 380ms ease-out";
        modalEl.style.transform = "scale(1)";
        modalEl.style.opacity = "1";
      });
    }

    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !usn) return null;

  const isMyVerifiedProfile = Boolean(
    studentSession && usn.toUpperCase() === studentSession.usn.toUpperCase()
  );

  return (
    <div
      ref={backdropRef}
      onClick={handleModalClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto transition-opacity duration-300"
      style={{ opacity: 0 }}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className={`rounded-2xl sm:rounded-3xl border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-auto will-change-transform ${
          isObsidian
            ? "bg-[#0b0d11] border-slate-800 text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Mobile Swipe-Down Handle & Touch Drag Bar */}
        <div
          className="sm:hidden pt-2.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700/80 transition-colors" />
        </div>

        {/* Modal Header */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`px-3 sm:px-6 py-2.5 sm:py-4 border-b flex items-center justify-between gap-2 select-none ${
            isObsidian ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Mobile Left Back Arrow (Natural thumb reach) */}
            <button
              type="button"
              onClick={handleModalClose}
              className="sm:hidden p-2 -ml-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl active:bg-slate-200 dark:active:bg-slate-800 transition-colors shrink-0 flex items-center justify-center cursor-pointer"
              title="Back to search results"
              aria-label="Back to search results"
            >
              <IconArrowLeft className="w-5 h-5" />
            </button>
            {/* Identicon - Clean avatar box without any overlapping fingerprint text */}
            <div
              className={`transition-all duration-300 ease-out flex-shrink-0 ${
                isScrambleComplete
                  ? "opacity-100 scale-100 translate-x-0"
                  : "opacity-0 scale-75 -translate-x-2 pointer-events-none w-0 h-0 overflow-hidden"
              }`}
            >
              {isScrambleComplete && (
                <Identicon
                  usn={usn}
                  percentage={student?.percentage}
                  totalBacklogs={student?.total_backlogs}
                  customPixelArt={student?.avatar_pixel_art}
                  size={44}
                  showFingerprint={false}
                  isEditable={isMyVerifiedProfile}
                  onEditClick={onOpenPixelModal}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              {!isScrambleComplete ? (
                /* While Scrambling: Prominently show character-by-character sequential decode */
                <div className="flex flex-col gap-1 py-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
                      Decrypting USN Record...
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-0.5 sm:gap-1 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-cyan-500/40 shadow-lg shadow-cyan-950/40 max-w-fit">
                    {displayChars.map((item, idx) => (
                      <span
                        key={idx}
                        className={`inline-block w-4 sm:w-5 text-center font-mono font-bold text-sm sm:text-base tabular-nums transition-colors duration-100 ${
                          item.isLocked
                            ? "text-cyan-300 font-extrabold"
                            : "text-amber-400 font-medium animate-pulse"
                        }`}
                      >
                        {item.char}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                /* After Scramble: Clearly visible Name, badges, and USN row with zero overlap */
                <div className="transition-all duration-300 ease-out opacity-100 translate-y-0">
                  {/* Row 1: Student Name + Cached status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-extrabold text-base sm:text-lg leading-tight tracking-tight text-slate-900 dark:text-white truncate">
                      {student?.name || "Student Marksheet"}
                    </h2>
                    {isCached && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <span>⚡️</span>
                        <span>0ms Cached ({cachedAge || "saved"})</span>
                      </span>
                    )}
                  </div>

                  {/* Row 2: USN badge, branch, and action buttons */}
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 font-bold font-mono text-xs text-slate-800 dark:text-cyan-300 border border-slate-200 dark:border-white/10 tracking-wider">
                      {usn}
                    </span>
                    <span className="shrink-0 text-xs font-mono opacity-40">•</span>
                    <span className="shrink-0 text-xs font-semibold opacity-75">{student?.branch || "ENG"}</span>

                    {isMyVerifiedProfile && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={onOpenPixelModal}
                          className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                          title="Edit your 10x10 custom pixel art avatar"
                        >
                          <IconPencil className="w-2.5 h-2.5" />
                          <span>Edit Avatar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            sfx.playMechanicalClick();
                            setIsPrivacyModalOpen(true);
                          }}
                          className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/20 transition-colors cursor-pointer"
                          title="Manage your privacy and data visibility"
                        >
                          <IconShield className="w-2.5 h-2.5" />
                          <span>Privacy Settings</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                sfx.playMechanicalClick();
                onToggleCompare(usn);
              }}
              className={`p-1.5 sm:p-2 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all ${
                compareUsns.includes(usn)
                  ? "bg-blue-600 text-white border-blue-600 font-bold"
                  : isObsidian
                  ? "bg-slate-900 text-slate-300 border-slate-800"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <IconCompare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">
                {compareUsns.includes(usn) ? "Added" : "Compare"}
              </span>
            </button>
            <button
              onClick={handleModalClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <IconClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {!isScrambleComplete ? (
            /* During 2-second scramble delay: High-tech decryption status */
            <div className="py-14 sm:py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <div className="absolute inset-0 rounded-2xl border-2 border-cyan-500/25 border-t-cyan-400 animate-spin" />
                <span className="font-mono text-xs text-cyan-400 font-bold">VTU</span>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-mono font-semibold tracking-wider text-cyan-400/90 uppercase">
                  Decrypting Student Record...
                </p>
                <p className="text-[11px] opacity-50 font-mono">
                  Synthesizing provisional marksheet for seat number {usn}
                </p>
              </div>
              {/* Skeleton placeholders */}
              <div className="w-full max-w-md grid grid-cols-3 gap-2 pt-2 animate-pulse">
                <div className="h-14 rounded-xl bg-slate-800/20 dark:bg-white/[0.03] border border-slate-800/40" />
                <div className="h-14 rounded-xl bg-slate-800/20 dark:bg-white/[0.03] border border-slate-800/40" />
                <div className="h-14 rounded-xl bg-slate-800/20 dark:bg-white/[0.03] border border-slate-800/40" />
              </div>
            </div>
          ) : isLoading && !student ? (
            <div className="space-y-3 py-6">
              <div className="h-6 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
              <div className="h-16 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
              <div className="h-32 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
            </div>
          ) : !student ? (
            <div className="text-center py-8 space-y-2">
              <IconWifiOff className="w-7 h-7 mx-auto text-slate-400" />
              <p className="font-semibold text-sm">Marksheet Not Cached</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Could not reach server and no offline cache was saved for {usn}.
              </p>
              <button
                onClick={() => onRetry(usn)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 shadow-sm mt-1 transition-all active:scale-[0.98] cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400"
              >
                Retry Loading
              </button>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5 transition-all duration-500 ease-out opacity-100 translate-y-0">
              {/* Summary Metric Tiles */}
              {/* Key Metrics Grid - Ultra-compact on mobile, spacious on desktop */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 text-center">
                <div
                  className={`p-2 py-2 sm:p-3 rounded-xl border flex flex-col justify-center min-w-0 ${
                    isObsidian ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <p className="text-[9px] sm:text-[10px] uppercase font-semibold opacity-60 tracking-tight sm:tracking-normal truncate">
                    Score
                  </p>
                  <p className="text-xs sm:text-base font-bold font-mono mt-0.5 tabular-nums truncate">
                    {student.total_marks}
                    <span className="text-[9px] sm:text-[10px] font-normal opacity-50 ml-0.5">
                      /{student.max_marks || 100}
                    </span>
                  </p>
                </div>

                <div
                  className={`p-2 py-2 sm:p-3 rounded-xl border flex flex-col justify-center min-w-0 ${
                    isObsidian
                      ? "bg-cyan-950/20 border-cyan-800/40 text-cyan-300"
                      : "bg-blue-50/60 border-blue-100 text-blue-700"
                  }`}
                >
                  <p className="text-[9px] sm:text-[10px] uppercase font-semibold opacity-80 tracking-tight sm:tracking-normal truncate">
                    Percentage
                  </p>
                  <p className="text-xs sm:text-base font-bold font-mono mt-0.5 tabular-nums truncate">
                    {student.percentage.toFixed(1)}%
                  </p>
                </div>

                {/* Pending / Re-attempts Tile */}
                {(() => {
                  const isHidden = !isMyVerifiedProfile && student.show_my_backlogs === false;
                  const hasBacklogs = student.total_backlogs > 0;

                  return (
                    <div
                      className={`p-2 py-2 sm:p-3 rounded-xl border flex flex-col justify-center min-w-0 ${
                        isHidden
                          ? isObsidian
                            ? "bg-slate-900/60 border-slate-800 text-slate-400"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                          : hasBacklogs
                          ? isObsidian
                            ? "bg-rose-950/30 border-rose-800/60 text-rose-400"
                            : "bg-rose-50 border-rose-200 text-rose-700"
                          : isObsidian
                          ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-400"
                          : "bg-emerald-50 border-emerald-200 text-emerald-700"
                      }`}
                    >
                      <p
                        className="text-[9px] sm:text-[10px] uppercase font-semibold opacity-80 tracking-tight sm:tracking-normal truncate"
                        title="Re-attempts / Pending"
                      >
                        <span className="sm:hidden">Re-attempts</span>
                        <span className="hidden sm:inline">Re-attempts / Pending</span>
                      </p>
                      <p className="text-xs sm:text-base font-bold font-mono mt-0.5 tabular-nums truncate">
                        {isHidden
                          ? "Hidden"
                          : hasBacklogs
                          ? `${student.total_backlogs} Pending`
                          : "All Clear"}
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Head-to-Head Comparison Banner */}
              <div
                className={`p-3 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-2.5 ${
                  isObsidian ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200/80"
                }`}
              >
                <div className="text-left w-full sm:w-auto">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <IconCompare className="w-3.5 h-3.5 text-slate-500" />
                    <span>Direct Comparison</span>
                    {myUsn && myUsn.toUpperCase() !== usn.toUpperCase() && (
                      <span className="text-[10px] opacity-70 font-mono">vs You ({myUsn})</span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-70">
                    {myUsn && usn.toUpperCase() === myUsn.toUpperCase()
                      ? "This is your verified personal marksheet."
                      : myUsn
                      ? "Evaluate subject marks and leads side-by-side."
                      : "Sign in with your USN to compare marks side-by-side."}
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {myUsn && usn.toUpperCase() === myUsn.toUpperCase() ? (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-white/10 text-slate-800 dark:text-slate-200">
                      Your Marksheet
                    </span>
                  ) : myUsn ? (
                    <button
                      onClick={() => onCompareWithMe(student)}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 shadow-sm flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400"
                    >
                      <IconCompare className="w-3.5 h-3.5" />
                      <span>Compare with Me</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        sfx.playMechanicalClick();
                        onOpenAuth();
                      }}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 shadow-sm flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400"
                    >
                      <IconKey className="w-3.5 h-3.5" />
                      <span>Sign In to Compare</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Account Holder Marksheet Update Request Banner */}
              {isMyVerifiedProfile && (
                <div
                  className={`p-3 sm:p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isObsidian
                      ? "bg-cyan-950/20 border-cyan-800/40 text-cyan-200"
                      : "bg-blue-50/70 border-blue-200 text-blue-900"
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <IconRotateCcw className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                      <span>Need your marksheet updated?</span>
                    </div>
                    <p className="text-[11px] opacity-80 leading-relaxed">
                      Cleared pending subjects in revaluation/re-exam, or missing results? Send an update request to admin.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playMechanicalClick();
                      setIsRescrapeModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 shadow-sm flex items-center gap-1.5 transition-transform active:scale-[0.98] cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400"
                  >
                    <IconRotateCcw className="w-3.5 h-3.5" />
                    <span>Request Update</span>
                  </button>
                </div>
              )}

              {/* Social Profile Badges */}
              {(student.github_url || student.linkedin_url) && (
                <div
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    isObsidian ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <span className="opacity-60 text-[11px]">Public Profiles:</span>
                  <div className="flex items-center gap-2">
                    {student.github_url && (
                      <a
                        href={student.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white transition-colors text-xs font-medium"
                      >
                        <IconGitHub className="w-3.5 h-3.5" />
                        <span>GitHub</span>
                      </a>
                    )}
                    {student.linkedin_url && (
                      <a
                        href={student.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 transition-colors text-xs font-medium"
                      >
                        <IconLinkedIn className="w-3.5 h-3.5" />
                        <span>LinkedIn</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Marks Breakdown Table */}
              <div>
                <div className="mb-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider opacity-70">
                    Subject Marks Breakdown ({student.marks?.length || 0})
                  </h3>
                </div>

                <div
                  className={`overflow-x-auto rounded-xl border ${
                    isObsidian ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white"
                  }`}
                >
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr
                        className={`border-b text-[10px] opacity-60 uppercase ${
                          isObsidian ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <th className="py-2 px-3 font-semibold">Code</th>
                        <th className="py-2 px-2 font-semibold text-center">Sem</th>
                        <th className="py-2 px-3 font-semibold">Subject</th>
                        <th className="py-2 px-2 font-semibold text-center">Int</th>
                        <th className="py-2 px-2 font-semibold text-center">Ext</th>
                        <th className="py-2 px-2 font-semibold text-center">Total</th>
                        <th className="py-2 px-3 font-semibold text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody
                      className={`divide-y ${
                        isObsidian ? "divide-slate-800/60" : "divide-slate-100"
                      }`}
                    >
                      {student.marks && student.marks.length > 0 ? (
                        student.marks.map((m, i) => (
                          <tr
                            key={i}
                            className={isObsidian ? "hover:bg-slate-900/40" : "hover:bg-slate-50/60"}
                          >
                            <td className="py-2 px-3 font-mono font-semibold opacity-80">
                              {m.subject_code}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-[10px] opacity-70">
                              S{m.semester || "1"}
                            </td>
                            <td className="py-2 px-3 font-medium max-w-[180px] sm:max-w-[220px] truncate">
                              {m.subject_name || m.subject_code}
                            </td>
                            <td className="py-2 px-2 text-center opacity-60 font-mono">
                              {m.internal_marks}
                            </td>
                            <td className="py-2 px-2 text-center opacity-60 font-mono">
                              {m.external_marks}
                            </td>
                            <td className="py-2 px-2 text-center font-bold font-mono">
                              {m.total}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span
                                className={`inline-block font-semibold px-2 py-0.5 rounded text-[10px] border ${
                                  m.status === "P"
                                    ? isObsidian
                                      ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : isObsidian
                                    ? "bg-rose-950 text-rose-400 border-rose-800"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                {m.status === "P" ? "PASS" : "F"}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-6 text-center opacity-40 text-xs">
                            No subject records available for this student.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Thumb-Friendly Navigation Bar */}
        <div
          className={`px-3 sm:px-6 py-2.5 sm:py-3 border-t flex items-center justify-between gap-2 shrink-0 ${
            isObsidian ? "border-slate-800/90 bg-[#08090b]/95" : "border-slate-200/90 bg-white/95"
          } backdrop-blur-md`}
        >
          {/* Previous Student Button */}
          <button
            type="button"
            onClick={() => {
              if (onNavigatePrev && hasPrev) {
                sfx.playMechanicalClick();
                onNavigatePrev();
              }
            }}
            disabled={!hasPrev || !onNavigatePrev}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              hasPrev && onNavigatePrev
                ? isObsidian
                  ? "bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700/80 active:scale-95 cursor-pointer"
                  : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 active:scale-95 cursor-pointer shadow-xs"
                : "opacity-30 border-transparent cursor-not-allowed text-slate-400"
            }`}
            title="View previous student (or press Left Arrow)"
          >
            <IconArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden xs:inline text-[11px]">Prev</span>
          </button>

          {/* Central Thumb-Friendly "Back to Results" pill */}
          <button
            type="button"
            onClick={handleModalClose}
            className={`flex-1 max-w-[220px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
              isObsidian
                ? "bg-white/10 hover:bg-white/15 text-white border border-white/15 hover:border-white/25 shadow-black/40"
                : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10"
            }`}
            title="Close marksheet and return to list"
          >
            <IconArrowLeft className="w-3.5 h-3.5 sm:hidden" />
            <span>Back to Results</span>
            {currentIndex && totalStudents ? (
              <span className="text-[10px] font-mono opacity-60 hidden sm:inline ml-1">
                ({currentIndex}/{totalStudents})
              </span>
            ) : null}
          </button>

          {/* Next Student Button */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateNext && hasNext) {
                sfx.playMechanicalClick();
                onNavigateNext();
              }
            }}
            disabled={!hasNext || !onNavigateNext}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              hasNext && onNavigateNext
                ? isObsidian
                  ? "bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700/80 active:scale-95 cursor-pointer"
                  : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 active:scale-95 cursor-pointer shadow-xs"
                : "opacity-30 border-transparent cursor-not-allowed text-slate-400"
            }`}
            title="View next student (or press Right Arrow)"
          >
            <span className="hidden xs:inline text-[11px]">Next</span>
            <IconArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Re-scrape / Revaluation Request Modal (strictly for verified account owner) */}
      <RescrapeRequestModal
        isOpen={isRescrapeModalOpen && isMyVerifiedProfile}
        student={student}
        usn={usn}
        studentSession={studentSession}
        isObsidian={isObsidian}
        onClose={() => setIsRescrapeModalOpen(false)}
      />

      {/* Student Privacy Settings Modal */}
      {isMyVerifiedProfile && (
        <PrivacySettingsModal
          isOpen={isPrivacyModalOpen}
          onClose={() => setIsPrivacyModalOpen(false)}
          usn={usn}
          studentToken={studentSession?.token}
          isObsidian={isObsidian}
        />
      )}
    </div>
  );
}
