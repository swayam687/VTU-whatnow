"use client";

import React, { useEffect, useState } from "react";
import {
  Student,
  AuthSession,
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
  studentSession: AuthSession | null;
  isObsidian?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RescrapeRequestModal({
  isOpen,
  student,
  usn,
  studentSession,
  isObsidian = false,
  onClose,
  onSuccess,
}: RescrapeRequestModalProps) {
  const targetUsn = (usn || student?.usn || "").trim().toUpperCase();
  const sessionUsn = (studentSession?.usn || "").trim().toUpperCase();
  const isOwner = Boolean(studentSession && targetUsn === sessionUsn);

  const [requestType, setRequestType] = useState<string>("REVALUATION");
  const [targetSemester, setTargetSemester] = useState<string>("1");
  const [vtuLink, setVtuLink] = useState<string>("");

  const [checkingStatus, setCheckingStatus] = useState<boolean>(true);
  const [pendingRequest, setPendingRequest] = useState<RescrapeRequestRecord | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Check if this USN already has a pending or in-progress request (anti-spam)
  useEffect(() => {
    if (!isOpen || !targetUsn || !isOwner) return;

    let isMounted = true;
    setCheckingStatus(true);
    setErrorMsg("");
    setSuccessMsg("");

    fetchRescrapeStatus(targetUsn)
      .then((res) => {
        if (!isMounted) return;
        setPendingRequest(res.pending_request || null);

        // Preselect intelligent defaults based on student backlogs
        if (student && student.total_backlogs > 0) {
          setRequestType("REVALUATION");
          setTargetSemester("1");
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
  }, [isOpen, targetUsn, student, isOwner]);

  if (!isOpen || !targetUsn) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsn || !isOwner) return;

    setErrorMsg("");
    setSuccessMsg("");
    setIsSubmitting(true);
    sfx.playMechanicalClick();

    try {
      const res = await submitRescrapeRequest(
        {
          usn: targetUsn,
          name: student?.name || studentSession?.name || "",
          branch: student?.branch || studentSession?.branch || "",
          request_type: requestType,
          target_semester: requestType === "DATA_DELETION" ? "all" : targetSemester,
          vtu_link: requestType !== "DATA_DELETION" ? (vtuLink.trim() || undefined) : undefined,
        },
        studentSession?.token
      );

      const finalMsg =
        requestType === "DATA_DELETION"
          ? "Deletion request sent to admin. Your data will be deleted in 24 hours."
          : res.message || "Update request submitted to admin!";

      setSuccessMsg(finalMsg);
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
              <h2 className="text-sm font-bold tracking-tight">Request Marksheet Update</h2>
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
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {!isOwner ? (
            /* Non-Owner Block: Only the verified account owner can request for their own USN */
            <div className="py-6 text-center space-y-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto border ${
                  isObsidian ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-600"
                }`}
              >
                <IconShield className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold">Account Holder Only</p>
              <p className="text-xs opacity-65 max-w-sm mx-auto leading-relaxed">
                Only the verified owner of <strong>{targetUsn}</strong> can submit re-scrape requests for their marksheet. You cannot submit requests for other students.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 shadow-sm cursor-pointer transition-all active:scale-[0.98]"
                >
                  Close
                </button>
              </div>
            </div>
          ) : checkingStatus ? (
            <div className="py-8 text-center text-xs opacity-60 flex flex-col items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              <span>Checking queue status for your profile...</span>
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
                  You already submitted an update request for your marksheet. To prevent spamming, only one active request can be pending at a time. The administrator has your request in queue and will re-scrape your updated results.
                </p>
              </div>

              {/* Request Metadata Details */}
              <div
                className={`p-3.5 rounded-2xl border text-xs space-y-2 font-mono ${
                  isObsidian ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex justify-between items-center text-[11px]">
                  <span className="opacity-60">Update Reason:</span>
                  <span className="font-semibold">
                    {pendingRequest.request_type === "REVALUATION"
                      ? "Passed in Revaluation"
                      : pendingRequest.request_type === "MISSING_SEMESTER"
                      ? "Missing Semester Result"
                      : pendingRequest.request_type === "RE_EXAM"
                      ? "Makeup / Re-exam Passed"
                      : pendingRequest.request_type === "DATA_DELETION"
                      ? "Request Data Deletion"
                      : "Marksheet Update"}
                  </span>
                </div>
                {pendingRequest.target_semester && pendingRequest.request_type !== "DATA_DELETION" && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="opacity-60">Target Semester:</span>
                    <span className="font-semibold">
                      {pendingRequest.target_semester === "all" ? "Both Semesters" : `Semester ${pendingRequest.target_semester}`}
                    </span>
                  </div>
                )}
                {(pendingRequest.vtu_link || pendingRequest.custom_url) && (
                  <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-700/20">
                    <span className="opacity-60">Result Link:</span>
                    <a
                      href={pendingRequest.vtu_link || pendingRequest.custom_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-cyan-400 hover:underline truncate max-w-[200px]"
                    >
                      {pendingRequest.vtu_link || pendingRequest.custom_url}
                    </a>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  Understood, Return to Marksheet
                </button>
              </div>
            </div>
          ) : (
            /* Clean Questionnaire Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Question 1: What would you like the admin to update? */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-70 mb-2">
                  What would you like the admin to update?
                </label>
                <div className="grid grid-cols-1 gap-2">
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
                      id: "DATA_DELETION",
                      title: "Request Data Deletion",
                      desc: "Request administrator to hide your academic profile from public view",
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
                      className={`p-3 text-left rounded-xl border transition-all text-xs flex items-center justify-between cursor-pointer ${
                        requestType === opt.id
                          ? isObsidian
                            ? "bg-cyan-950/30 border-cyan-500/80 text-white ring-1 ring-cyan-500/50"
                            : "bg-blue-50/70 border-blue-500 text-slate-900 ring-1 ring-blue-500"
                          : isObsidian
                          ? "bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-900/70"
                          : "bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-xs sm:text-sm">{opt.title}</p>
                        <p className="text-[11px] opacity-65 mt-0.5 leading-snug">{opt.desc}</p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-3 ${
                          requestType === opt.id
                            ? "border-blue-600 bg-blue-600 dark:border-cyan-400 dark:bg-cyan-400"
                            : "border-slate-300 dark:border-slate-700"
                        }`}
                      >
                        {requestType === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional VTU Result Link Input for all update requests */}
              {requestType !== "DATA_DELETION" && (
                <div
                  className={`p-3.5 rounded-2xl border space-y-1.5 transition-all ${
                    isObsidian
                      ? "bg-slate-900/60 border-slate-800"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <label className="block text-xs font-semibold">
                    Paste VTU Result Link{" "}
                    <span className="text-[10px] font-normal opacity-60">
                      (Optional but recommended)
                    </span>{" "}
                    or write a note to admin
                  </label>
                  <input
                    type="text"
                    value={vtuLink}
                    onChange={(e) => setVtuLink(e.target.value)}
                    placeholder="https://results.vtu.ac.in/.../index.php or e.g. sem-1 reval and sem-2 make up reval"
                    className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-mono transition-all ${
                      isObsidian
                        ? "bg-slate-950/60 border-slate-700 text-white focus:border-cyan-400"
                        : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    }`}
                  />
                  <p className="text-[11px] opacity-65 leading-relaxed">
                    If you have a specific revaluation, makeup, or results portal link, paste it here. Admins will read the note and take action accordingly.
                  </p>
                </div>
              )}

              {/* Question 2: Target Semester to Update or Data Deletion Notice */}
              {requestType === "DATA_DELETION" ? (
                <div
                  className={`p-3.5 rounded-2xl border text-xs leading-relaxed space-y-1 ${
                    isObsidian
                      ? "bg-rose-950/20 border-rose-800/40 text-rose-300"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    <IconShield className="w-3.5 h-3.5 text-rose-400" />
                    <span>Profile Removal Notice</span>
                  </p>
                  <p className="text-[11px] opacity-85 leading-relaxed">
                    Submitting this request notifies the administrator to remove your profile from all public search results, campus rankings, and peer comparisons within 24 hours.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider opacity-70 mb-1.5">
                    Target Semester to Update
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "1", label: "Semester 1" },
                      { id: "2", label: "Semester 2" },
                      { id: "all", label: "Both Semesters" },
                    ].map((sem) => (
                      <button
                        key={sem.id}
                        type="button"
                        onClick={() => {
                          sfx.playMechanicalClick();
                          setTargetSemester(sem.id);
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                          targetSemester === sem.id
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm border-transparent font-bold"
                            : isObsidian
                            ? "bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-900/70"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {sem.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Alert / Error / Success Messages */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-medium">{successMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !requestType || (requestType !== "DATA_DELETION" && !targetSemester)}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 transition-transform active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-sm flex items-center justify-center gap-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400"
                >
                  <IconRotateCcw className={`w-3.5 h-3.5 ${isSubmitting ? "animate-spin" : ""}`} />
                  <span>
                    {isSubmitting
                      ? "Submitting Request..."
                      : requestType === "DATA_DELETION"
                      ? "Submit Data Deletion Request"
                      : "Submit Request to Admin"}
                  </span>
                </button>
                <p className="text-[10px] opacity-50 text-center mt-2 leading-relaxed">
                  Only 1 active request per USN is permitted to protect scraper server resources.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
