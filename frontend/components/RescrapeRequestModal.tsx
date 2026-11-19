"use client";

import React, { useEffect, useState } from "react";
import {
  Student,
  RescrapeRequestRecord,
  submitRescrapeRequest,
  fetchRescrapeStatus,
} from "../lib/api";
import { IconClose, IconRotateCcw, IconShield } from "./Icons";
import { sfx } from "../lib/sfx";

interface RescrapeRequestModalProps {
  isOpen: boolean;
  student: Student | null;
  usn: string | null;
  isObsidian?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RescrapeRequestModal({
  isOpen,
  student,
  usn,
  isObsidian = false,
  onClose,
  onSuccess,
}: RescrapeRequestModalProps) {
  const targetUsn = (usn || student?.usn || "").trim().toUpperCase();

  const [requestType, setRequestType] = useState<string>("REVALUATION");
  const [targetSemester, setTargetSemester] = useState<string>("1");
  const [subjectCodes, setSubjectCodes] = useState<string>("");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const [checkingStatus, setCheckingStatus] = useState<boolean>(true);
  const [pendingRequest, setPendingRequest] = useState<RescrapeRequestRecord | null>(null);
  const [lastRequest, setLastRequest] = useState<RescrapeRequestRecord | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Check if this USN already has a pending or in-progress request (anti-spam)
  useEffect(() => {
    if (!isOpen || !targetUsn) return;

    let isMounted = true;
    setCheckingStatus(true);
    setErrorMsg("");
    setSuccessMsg("");

    fetchRescrapeStatus(targetUsn)
      .then((res) => {
        if (!isMounted) return;
        setPendingRequest(res.pending_request || null);
        setLastRequest(res.last_request || null);

        // Preselect intelligent defaults based on student backlogs
        if (student && student.total_backlogs > 0) {
          setRequestType("REVALUATION");
          const failedCodes = (student.marks || [])
            .filter((m) => m.status === "F" || m.status === "A")
            .map((m) => m.subject_code)
            .join(", ");
          if (failedCodes) setSubjectCodes(failedCodes);
        } else {
          setRequestType("MISSING_SEMESTER");
          setTargetSemester("2");
        }
      })
      .catch((err) => {
        console.error("Could not check rescrape status", err);
      })
      .finally(() => {
        if (isMounted) setCheckingStatus(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetUsn, student]);

  if (!isOpen || !targetUsn) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsn) return;

    setErrorMsg("");
    setSuccessMsg("");
    setIsSubmitting(true);
    sfx.playMechanicalClick();

    try {
      const res = await submitRescrapeRequest({
        usn: targetUsn,
        name: student?.name || "",
        branch: student?.branch || "",
        request_type: requestType,
        target_semester: targetSemester,
        subject_codes: subjectCodes.trim(),
        custom_url: customUrl.trim(),
        message: message.trim(),
      });

      setSuccessMsg(res.message);
      setPendingRequest(res.request);
      sfx.playSonarChime();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit request";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-2xl sm:rounded-3xl border shadow-2xl overflow-hidden my-auto transition-all ${
          isObsidian
            ? "bg-[#0b0d11] border-slate-800 text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isObsidian ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                isObsidian
                  ? "bg-cyan-950/40 border-cyan-800/40 text-cyan-400"
                  : "bg-blue-50 border-blue-200 text-blue-700"
              }`}
            >
              <IconRotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Request Marksheet Re-scrape</h2>
              <p className="text-[11px] opacity-60 font-mono">
                {targetUsn} {student?.name ? `• ${student.name}` : ""}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sfx.playMechanicalClick();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {checkingStatus ? (
            <div className="py-8 text-center text-xs opacity-60 flex flex-col items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              <span>Checking queue status for {targetUsn}...</span>
            </div>
          ) : pendingRequest ? (
            /* Anti-Spam Active Request State */
            <div className="space-y-4 py-2">
              <div
                className={`p-4 rounded-2xl border ${
                  isObsidian
                    ? "bg-amber-950/20 border-amber-800/50 text-amber-200"
                    : "bg-amber-50/80 border-amber-200 text-amber-900"
                } space-y-2.5`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Request Already Pending in Queue
                  </span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  You already submitted an update request for <strong>{targetUsn}</strong>. To
                  prevent spamming, only one active request can be pending at a time. The
                  administrator has your request in queue and will re-scrape your updated results.
                </p>
              </div>

              {/* Request Metadata Details */}
              <div
                className={`p-3.5 rounded-2xl border text-xs space-y-2 font-mono ${
                  isObsidian ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex justify-between items-center text-[11px]">
                  <span className="opacity-60">Reason:</span>
                  <span className="font-semibold">{pendingRequest.request_type}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="opacity-60">Target Semester:</span>
                  <span className="font-semibold">Semester {pendingRequest.target_semester}</span>
                </div>
                {pendingRequest.subject_codes && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="opacity-60">Subject Code(s):</span>
                    <span className="font-semibold">{pendingRequest.subject_codes}</span>
                  </div>
                )}
                {pendingRequest.message && (
                  <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 text-[11px] font-sans">
                    <span className="opacity-60 block text-[10px] uppercase font-mono mb-0.5">Note:</span>
                    <p className="opacity-80 italic">&quot;{pendingRequest.message}&quot;</p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl text-xs font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity"
                >
                  Understood, Return to Marksheet
                </button>
              </div>
            </div>
          ) : (
            /* Submission Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Reason Selection */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-70 mb-2">
                  What would you like the admin to update?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    {
                      id: "REVALUATION",
                      title: "Passed in Revaluation",
                      desc: "Cleared backlog or improved marks in reval",
                    },
                    {
                      id: "MISSING_SEMESTER",
                      title: "Missing Semester Result",
                      desc: "Have Sem 1, need Sem 2 scraped (or vice versa)",
                    },
                    {
                      id: "RE_EXAM",
                      title: "Makeup / Re-exam Passed",
                      desc: "Cleared backlog in supplementary exams",
                    },
                    {
                      id: "CORRECTION",
                      title: "Correction / Disparity",
                      desc: "Marks disparity or other correction",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        sfx.playMechanicalClick();
                        setRequestType(opt.id);
                        if (opt.id === "MISSING_SEMESTER") {
                          setTargetSemester("2");
                        }
                      }}
                      className={`p-2.5 text-left rounded-xl border transition-all text-xs ${
                        requestType === opt.id
                          ? isObsidian
                            ? "bg-cyan-950/30 border-cyan-500/80 text-white"
                            : "bg-blue-50/70 border-blue-500 text-slate-900 ring-1 ring-blue-500"
                          : isObsidian
                          ? "bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-900/70"
                          : "bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <p className="font-semibold text-[11px] sm:text-xs">{opt.title}</p>
                      <p className="text-[10px] opacity-60 mt-0.5 leading-snug">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Semester */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-70 mb-1.5">
                  Target Semester to Scrape
                </label>
                <div className="flex items-center gap-2">
                  {["1", "2", "all"].map((sem) => (
                    <button
                      key={sem}
                      type="button"
                      onClick={() => {
                        sfx.playMechanicalClick();
                        setTargetSemester(sem);
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        targetSemester === sem
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                          : "bg-transparent border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100"
                      }`}
                    >
                      {sem === "all" ? "Both Semesters" : `Semester ${sem}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Codes */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                    Subject Code(s) <span className="font-normal opacity-50">(Optional)</span>
                  </label>
                  <span className="text-[10px] opacity-50 font-mono">e.g. 21MAT11, 21PHY12</span>
                </div>
                <input
                  type="text"
                  value={subjectCodes}
                  onChange={(e) => setSubjectCodes(e.target.value)}
                  placeholder="21MAT11, 21PHY12"
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono transition-colors focus:outline-none focus:ring-2 ${
                    isObsidian
                      ? "bg-slate-900/60 border-slate-800 focus:ring-cyan-500"
                      : "bg-white border-slate-200 focus:ring-slate-900"
                  }`}
                />
              </div>

              {/* VTU Result / Reval URL */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                    VTU Portal Link <span className="font-normal opacity-50">(Optional)</span>
                  </label>
                  <span className="text-[10px] opacity-50 font-mono">Reval or Sem 2 link</span>
                </div>
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://results.vtu.ac.in/..."
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono transition-colors focus:outline-none focus:ring-2 ${
                    isObsidian
                      ? "bg-slate-900/60 border-slate-800 focus:ring-cyan-500"
                      : "bg-white border-slate-200 focus:ring-slate-900"
                  }`}
                />
              </div>

              {/* Note / Message */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-70 mb-1.5">
                  Note to Admin <span className="font-normal opacity-50">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Passed 21MAT11 in revaluation with 42 marks, please re-scrape."
                  className={`w-full px-3 py-2 rounded-xl border text-xs transition-colors focus:outline-none focus:ring-2 ${
                    isObsidian
                      ? "bg-slate-900/60 border-slate-800 focus:ring-cyan-500"
                      : "bg-white border-slate-200 focus:ring-slate-900"
                  }`}
                />
              </div>

              {/* Alert / Error / Success Messages */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-transform active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center gap-2"
                >
                  <IconRotateCcw className={`w-3.5 h-3.5 ${isSubmitting ? "animate-spin" : ""}`} />
                  <span>{isSubmitting ? "Submitting Request..." : "Send Re-scrape Request to Admin"}</span>
                </button>
                <p className="text-[10px] opacity-50 text-center mt-2 leading-relaxed">
                  Rate-limited to 1 active request per USN to protect scraper server resources.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
