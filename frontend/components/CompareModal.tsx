"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Student,
  Mark,
  fetchStudent,
  logStudentComparison,
  compareStudents,
  solveCompareCaptcha,
  submitCompareCaptcha,
  cancelCompareCaptcha,
} from "../lib/api";
import { IconClose, IconCompare, IconShield, IconRotateCcw } from "./Icons";
import Identicon from "./Identicon";
import { sfx } from "../lib/sfx";

interface CompareModalProps {
  student1: Student;
  student2: Student;
  allStudents?: Student[];
  onClose: () => void;
  isObsidian?: boolean;
  viewer?: { usn: string; name?: string } | null;
}

function cleanCompareError(rawMsg: string): string {
  if (!rawMsg) return "Please try again.";
  const lower = rawMsg.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("err_failed")
  ) {
    return "Backend server is waking up. Please wait a moment and try again.";
  }
  if (
    lower.includes("browser logs") ||
    lower.includes("playwright") ||
    lower.includes("target page") ||
    lower.includes("dbus") ||
    lower.includes("chrome-headless") ||
    lower.includes("traceback") ||
    lower.includes("timed out") ||
    lower.includes("unresponsive")
  ) {
    return "VTU examination servers are currently busy. Please try again.";
  }
  return rawMsg;
}

export default function CompareModal({
  student1: initialS1,
  student2: initialS2,
  allStudents = [],
  onClose,
  isObsidian = true,
  viewer = null,
}: CompareModalProps) {
  // Direct student states guaranteed to preserve cross-branch selections
  const [s1, setS1] = useState<Student>(initialS1);
  const [s2, setS2] = useState<Student>(initialS2);

  // Security Verification (Comparison Gate) States
  const [isVerificationRequired, setIsVerificationRequired] = useState(false);
  const [captchaSessionId, setCaptchaSessionId] = useState<string | null>(null);
  const [captchaBase64, setCaptchaBase64] = useState<string | null>(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaSubmitting, setCaptchaSubmitting] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);
  const captchaInputRef = useRef<HTMLInputElement>(null);
  const lastLoggedKeyRef = useRef<string>("");

  const safelyLogComparison = (
    sA: { usn: string; name?: string; branch?: string },
    sB: { usn: string; name?: string; branch?: string }
  ) => {
    if (!viewer?.usn || !sA?.usn || !sB?.usn) return;
    const pairKey = `${viewer.usn}:${[sA.usn, sB.usn].sort().join("<=>")}`;
    if (lastLoggedKeyRef.current === pairKey) return;
    lastLoggedKeyRef.current = pairKey;

    logStudentComparison({
      viewer_usn: viewer.usn,
      viewer_name: viewer.name,
      student1_usn: sA.usn,
      student1_name: sA.name,
      student1_branch: sA.branch,
      student2_usn: sB.usn,
      student2_name: sB.name,
      student2_branch: sB.branch,
    });
  };

  const loadCaptchaChallenge = async () => {
    setCaptchaLoading(true);
    setCaptchaError(null);
    setWrongAttempts(0);
    try {
      const data = await solveCompareCaptcha();
      if (!data.captcha_base64) {
        setIsVerificationRequired(false);
        await executeComparisonGate(s1.usn, s2.usn);
        return;
      }
      setCaptchaSessionId(data.session_id);
      setCaptchaBase64(data.captcha_base64);
      setTimeout(() => captchaInputRef.current?.focus(), 150);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load verification challenge";
      setCaptchaError(cleanCompareError(msg));
    } finally {
      setCaptchaLoading(false);
    }
  };

  const handleCancelVerification = () => {
    sfx.playMechanicalClick();
    if (captchaSessionId) {
      cancelCompareCaptcha(captchaSessionId);
    }
    setIsVerificationRequired(false);
    setCaptchaSessionId(null);
    setCaptchaBase64(null);
    onClose();
  };

  const executeComparisonGate = async (usnA: string, usnB: string) => {
    try {
      const res = await compareStudents(usnA, usnB);
      if (res.student1) setS1(res.student1);
      if (res.student2) setS2(res.student2);
      setIsVerificationRequired(false);
    } catch (err: unknown) {
      const errObj = err as { name?: string; message?: string };
      if (errObj.name === "CAPTCHA_REQUIRED" || errObj.message === "CAPTCHA_REQUIRED") {
        setIsVerificationRequired(true);
        loadCaptchaChallenge();
      }
    }
  };

  // Check comparison gate on initial open
  useEffect(() => {
    if (initialS1?.usn && initialS2?.usn) {
      executeComparisonGate(initialS1.usn, initialS2.usn);
    }
  }, []);

  // Guarantee compare event is recorded on mount if user is logged in (debounced & guarded)
  useEffect(() => {
    if (viewer?.usn && initialS1?.usn && initialS2?.usn) {
      safelyLogComparison(initialS1, initialS2);
    }
  }, []);

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaSessionId || !captchaInput.trim() || wrongAttempts >= 3) return;

    setCaptchaSubmitting(true);
    setCaptchaError(null);
    try {
      const res = await submitCompareCaptcha(captchaSessionId, captchaInput.trim());
      if (res.ok) {
        sfx.playMechanicalClick();
        setVerificationSuccess("Verification complete! Comparison unlocked.");
        setWrongAttempts(0);
        setTimeout(async () => {
          setIsVerificationRequired(false);
          setVerificationSuccess(null);
          setCaptchaInput("");
          setCaptchaBase64(null);
          setCaptchaSessionId(null);
          await executeComparisonGate(s1.usn, s2.usn);
        }, 700);
      } else {
        if (res.new_captcha_base64) {
          setCaptchaBase64(res.new_captcha_base64);
        }
        setCaptchaInput("");
        const nextAttempts = wrongAttempts + 1;
        setWrongAttempts(nextAttempts);
        if (nextAttempts >= 3) {
          setCaptchaError("Maximum attempts reached (3/3). Please refresh the security challenge.");
        } else {
          setCaptchaError(`Invalid captcha code. Please try again. (${nextAttempts}/3 attempts)`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setCaptchaError(cleanCompareError(msg));
    } finally {
      setCaptchaSubmitting(false);
    }
  };

  // Guarantee that initialS1 and initialS2 are always included in the dropdown options
  const selectableStudents = useMemo(() => {
    const map = new Map<string, Student>();
    if (initialS1) map.set(initialS1.usn, initialS1);
    if (initialS2) map.set(initialS2.usn, initialS2);
    if (s1) map.set(s1.usn, s1);
    if (s2) map.set(s2.usn, s2);
    allStudents.forEach((st) => {
      if (!map.has(st.usn)) map.set(st.usn, st);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allStudents, initialS1, initialS2, s1.usn, s2.usn]);

  const handleSelectS1 = async (usn: string) => {
    sfx.playMechanicalClick();
    const found = selectableStudents.find((st) => st.usn === usn);
    if (found) {
      if (found.marks && found.marks.length > 0) {
        setS1(found);
      } else {
        try {
          const full = await fetchStudent(usn);
          setS1(full);
        } catch {
          setS1(found);
        }
      }
      if (viewer?.usn) {
        safelyLogComparison(found, s2);
      }
    }
  };

  const handleSelectS2 = async (usn: string) => {
    sfx.playMechanicalClick();
    const found = selectableStudents.find((st) => st.usn === usn);
    if (found) {
      if (found.marks && found.marks.length > 0) {
        setS2(found);
      } else {
        try {
          const full = await fetchStudent(usn);
          setS2(full);
        } catch {
          setS2(found);
        }
      }
      if (viewer?.usn) {
        safelyLogComparison(s1, found);
      }
    }
  };

  // Build combined subject map
  const s1MarksMap = new Map<string, Mark>();
  (s1.marks || []).forEach((m) => s1MarksMap.set(m.subject_code.toUpperCase(), m));

  const s2MarksMap = new Map<string, Mark>();
  (s2.marks || []).forEach((m) => s2MarksMap.set(m.subject_code.toUpperCase(), m));

  const allSubjectCodes = Array.from(
    new Set([...Array.from(s1MarksMap.keys()), ...Array.from(s2MarksMap.keys())])
  );

  const pctDiff = s1.percentage - s2.percentage;
  const marksDiff = s1.total_marks - s2.total_marks;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div
        className={`relative rounded-t-3xl sm:rounded-3xl border shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 ${
          isObsidian
            ? "bg-[#0b0d11] border-slate-800 text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Security Verification Required (Comparison Gate) */}
        {isVerificationRequired && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
            <div
              className={`w-full max-w-md rounded-2xl border shadow-2xl p-5 sm:p-6 space-y-4 ${
                isObsidian ? "bg-[#0f1115] border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                    <IconShield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">Security Verification Required</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Automated abuse prevention gate</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelVerification}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Cancel & Close"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                To prevent automated abuse and keep comparisons running smoothly, please solve this captcha to continue.
              </p>

              {verificationSuccess ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-center space-y-2 animate-in zoom-in-95">
                  <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-xl font-bold">
                    ✓
                  </div>
                  <p className="text-xs font-semibold">{verificationSuccess}</p>
                </div>
              ) : captchaLoading ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                  <p className="text-xs font-mono text-zinc-400">Loading security verification challenge...</p>
                  <button
                    type="button"
                    onClick={handleCancelVerification}
                    className="mt-3 px-4 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <form onSubmit={handleVerificationSubmit} className="space-y-3.5">
                  {captchaError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
                      <span>{captchaError}</span>
                      <button
                        type="button"
                        onClick={loadCaptchaChallenge}
                        className="text-xs font-bold underline hover:text-rose-300 ml-2"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {captchaBase64 && (
                    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-900 border border-white/10">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                          Official Security Checksum
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            sfx.playMechanicalClick();
                            loadCaptchaChallenge();
                          }}
                          className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                        >
                          <IconRotateCcw className="w-3 h-3" />
                          <span>Refresh</span>
                        </button>
                      </div>
                      <img
                        src={`data:image/png;base64,${captchaBase64}`}
                        alt="Security Captcha"
                        className="h-14 sm:h-16 rounded-lg border border-white/10 shadow-xs"
                      />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-zinc-300">
                        Enter Captcha Code
                      </label>
                      <span className="text-[10px] font-mono text-cyan-400 font-medium">
                        Case-Sensitive (a-z & A-Z)
                      </span>
                    </div>
                    <input
                      ref={captchaInputRef}
                      type="text"
                      value={captchaInput}
                      onChange={(e) => setCaptchaInput(e.target.value)}
                      placeholder={wrongAttempts >= 3 ? "Click Refresh below to retry" : "e.g. 5k9P2x"}
                      maxLength={10}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={wrongAttempts >= 3}
                      required
                      className="w-full px-4 py-2.5 text-base font-mono text-center tracking-widest rounded-xl border border-white/10 bg-white/5 text-white focus:border-cyan-400 outline-none disabled:opacity-50"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playMechanicalClick();
                        setIsVerificationRequired(false);
                        onClose();
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    {wrongAttempts >= 3 ? (
                      <button
                        type="button"
                        onClick={() => {
                          sfx.playMechanicalClick();
                          loadCaptchaChallenge();
                        }}
                        className="flex-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <IconRotateCcw className="w-3.5 h-3.5" />
                        <span>Refresh Challenge</span>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={captchaSubmitting || !captchaInput.trim()}
                        className="flex-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {captchaSubmitting ? (
                          <>
                            <div className="w-3.5 h-3.5 rounded-full border border-white/30 border-t-white animate-spin" />
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <span>Submit Verification</span>
                        )}
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
        {/* Header */}
        <div
          className={`px-4 sm:px-6 py-3.5 sm:py-4 border-b flex items-center justify-between ${
            isObsidian ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 border border-white/10 text-white flex items-center justify-center shadow-xs font-bold">
              <IconCompare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base leading-tight">Student Comparison</h2>
              <p className="text-[11px] opacity-60">Head-to-head subject breakdown and performance metrics</p>
            </div>
          </div>
          <button
            onClick={() => {
              sfx.playMechanicalClick();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          {/* Student Selector / Cards Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Student 1 Card */}
            <div
              className={`p-3.5 sm:p-4 rounded-2xl border ${
                isObsidian
                  ? "bg-cyan-950/15 border-cyan-800/40"
                  : "bg-blue-50/40 border-blue-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <Identicon
                  usn={s1.usn}
                  percentage={s1.percentage}
                  totalBacklogs={s1.total_backlogs}
                  customPixelArt={s1.avatar_pixel_art}
                  size={42}
                />
                <div className="min-w-0 flex-1">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isObsidian
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    Student A
                  </span>
                  {selectableStudents.length > 0 ? (
                    <select
                      value={s1.usn}
                      onChange={(e) => handleSelectS1(e.target.value)}
                      className={`mt-1.5 block w-full text-xs font-bold rounded-xl p-2 border font-mono transition-colors ${
                        isObsidian
                          ? "bg-slate-900 border-slate-700 text-white"
                          : "bg-white border-slate-200 text-slate-900"
                      }`}
                    >
                      {selectableStudents.map((st) => (
                        <option key={st.usn} value={st.usn}>
                          {st.name} ({st.branch} • {st.usn})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <h3 className="font-bold text-sm mt-1 truncate">{s1.name}</h3>
                  )}
                  <p className="font-mono text-[11px] opacity-60 mt-0.5">{s1.usn} • {s1.branch}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg sm:text-xl font-black font-mono tabular-nums text-cyan-400">
                    {s1.percentage.toFixed(1)}%
                  </span>
                  <p className="text-[10px] opacity-60 font-mono">{s1.total_marks}/{s1.max_marks || 100} pts</p>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-800/40">
                <span className="opacity-70 text-[11px]">Pending Subjects:</span>
                <span
                  className={`font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                    viewer?.usn?.toUpperCase() === s1.usn?.toUpperCase()
                      ? s1.total_backlogs > 0
                        ? isObsidian
                          ? "bg-rose-950/30 text-rose-400 border-rose-800/40"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                        : isObsidian
                        ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/40"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : s1.has_pending_subjects === "Yes"
                      ? isObsidian
                        ? "bg-amber-950/30 text-amber-400 border-amber-800/40"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                      : isObsidian
                      ? "bg-slate-900 text-slate-400 border-slate-800"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {viewer?.usn?.toUpperCase() === s1.usn?.toUpperCase()
                    ? s1.total_backlogs === 0
                      ? "All Clear"
                      : `${s1.total_backlogs} Pending`
                    : s1.has_pending_subjects
                    ? s1.has_pending_subjects === "Yes"
                      ? "Pending: Yes"
                      : "All Clear"
                    : "Protected"}
                </span>
              </div>
            </div>

            {/* Student 2 Card */}
            <div
              className={`p-3.5 sm:p-4 rounded-2xl border ${
                isObsidian
                  ? "bg-indigo-950/15 border-indigo-800/40"
                  : "bg-indigo-50/40 border-indigo-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <Identicon
                  usn={s2.usn}
                  percentage={s2.percentage}
                  totalBacklogs={s2.total_backlogs}
                  customPixelArt={s2.avatar_pixel_art}
                  size={42}
                />
                <div className="min-w-0 flex-1">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isObsidian
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    Student B
                  </span>
                  {selectableStudents.length > 0 ? (
                    <select
                      value={s2.usn}
                      onChange={(e) => handleSelectS2(e.target.value)}
                      className={`mt-1.5 block w-full text-xs font-bold rounded-xl p-2 border font-mono transition-colors ${
                        isObsidian
                          ? "bg-slate-900 border-slate-700 text-white"
                          : "bg-white border-slate-200 text-slate-900"
                      }`}
                    >
                      {selectableStudents.map((st) => (
                        <option key={st.usn} value={st.usn}>
                          {st.name} ({st.branch} • {st.usn})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <h3 className="font-bold text-sm mt-1 truncate">{s2.name}</h3>
                  )}
                  <p className="font-mono text-[11px] opacity-60 mt-0.5">{s2.usn} • {s2.branch}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg sm:text-xl font-black font-mono tabular-nums text-indigo-400">
                    {s2.percentage.toFixed(1)}%
                  </span>
                  <p className="text-[10px] opacity-60 font-mono">{s2.total_marks}/{s2.max_marks || 100} pts</p>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-800/40">
                <span className="opacity-70 text-[11px]">Pending Subjects:</span>
                <span
                  className={`font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                    viewer?.usn?.toUpperCase() === s2.usn?.toUpperCase()
                      ? s2.total_backlogs > 0
                        ? isObsidian
                          ? "bg-rose-950/30 text-rose-400 border-rose-800/40"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                        : isObsidian
                        ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/40"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : s2.has_pending_subjects === "Yes"
                      ? isObsidian
                        ? "bg-amber-950/30 text-amber-400 border-amber-800/40"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                      : isObsidian
                      ? "bg-slate-900 text-slate-400 border-slate-800"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {viewer?.usn?.toUpperCase() === s2.usn?.toUpperCase()
                    ? s2.total_backlogs === 0
                      ? "All Clear"
                      : `${s2.total_backlogs} Pending`
                    : s2.has_pending_subjects
                    ? s2.has_pending_subjects === "Yes"
                      ? "Pending: Yes"
                      : "All Clear"
                    : "Protected"}
                </span>
              </div>
            </div>
          </div>

          {/* Key Difference Overview Banner */}
          <div
            className={`p-3 rounded-2xl border flex flex-wrap items-center justify-around gap-2 text-center text-xs ${
              isObsidian
                ? "bg-slate-900/60 border-slate-800/80"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div>
              <p className="opacity-50 font-semibold uppercase tracking-wider text-[9px]">Percentage Delta</p>
              <p className="text-xs sm:text-sm font-bold mt-0.5 font-mono tabular-nums">
                {pctDiff > 0 ? (
                  <span className="text-cyan-400 font-bold">{s1.name} ahead by +{pctDiff.toFixed(1)}%</span>
                ) : pctDiff < 0 ? (
                  <span className="text-indigo-400 font-bold">{s2.name} ahead by +{Math.abs(pctDiff).toFixed(1)}%</span>
                ) : (
                  <span className="opacity-60">Identical Percentage</span>
                )}
              </p>
            </div>
            <div className="h-7 w-px bg-slate-800 hidden sm:block" />
            <div>
              <p className="opacity-50 font-semibold uppercase tracking-wider text-[9px]">Total Marks Delta</p>
              <p className="text-xs sm:text-sm font-bold mt-0.5 font-mono tabular-nums">
                {marksDiff > 0 ? (
                  <span className="text-cyan-400 font-bold">+{marksDiff} Marks (Student A)</span>
                ) : marksDiff < 0 ? (
                  <span className="text-indigo-400 font-bold">+{Math.abs(marksDiff)} Marks (Student B)</span>
                ) : (
                  <span className="opacity-60">Equal Total Score</span>
                )}
              </p>
            </div>
          </div>

          {/* Subject-by-Subject Deep Dive */}
          <div>
            <h3 className="font-bold text-xs sm:text-sm mb-2.5">
              Subject-by-Subject Breakdown ({allSubjectCodes.length} Subjects)
            </h3>

            {allSubjectCodes.length === 0 ? (
              <div
                className={`p-6 text-center text-xs border rounded-2xl ${
                  isObsidian ? "bg-slate-900/40 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
              >
                No subject marks records found for these students. Make sure both have results scraped.
              </div>
            ) : (
              <div
                className={`border rounded-2xl overflow-hidden divide-y ${
                  isObsidian
                    ? "border-slate-800 divide-slate-800/80"
                    : "border-slate-200 divide-slate-100"
                }`}
              >
                {/* Desktop Table Header */}
                <div
                  className={`hidden sm:grid grid-cols-12 gap-2 p-2.5 text-[10px] font-bold uppercase tracking-wider ${
                    isObsidian
                      ? "bg-slate-900/80 text-slate-400"
                      : "bg-slate-100/70 text-slate-500"
                  }`}
                >
                  <div className="col-span-5">Subject</div>
                  <div className="col-span-3 text-center text-cyan-400">{s1.name} (A)</div>
                  <div className="col-span-3 text-center text-indigo-400">{s2.name} (B)</div>
                  <div className="col-span-1 text-right">Lead</div>
                </div>

                {allSubjectCodes.map((code) => {
                  const m1 = s1MarksMap.get(code);
                  const m2 = s2MarksMap.get(code);
                  const subjectName = m1?.subject_name || m2?.subject_name || code;
                  const score1 = m1 ? m1.total : null;
                  const score2 = m2 ? m2.total : null;
                  const lead = score1 !== null && score2 !== null ? score1 - score2 : null;

                  return (
                    <div
                      key={code}
                      className={`p-3 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center transition-colors ${
                        isObsidian ? "hover:bg-slate-900/40" : "hover:bg-slate-50/60"
                      }`}
                    >
                      {/* Subject Name & Code */}
                      <div className="col-span-5 mb-2 sm:mb-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold">{code}</span>
                          {(m1?.semester || m2?.semester) && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded border ${
                                isObsidian
                                  ? "bg-slate-800 text-slate-400 border-slate-700"
                                  : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}
                            >
                              Sem {m1?.semester || m2?.semester}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] opacity-70 line-clamp-1">{subjectName}</p>
                      </div>

                      {/* Student 1 Marks */}
                      <div
                        className={`col-span-3 flex sm:flex-col items-center justify-between sm:justify-center p-2 sm:p-0 rounded-xl mb-1 sm:mb-0 ${
                          isObsidian
                            ? "bg-cyan-950/20 sm:bg-transparent"
                            : "bg-blue-50/50 sm:bg-transparent"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-cyan-400 sm:hidden">Student A:</span>
                        {m1 ? (
                          <div className="text-center font-mono tabular-nums">
                            <span className="font-bold text-xs sm:text-sm">{m1.total}</span>
                            <span className="text-[10px] opacity-50 ml-1">
                              (Int: {m1.internal_marks}, Ext: {m1.external_marks})
                            </span>
                            <span
                              className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                m1.status === "P"
                                  ? isObsidian ? "text-emerald-400 bg-emerald-950/40" : "text-emerald-700 bg-emerald-50"
                                  : isObsidian ? "text-rose-400 bg-rose-950/40" : "text-rose-700 bg-rose-50"
                              }`}
                            >
                              {m1.status}
                            </span>
                          </div>
                        ) : (
                          <span className="opacity-40 text-xs italic">—</span>
                        )}
                      </div>

                      {/* Student 2 Marks */}
                      <div
                        className={`col-span-3 flex sm:flex-col items-center justify-between sm:justify-center p-2 sm:p-0 rounded-xl mb-1 sm:mb-0 ${
                          isObsidian
                            ? "bg-indigo-950/20 sm:bg-transparent"
                            : "bg-indigo-50/50 sm:bg-transparent"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-indigo-400 sm:hidden">Student B:</span>
                        {m2 ? (
                          <div className="text-center font-mono tabular-nums">
                            <span className="font-bold text-xs sm:text-sm">{m2.total}</span>
                            <span className="text-[10px] opacity-50 ml-1">
                              (Int: {m2.internal_marks}, Ext: {m2.external_marks})
                            </span>
                            <span
                              className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                m2.status === "P"
                                  ? isObsidian ? "text-emerald-400 bg-emerald-950/40" : "text-emerald-700 bg-emerald-50"
                                  : isObsidian ? "text-rose-400 bg-rose-950/40" : "text-rose-700 bg-rose-50"
                              }`}
                            >
                              {m2.status}
                            </span>
                          </div>
                        ) : (
                          <span className="opacity-40 text-xs italic">—</span>
                        )}
                      </div>

                      {/* Lead Badge */}
                      <div className="col-span-1 text-right flex items-center justify-end font-mono tabular-nums">
                        {lead !== null ? (
                          lead > 0 ? (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isObsidian
                                  ? "text-cyan-300 bg-cyan-950/40 border-cyan-800/40"
                                  : "text-blue-700 bg-blue-100 border-blue-200"
                              }`}
                            >
                              +{lead} A
                            </span>
                          ) : lead < 0 ? (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isObsidian
                                  ? "text-indigo-300 bg-indigo-950/40 border-indigo-800/40"
                                  : "text-indigo-700 bg-indigo-100 border-indigo-200"
                              }`}
                            >
                              +{Math.abs(lead)} B
                            </span>
                          ) : (
                            <span className="text-[10px] opacity-40 font-medium">Tie</span>
                          )
                        ) : (
                          <span className="opacity-30">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`px-4 sm:px-6 py-3 border-t flex justify-end ${
            isObsidian ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-100"
          }`}
        >
          <button
            onClick={() => {
              sfx.playMechanicalClick();
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 font-semibold text-xs shadow-sm transition-all active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400 cursor-pointer"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}
