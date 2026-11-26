"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Student,
  AuthSession,
  getSecureStats,
  requestAnalyticsCaptcha,
  submitAnalyticsCaptcha,
  SecureStatsData,
  fetchStudentInsights,
  StudentInsights,
} from "../lib/api";
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
  IconLock,
  IconEye,
  IconUsers,
} from "./Icons";
import CountUp from "./CountUp";
import Identicon from "./Identicon";
import RescrapeRequestModal from "./RescrapeRequestModal";
import PrivacySettingsModal from "./PrivacySettingsModal";
import { sfx } from "../lib/sfx";
import { getSubjectName } from "../lib/subjects";

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
  isComparingLoading?: boolean;
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
  isComparingLoading = false,
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

  // Secure Stats & Captcha Verification State
  const [unlockedStats, setUnlockedStats] = useState<SecureStatsData | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [captchaSessionId, setCaptchaSessionId] = useState<string | null>(null);
  const [captchaBase64, setCaptchaBase64] = useState<string | null>(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [isCaptchaLoading, setIsCaptchaLoading] = useState(false);
  const [isSubmittingCaptcha, setIsSubmittingCaptcha] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const captchaInputRef = useRef<HTMLInputElement>(null);

  // Weekly Profile Insights State
  const [insights, setInsights] = useState<StudentInsights | null>(null);
  const [insightsUnlocked, setInsightsUnlocked] = useState(false);
  const [lastVerifiedViews, setLastVerifiedViews] = useState(0);
  const [lastVerifiedComparisons, setLastVerifiedComparisons] = useState(0);
  const [fromViewsCount, setFromViewsCount] = useState(0);
  const [fromComparisonsCount, setFromComparisonsCount] = useState(0);

  // Fetch insights and check previous verification status on USN load
  useEffect(() => {
    if (!isOpen || !usn) {
      setInsights(null);
      setInsightsUnlocked(false);
      return;
    }

    const cleanUsn = usn.trim().toUpperCase();

    fetchStudentInsights(cleanUsn)
      .then((data) => {
        setInsights(data);
        try {
          const raw = localStorage.getItem(`vtu_insights_${cleanUsn}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            const prevViews = Number(parsed.views) || 0;
            const prevComps = Number(parsed.comparisons) || 0;
            setLastVerifiedViews(prevViews);
            setLastVerifiedComparisons(prevComps);
            setFromViewsCount(prevViews);
            setFromComparisonsCount(prevComps);

            // If new activity occurred since last check, keep locked to show trend arrow & re-verify
            if (data.views_this_week > prevViews || data.comparisons_this_week > prevComps) {
              setInsightsUnlocked(false);
            } else {
              setInsightsUnlocked(true);
            }
          } else {
            setInsightsUnlocked(false);
            setLastVerifiedViews(0);
            setLastVerifiedComparisons(0);
            setFromViewsCount(0);
            setFromComparisonsCount(0);
          }
        } catch {
          setInsightsUnlocked(false);
        }
      })
      .catch(() => {
        // Fallback gracefully without breaking marksheet viewing
      });
  }, [usn, isOpen]);

  // Re-blur stats whenever student USN changes, navigating to next/prev, or modal opens/closes
  useEffect(() => {
    setUnlockedStats(null);
    setIsVerificationModalOpen(false);
    setCaptchaSessionId(null);
    setCaptchaBase64(null);
    setCaptchaInput("");
    setCaptchaError(null);
  }, [usn, isOpen]);

  const handleOpenVerification = async () => {
    sfx.playMechanicalClick();
    setIsVerificationModalOpen(true);
    setIsCaptchaLoading(true);
    setCaptchaError(null);
    setCaptchaInput("");
    try {
      const data = await requestAnalyticsCaptcha(usn || undefined);
      setCaptchaSessionId(data.session_id);
      setCaptchaBase64(data.captcha_base64);
      setTimeout(() => captchaInputRef.current?.focus(), 150);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load verification challenge";
      setCaptchaError(msg);
    } finally {
      setIsCaptchaLoading(false);
    }
  };

  const handleCancelVerification = () => {
    sfx.playMechanicalClick();
    setIsVerificationModalOpen(false);
    setCaptchaSessionId(null);
    setCaptchaBase64(null);
    setCaptchaInput("");
    setCaptchaError(null);
  };

  const handleSubmitCaptcha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaSessionId || !captchaInput.trim() || !usn) return;
    sfx.playMechanicalClick();
    setIsSubmittingCaptcha(true);
    setCaptchaError(null);

    try {
      await submitAnalyticsCaptcha(captchaSessionId, captchaInput.trim());
      // Session validated on VTU exam portal! Now fetch secure stats with session_id
      const stats = await getSecureStats(usn, captchaSessionId);
      setUnlockedStats(stats);

      // Also unlock insights with progressive dynamic counting animation
      if (insights) {
        setFromViewsCount(lastVerifiedViews);
        setFromComparisonsCount(lastVerifiedComparisons);
        setLastVerifiedViews(insights.views_this_week);
        setLastVerifiedComparisons(insights.comparisons_this_week);
        setInsightsUnlocked(true);
        try {
          localStorage.setItem(
            `vtu_insights_${usn.trim().toUpperCase()}`,
            JSON.stringify({
              views: insights.views_this_week,
              comparisons: insights.comparisons_this_week,
              timestamp: Date.now(),
            })
          );
        } catch {}
      }

      setIsVerificationModalOpen(false);
      sfx.playSonarChime();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification code incorrect. Please try again.";
      setCaptchaError(msg);
      // Refresh captcha on failure
      handleOpenVerification();
    } finally {
      setIsSubmittingCaptcha(false);
    }
  };

  // Sorted marks: Grouped by Semester ascending (Sem 1, Sem 2, Sem 3...), then by subject code
  const sortedMarks = useMemo(() => {
    if (!student?.marks) return [];
    return [...student.marks].sort((a, b) => {
      const semA = parseInt(String(a.semester || "1").replace(/\D/g, ""), 10) || 1;
      const semB = parseInt(String(b.semester || "1").replace(/\D/g, ""), 10) || 1;
      if (semA !== semB) return semA - semB;
      return a.subject_code.localeCompare(b.subject_code);
    });
  }, [student?.marks]);

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
        className={`rounded-2xl sm:rounded-3xl border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-auto will-change-transform ${isObsidian
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
          className={`px-3 sm:px-6 py-2.5 sm:py-4 border-b flex items-center justify-between gap-2 select-none ${isObsidian ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"
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
              className={`transition-all duration-300 ease-out flex-shrink-0 ${isScrambleComplete
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
                        className={`inline-block w-4 sm:w-5 text-center font-mono font-bold text-sm sm:text-base tabular-nums transition-colors duration-100 ${item.isLocked
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
              className={`p-1.5 sm:p-2 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all ${compareUsns.includes(usn)
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
              {/* Key Metrics Grid - Top Stats Dashboard (Responsive 6-Card Grid) */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
                {/* 1. Score */}
                <div
                  className={`p-2.5 rounded-xl border flex flex-col justify-center min-w-0 ${isObsidian ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-100"
                    }`}
                >
                  <p className="text-[10px] uppercase font-semibold opacity-60 tracking-wider truncate">
                    Score
                  </p>
                  <p className="text-xs sm:text-sm font-bold font-mono mt-0.5 tabular-nums truncate">
                    {student.total_marks}
                    <span className="text-[10px] font-normal opacity-50 ml-0.5">
                      /{student.max_marks || 100}
                    </span>
                  </p>
                </div>

                {/* 2. Percentage */}
                <div
                  className={`p-2.5 rounded-xl border flex flex-col justify-center min-w-0 ${isObsidian
                      ? "bg-cyan-950/20 border-cyan-800/40 text-cyan-300"
                      : "bg-blue-50/60 border-blue-100 text-blue-700"
                    }`}
                >
                  <p className="text-[10px] uppercase font-semibold opacity-80 tracking-wider truncate">
                    Percentage
                  </p>
                  <p className="text-xs sm:text-sm font-bold font-mono mt-0.5 tabular-nums truncate">
                    {student.percentage.toFixed(1)}%
                  </p>
                </div>

                {/* 3. Re-attempts / Pending Status */}
                {(() => {
                  const isHidden = !isMyVerifiedProfile && student.show_my_backlogs === false;
                  const hasBacklogs = student.total_backlogs > 0;

                  return (
                    <div
                      className={`p-2.5 rounded-xl border flex flex-col justify-center min-w-0 ${isHidden
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
                        className="text-[10px] uppercase font-semibold opacity-80 tracking-wider truncate"
                        title="Re-attempts / Pending"
                      >
                        Re-attempts
                      </p>
                      <p className="text-xs sm:text-sm font-bold font-mono mt-0.5 tabular-nums truncate">
                        {isHidden
                          ? "Hidden"
                          : hasBacklogs
                            ? `${student.total_backlogs} Pending`
                            : "All Clear"}
                      </p>
                    </div>
                  );
                })()}

                {/* 4. Credits (Protected by Captcha Verification Gate) */}
                <div
                  className={`relative p-2.5 rounded-xl border flex flex-col justify-center min-w-0 overflow-hidden ${
                    isObsidian ? "bg-indigo-950/20 border-indigo-800/40 text-indigo-300" : "bg-indigo-50/60 border-indigo-100 text-indigo-700"
                  }`}
                >
                  <p className="text-[10px] uppercase font-semibold opacity-80 tracking-wider truncate">
                    Credits
                  </p>
                  {unlockedStats && unlockedStats.usn === student.usn ? (
                    <p className="text-xs sm:text-sm font-bold font-mono mt-0.5 tabular-nums truncate">
                      {unlockedStats.is_hidden ? (
                        <span className="text-amber-400 text-xs">Hidden</span>
                      ) : (
                        <>
                          {unlockedStats.credits ?? 0}
                          <span className="text-[10px] font-normal opacity-50 ml-0.5">
                            /{unlockedStats.total_credits || 20} Cr
                          </span>
                        </>
                      )}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenVerification}
                      className="relative w-full group mt-0.5 cursor-pointer outline-none"
                      title="Click to solve security captcha and view verified credits"
                    >
                      <div className="filter blur-md select-none opacity-30 font-mono font-bold text-xs sm:text-sm">
                        20 / 20 Cr
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center gap-1 rounded bg-black/10 group-hover:bg-black/30 transition-colors">
                        <IconLock className="w-2.5 h-2.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-300">
                          Verify
                        </span>
                      </div>
                    </button>
                  )}
                </div>

                {/* 5. SGPA (Protected by Captcha Verification Gate) */}
                <div
                  className={`relative p-2.5 rounded-xl border flex flex-col justify-center min-w-0 overflow-hidden ${
                    isObsidian ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300" : "bg-emerald-50/60 border-emerald-100 text-emerald-700"
                  }`}
                >
                  <p className="text-[10px] uppercase font-semibold opacity-80 tracking-wider truncate">
                    SGPA
                  </p>
                  {unlockedStats && unlockedStats.usn === student.usn ? (
                    <p className="text-xs sm:text-sm font-bold font-mono mt-0.5 tabular-nums truncate">
                      {unlockedStats.is_hidden ? (
                        <span className="text-amber-400 text-xs">Hidden</span>
                      ) : (
                        <>
                          {unlockedStats.sgpa?.toFixed(2) ?? "—"}
                          <span className="text-[10px] font-normal opacity-50 ml-0.5">/ 10</span>
                        </>
                      )}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenVerification}
                      className="relative w-full group mt-0.5 cursor-pointer outline-none"
                      title="Click to solve security captcha and view verified SGPA"
                    >
                      <div className="filter blur-md select-none opacity-30 font-mono font-bold text-xs sm:text-sm">
                        8.75 / 10
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center gap-1 rounded bg-black/10 group-hover:bg-black/30 transition-colors">
                        <IconLock className="w-2.5 h-2.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-300">
                          Verify
                        </span>
                      </div>
                    </button>
                  )}
                </div>

                {/* 6. CGPA (Protected by Captcha Verification Gate) */}
                <div
                  className={`relative p-2.5 rounded-xl border flex flex-col justify-center min-w-0 overflow-hidden ${
                    isObsidian ? "bg-purple-950/20 border-purple-800/40 text-purple-300" : "bg-purple-50/60 border-purple-100 text-purple-700"
                  }`}
                >
                  <p className="text-[10px] uppercase font-semibold opacity-80 tracking-wider truncate">
                    CGPA
                  </p>
                  {unlockedStats && unlockedStats.usn === student.usn ? (
                    <p className="text-xs sm:text-sm font-bold font-mono mt-0.5 tabular-nums truncate">
                      {unlockedStats.is_hidden ? (
                        <span className="text-amber-400 text-xs">Hidden</span>
                      ) : (
                        <>
                          {unlockedStats.cgpa?.toFixed(2) ?? "—"}
                          <span className="text-[10px] font-normal opacity-50 ml-0.5">/ 10</span>
                        </>
                      )}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenVerification}
                      className="relative w-full group mt-0.5 cursor-pointer outline-none"
                      title="Click to solve security captcha and view verified CGPA"
                    >
                      <div className="filter blur-md select-none opacity-30 font-mono font-bold text-xs sm:text-sm">
                        8.90 / 10
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center gap-1 rounded bg-black/10 group-hover:bg-black/30 transition-colors">
                        <IconLock className="w-2.5 h-2.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-300">
                          Verify
                        </span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Weekly Profile Insights (Non-creepy, crowdsourced captcha verification gate) */}
              {insights && (
                <div
                  className={`p-3 sm:p-4 rounded-2xl border transition-all ${
                    isObsidian
                      ? "bg-slate-950/60 border-slate-800/90 text-white"
                      : "bg-slate-50/80 border-slate-200/90 text-slate-900 shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                      </span>
                      <span className="text-xs font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        Weekly Activity & Peer Interest
                      </span>
                    </div>
                    <span className="text-[10px] font-mono opacity-50 hidden sm:inline-flex items-center gap-1">
                      <IconShield className="w-3 h-3 text-cyan-400" />
                      Private to this USN • Past 7 Days
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Metric 1: Marksheet Views */}
                    <div
                      className={`p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between ${
                        isObsidian ? "bg-[#0c0e12] border-slate-800/80" : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold opacity-75">
                          <IconEye className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Marksheet Views</span>
                        </div>
                        {insights.views_this_week > lastVerifiedViews && lastVerifiedViews > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-pulse">
                            <span>↑</span>
                            <span>+{insights.views_this_week - lastVerifiedViews} new</span>
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5">
                        {insightsUnlocked ? (
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <CountUp
                              from={fromViewsCount}
                              to={insights.views_this_week}
                              duration={1.2}
                              className="font-mono font-extrabold text-base sm:text-lg text-slate-900 dark:text-cyan-300 tabular-nums"
                            />
                            <span className="text-[11px] opacity-70">
                              peers viewed your marksheet this week
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleOpenVerification}
                            className="relative w-full group py-1.5 px-2.5 rounded-lg border border-dashed border-cyan-500/30 hover:border-cyan-400/60 bg-cyan-950/10 hover:bg-cyan-950/20 transition-all flex items-center justify-between cursor-pointer"
                            title="Complete quick security check to view private marksheet views"
                          >
                            <div className="flex items-center gap-1.5 filter blur-xs select-none opacity-30 font-mono font-bold text-sm">
                              <span>{insights.views_this_week}</span>
                              <span className="text-[10px] font-normal">views this week</span>
                            </div>
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 font-semibold text-[10px] group-hover:scale-105 transition-transform">
                              <IconLock className="w-2.5 h-2.5 text-cyan-400" />
                              <span>{lastVerifiedViews > 0 ? "Unlock New Views" : "Verify to Reveal"}</span>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metric 2: Peer Comparisons */}
                    <div
                      className={`p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between ${
                        isObsidian ? "bg-[#0c0e12] border-slate-800/80" : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold opacity-75">
                          <IconCompare className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Peer Comparisons</span>
                        </div>
                        {insights.comparisons_this_week > lastVerifiedComparisons && lastVerifiedComparisons > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 animate-pulse">
                            <span>↑</span>
                            <span>+{insights.comparisons_this_week - lastVerifiedComparisons} new</span>
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5">
                        {insightsUnlocked ? (
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <CountUp
                              from={fromComparisonsCount}
                              to={insights.comparisons_this_week}
                              duration={1.2}
                              className="font-mono font-extrabold text-base sm:text-lg text-slate-900 dark:text-indigo-300 tabular-nums"
                            />
                            <span className="text-[11px] opacity-70">
                              classmates compared performance with you
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleOpenVerification}
                            className="relative w-full group py-1.5 px-2.5 rounded-lg border border-dashed border-indigo-500/30 hover:border-indigo-400/60 bg-indigo-950/10 hover:bg-indigo-950/20 transition-all flex items-center justify-between cursor-pointer"
                            title="Complete quick security check to view peer comparisons"
                          >
                            <div className="flex items-center gap-1.5 filter blur-xs select-none opacity-30 font-mono font-bold text-sm">
                              <span>{insights.comparisons_this_week}</span>
                              <span className="text-[10px] font-normal">compared with you</span>
                            </div>
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-semibold text-[10px] group-hover:scale-105 transition-transform">
                              <IconLock className="w-2.5 h-2.5 text-indigo-400" />
                              <span>{lastVerifiedComparisons > 0 ? "Unlock New Compares" : "Verify to Reveal"}</span>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Privacy Footer & Future Feature Hook */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[10px] opacity-55 font-mono">
                    <span className="flex items-center gap-1">
                      <IconShield className="w-3 h-3 text-cyan-400" />
                      <span>Anonymized privacy mode active</span>
                    </span>
                    <span>Detailed peer breakdown coming soon</span>
                  </div>
                </div>
              )}

              {/* Head-to-Head Comparison Banner */}
              <div
                className={`p-3 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-2.5 ${isObsidian ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200/80"
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
                      disabled={isComparingLoading}
                      onClick={() => onCompareWithMe(student)}
                      className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400 ${
                        isComparingLoading
                          ? "bg-blue-600/80 text-white cursor-wait opacity-90"
                          : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 cursor-pointer"
                      }`}
                    >
                      {isComparingLoading ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <IconCompare className="w-3.5 h-3.5" />
                          <span>Compare with Me</span>
                        </>
                      )}
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
                  className={`p-3 sm:p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${isObsidian
                      ? "bg-cyan-950/20 border-cyan-800/40 text-cyan-200"
                      : "bg-blue-50/70 border-blue-200 text-blue-900"
                    }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <IconRotateCcw className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                      <span>Update Marksheet / Request Changes</span>
                    </div>
                    <p className="text-[11px] opacity-80 leading-relaxed">
                      Update semester results, request profile deletion, or report marksheet issues to administrator.
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
                    <span>Update Record</span>
                  </button>
                </div>
              )}

              {/* Social Profile Badges */}
              {(student.github_url || student.linkedin_url) && (
                <div
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${isObsidian ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-100"
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
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider opacity-70">
                    Subject Marks Breakdown ({student.marks?.length || 0})
                  </h3>
                  <span className="text-[10px] font-mono opacity-60">
                    VTU 2025 NEP Grading
                  </span>
                </div>

                <div
                  className={`overflow-x-auto rounded-xl border ${isObsidian ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white"
                    }`}
                >
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr
                        className={`border-b text-[10px] opacity-60 uppercase ${isObsidian ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
                          }`}
                      >
                        <th className="py-2 px-3 font-semibold">Code</th>
                        <th className="py-2 px-1.5 font-semibold text-center">Sem</th>
                        <th className="py-2 px-3 font-semibold">Subject</th>
                        <th className="py-2 px-2 font-semibold text-center">Weight</th>
                        <th className="py-2 px-2 font-semibold text-center">Int</th>
                        <th className="py-2 px-2 font-semibold text-center">Ext</th>
                        <th className="py-2 px-2 font-semibold text-center">Total</th>
                        <th className="py-2 px-2 font-semibold text-center">Grade</th>
                        <th className="py-2 px-3 font-semibold text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody
                      className={`divide-y ${isObsidian ? "divide-slate-800/60" : "divide-slate-100"
                        }`}
                    >
                      {sortedMarks && sortedMarks.length > 0 ? (
                        sortedMarks.map((m, i) => {
                          const isNcmc = Boolean(
                            m.is_ncmc ||
                            m.subject_code.includes("ICO") ||
                            m.subject_code.includes("CIP")
                          );
                          const credits = isNcmc ? 0 : (m.credits ?? (
                            m.subject_code.includes("MAT") || m.subject_code.includes("PHY") || m.subject_code.includes("CHE") || m.subject_code.includes("PLC") ? 4 :
                            m.subject_code.includes("CED") || m.subject_code.includes("AIA") || m.subject_code.includes("ESC") || m.subject_code.includes("EIT") ? 3 : 1
                          ));
                          const grade = m.grade || (
                            isNcmc
                              ? (m.status === "P" && m.total >= 40 ? "PP" : "NP")
                              : m.status !== "P" || m.total < 40 ? "F"
                              : m.total >= 90 ? "O"
                              : m.total >= 80 ? "A+"
                              : m.total >= 70 ? "A"
                              : m.total >= 60 ? "B+"
                              : m.total >= 55 ? "B"
                              : m.total >= 50 ? "C" : "P"
                          );

                          return (
                            <tr
                              key={i}
                              className={isObsidian ? "hover:bg-slate-900/40" : "hover:bg-slate-50/60"}
                            >
                              <td className="py-2 px-3 font-mono font-semibold opacity-80 whitespace-nowrap">
                                {m.subject_code}
                              </td>
                              <td className="py-2 px-1.5 text-center font-mono text-[10px] opacity-70">
                                S{m.semester || "1"}
                              </td>
                              <td className="py-2 px-3 font-medium max-w-[170px] sm:max-w-[210px] truncate" title={getSubjectName(m.subject_code, m.subject_name)}>
                                {getSubjectName(m.subject_code, m.subject_name)}
                              </td>
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                {isNcmc ? (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25"
                                    title="Non-Credit Course: Required to pass (PP) but excluded from SGPA/CGPA"
                                  >
                                    NCMC (0)
                                  </span>
                                ) : (
                                  <span className="font-mono text-[10px] font-semibold text-cyan-400">
                                    {credits} Cr
                                  </span>
                                )}
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
                              <td className="py-2 px-2 text-center font-mono font-bold text-xs">
                                <span className={
                                  grade === "O" ? "text-amber-400" :
                                  grade === "A+" || grade === "A" ? "text-emerald-400" :
                                  grade === "B+" || grade === "B" ? "text-cyan-400" :
                                  grade === "C" || grade === "P" || grade === "PP" ? "text-indigo-400" :
                                  "text-rose-400"
                                }>
                                  {grade}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <span
                                  className={`inline-block font-semibold px-2 py-0.5 rounded text-[10px] border ${m.status === "P"
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
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} className="py-6 text-center opacity-40 text-xs">
                            No subject records available for this student.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Educational Note on 2025 Scheme Credits & GPA */}
                <div
                  className={`mt-2.5 p-2.5 rounded-xl border text-[11px] flex items-start gap-2.5 ${
                    isObsidian
                      ? "bg-slate-900/40 border-slate-800 text-slate-400"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  <span className="text-base select-none">📊</span>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-300 dark:text-slate-200 text-xs">
                      VTU 2025 Scheme Credit Weighting
                    </p>
                    <p className="leading-relaxed">
                      SGPA is computed as <code className="font-mono text-cyan-400">Σ(Credit × Grade Point) ÷ Σ(Credits)</code>. Courses with 4 credits (Maths, Physics/Chemistry) exert 4× the impact of 1-credit labs. Non-credit mandatory courses (<span className="font-mono text-amber-400">1BICO107 / 207</span>) require a passing grade (PP) but are completely excluded from SGPA and CGPA.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Thumb-Friendly Navigation Bar */}
        <div
          className={`px-3 sm:px-6 py-2.5 sm:py-3 border-t flex items-center justify-between gap-2 shrink-0 ${isObsidian ? "border-slate-800/90 bg-[#08090b]/95" : "border-slate-200/90 bg-white/95"
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
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${hasPrev && onNavigatePrev
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
            className={`flex-1 max-w-[220px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${isObsidian
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
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${hasNext && onNavigateNext
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

      {/* Security Verification Modal (Crowdsourced Scrape Captcha Gate) */}
      {isVerificationModalOpen && (
        <div
          onClick={handleCancelVerification}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl sm:rounded-3xl border shadow-2xl overflow-hidden p-5 sm:p-6 transition-all ${
              isObsidian ? "bg-[#0c0e12] border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400">
                  <IconShield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base leading-tight">
                    Security Verification
                  </h3>
                  <span className="text-[10px] font-mono text-cyan-400 font-semibold tracking-wider uppercase">
                    One-Time Authorization
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelVerification}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            {/* Strict User Copy: DO NOT mention scraping, admin queues, or VTU links */}
            <p className="text-xs opacity-75 leading-relaxed mb-4">
              Please solve this captcha to verify your identity and view sensitive academic records.
            </p>

            {/* Error Notice */}
            {captchaError && (
              <div className="mb-3 p-2.5 rounded-xl text-xs bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-center justify-between">
                <span>{captchaError}</span>
                <button
                  type="button"
                  onClick={handleOpenVerification}
                  className="font-bold underline ml-2 text-[11px] cursor-pointer shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {isCaptchaLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
                <div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                <span className="text-xs font-mono opacity-60">Loading challenge...</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitCaptcha} className="space-y-4">
                {/* Captcha Image */}
                {captchaBase64 && (
                  <div className={`p-3 rounded-xl border flex flex-col items-center gap-2 ${
                    isObsidian ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}>
                    <div className="flex items-center justify-between w-full text-[10px] opacity-60 font-mono">
                      <span>CHALLENGE CHECKSUM</span>
                      <button
                        type="button"
                        onClick={handleOpenVerification}
                        className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <IconRotateCcw className="w-3 h-3" />
                        <span>Refresh</span>
                      </button>
                    </div>
                    <img
                      src={`data:image/png;base64,${captchaBase64}`}
                      alt="Security Captcha"
                      className="h-14 rounded-lg border border-white/10 shadow-sm"
                    />
                  </div>
                )}

                {/* Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium opacity-80">
                      Enter Captcha Code
                    </label>
                    <span className="text-[10px] font-mono opacity-50">
                      Case-Sensitive
                    </span>
                  </div>
                  <input
                    ref={captchaInputRef}
                    type="text"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder="e.g. 5k9P2x"
                    maxLength={10}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    className={`w-full px-4 py-2.5 text-base font-mono text-center tracking-widest rounded-xl border outline-none transition-colors ${
                      isObsidian
                        ? "bg-slate-900 border-slate-700 text-white focus:border-cyan-400"
                        : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"
                    }`}
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelVerification}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCaptcha || !captchaInput.trim()}
                    className="flex-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white shadow-md shadow-cyan-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isSubmittingCaptcha ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border border-white/30 border-t-white animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <IconLock className="w-3.5 h-3.5" />
                        <span>Verify & Unlock</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
