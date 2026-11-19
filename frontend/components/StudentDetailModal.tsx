"use client";

import React, { useEffect, useRef, useState } from "react";
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
} from "./Icons";
import Identicon from "./Identicon";
import RescrapeRequestModal from "./RescrapeRequestModal";
import { sfx } from "../lib/sfx";

export interface OriginRect {
  left: number;
  top: number;
  width: number;
  height: number;
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
}: StudentDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isRescrapeModalOpen, setIsRescrapeModalOpen] = useState(false);

  // Smooth closing transition handler (collapses back into origin element)
  const handleModalClose = () => {
    if (isClosing) return;
    sfx.playMechanicalClick();
    setIsClosing(true);

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
        "transform 240ms cubic-bezier(0.32, 0, 0.67, 0), opacity 200ms ease-in, border-radius 240ms ease";
      modalEl.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`;
      modalEl.style.opacity = "0";

      backdropRef.current.style.transition = "opacity 240ms ease-in";
      backdropRef.current.style.opacity = "0";
    }

    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 240);
  };

  // FLIP Shared-Element Expansion on mount
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

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

      // Play: animate out into full centered modal with a spring curve
      requestAnimationFrame(() => {
        modalEl.style.transition =
          "transform 360ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms cubic-bezier(0.16, 1, 0.3, 1)";
        modalEl.style.transform = "translate3d(0, 0, 0) scale(1, 1)";
        modalEl.style.opacity = "1";
      });
    } else {
      // Fallback spring scale if no origin rect was recorded
      modalEl.style.transformOrigin = "center center";
      modalEl.style.transform = "scale(0.95)";
      modalEl.style.opacity = "0";
      modalEl.style.transition = "none";
      modalEl.getBoundingClientRect();

      requestAnimationFrame(() => {
        modalEl.style.transition =
          "transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out";
        modalEl.style.transform = "scale(1)";
        modalEl.style.opacity = "1";
      });
    }

    // Keyboard Escape handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleModalClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, originRect]);

  if (!isOpen || !usn) return null;

  const isMyVerifiedProfile = Boolean(
    studentSession && usn.toUpperCase() === studentSession.usn.toUpperCase()
  );

  return (
    <div
      ref={backdropRef}
      onClick={handleModalClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto transition-opacity duration-200"
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
        {/* Modal Header */}
        <div
          className={`px-4 sm:px-6 py-3.5 sm:py-4 border-b flex items-center justify-between ${
            isObsidian ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <Identicon
              usn={usn}
              percentage={student?.percentage}
              totalBacklogs={student?.total_backlogs}
              customPixelArt={student?.avatar_pixel_art}
              size={42}
              showFingerprint
              isEditable={isMyVerifiedProfile}
              onEditClick={onOpenPixelModal}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-sm sm:text-base leading-tight">
                  {student?.name || "Student Marksheet"}
                </h2>
                {isMyVerifiedProfile && (
                  <button
                    onClick={onOpenPixelModal}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                    title="Edit your 10x10 custom pixel art avatar"
                  >
                    <IconPencil className="w-2.5 h-2.5" />
                    <span>Edit Avatar</span>
                  </button>
                )}
                {isCached && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <span>⚡️</span>
                    <span>0ms Cached ({cachedAge || "saved"})</span>
                  </span>
                )}
              </div>
              <p className="text-xs opacity-60 font-mono mt-0.5">
                {usn} • {student?.branch || "ENG"}
              </p>
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
          {isLoading && !student ? (
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
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 mt-1"
              >
                Retry Loading
              </button>
            </div>
          ) : (
            <>
              {/* Summary Metric Tiles */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div
                  className={`p-2.5 sm:p-3 rounded-xl border ${
                    isObsidian ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <p className="text-[10px] uppercase font-semibold opacity-50">Score</p>
                  <p className="text-sm sm:text-base font-bold font-mono mt-0.5">
                    {student.total_marks}
                    <span className="text-[10px] font-normal opacity-50 ml-0.5">
                      /{student.max_marks || 100}
                    </span>
                  </p>
                </div>
                <div
                  className={`p-2.5 sm:p-3 rounded-xl border ${
                    isObsidian
                      ? "bg-cyan-950/20 border-cyan-800/40 text-cyan-300"
                      : "bg-blue-50/60 border-blue-100 text-blue-700"
                  }`}
                >
                  <p className="text-[10px] uppercase font-semibold opacity-80">Percentage</p>
                  <p className="text-sm sm:text-base font-bold font-mono mt-0.5">
                    {student.percentage.toFixed(1)}%
                  </p>
                </div>
                <div
                  className={`p-2.5 sm:p-3 rounded-xl border ${
                    student.total_backlogs > 0
                      ? isObsidian
                        ? "bg-rose-950/30 border-rose-800/60 text-rose-400"
                        : "bg-rose-50 border-rose-200 text-rose-700"
                      : isObsidian
                      ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-400"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  }`}
                >
                  <p className="text-[10px] uppercase font-semibold opacity-80">Backlogs</p>
                  <p className="text-sm sm:text-base font-bold font-mono mt-0.5">
                    {student.total_backlogs}
                  </p>
                </div>
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
                      className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-xs flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98]"
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
                      className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-xs flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98]"
                    >
                      <IconKey className="w-3.5 h-3.5" />
                      <span>Sign In to Compare</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Revaluation & Backlog Clearance Notice */}
              {student.total_backlogs > 0 && (
                <div
                  className={`p-3 sm:p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isObsidian
                      ? "bg-amber-950/20 border-amber-800/40 text-amber-200"
                      : "bg-amber-50/70 border-amber-200 text-amber-900"
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <IconRotateCcw className="w-3.5 h-3.5 text-amber-500" />
                      <span>Passed in Revaluation or Re-exam?</span>
                    </div>
                    <p className="text-[11px] opacity-80 leading-relaxed">
                      If you cleared your backlogs or improved marks, request the admin to re-scrape your updated result.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playMechanicalClick();
                      setIsRescrapeModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shrink-0 shadow-xs flex items-center gap-1.5 transition-transform active:scale-[0.98] cursor-pointer"
                  >
                    <IconRotateCcw className="w-3.5 h-3.5" />
                    <span>Request Re-scrape</span>
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
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <h3 className="font-bold text-xs uppercase tracking-wider opacity-70">
                    Subject Marks Breakdown ({student.marks?.length || 0})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playMechanicalClick();
                      setIsRescrapeModalOpen(true);
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <IconRotateCcw className="w-3 h-3 text-cyan-500" />
                    <span>Missing Sem 2 or Reval Results? Request Scrape</span>
                  </button>
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
                                {m.status === "P" ? "PASS" : m.status}
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
            </>
          )}
        </div>
      </div>

      {/* Re-scrape / Revaluation Request Modal */}
      <RescrapeRequestModal
        isOpen={isRescrapeModalOpen}
        student={student}
        usn={usn}
        isObsidian={isObsidian}
        onClose={() => setIsRescrapeModalOpen(false)}
      />
    </div>
  );
}
