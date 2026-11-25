"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Student,
  AuthSession,
  StudentPortalOption,
  fetchAvailablePortals,
  startStudentUpdate,
  refreshStudentUpdateCaptcha,
  submitStudentUpdateCaptcha,
} from "../lib/api";
import { IconClose, IconRotateCcw, IconShield, IconCheck, IconLock } from "./Icons";
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

type ModalStep = "SELECT" | "CONNECTING" | "CAPTCHA" | "VERIFYING" | "SUCCESS";
type ActionType = "UPDATE_RECORD" | "DELETE_REQUEST" | "ISSUE_REPORT";

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

  const [step, setStep] = useState<ModalStep>("SELECT");
  const [actionType, setActionType] = useState<ActionType>("UPDATE_RECORD");
  const [issueDescription, setIssueDescription] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const [portals, setPortals] = useState<StudentPortalOption[]>([]);
  const [loadingPortals, setLoadingPortals] = useState<boolean>(true);
  const [selectedPortalId, setSelectedPortalId] = useState<number | null>(null);

  // Live Verification Session state
  const [sessionId, setSessionId] = useState<string>("");
  const [captchaBase64, setCaptchaBase64] = useState<string>("");
  const [captchaInput, setCaptchaInput] = useState<string>("");
  const [selectedHeading, setSelectedHeading] = useState<string>("");
  const [isRefreshingCaptcha, setIsRefreshingCaptcha] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // 1-minute server underload queue timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load available portals from backend whenever modal opens
  useEffect(() => {
    if (!isOpen || !isOwner) return;

    let isMounted = true;
    setLoadingPortals(true);
    setStep("SELECT");
    setActionType("UPDATE_RECORD");
    setIssueDescription("");
    setSuccessMessage("");
    setErrorMsg("");
    setCaptchaInput("");
    setSessionId("");
    setCaptchaBase64("");

    fetchAvailablePortals()
      .then((data) => {
        if (!isMounted) return;
        setPortals(data);
        if (data.length > 0) {
          const defaultOpt = data.find((p) => p.is_default) || data[0];
          setSelectedPortalId(defaultOpt.id);
          setSelectedHeading(defaultOpt.title);
        }
      })
      .catch((err) => {
        console.error("Could not load examination portals", err);
      })
      .finally(() => {
        if (isMounted) setLoadingPortals(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, isOwner]);

  // Auto-focus captcha input on transition to CAPTCHA step
  useEffect(() => {
    if (step === "CAPTCHA") {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [step]);

  if (!isOpen || !targetUsn) return null;

  // Step 1 -> Step 2: Start session
  const handleStartUpdate = async () => {
    if (actionType === "UPDATE_RECORD" && !selectedPortalId) {
      setErrorMsg("Please select an examination heading to update.");
      return;
    }

    if (actionType === "ISSUE_REPORT" && (!issueDescription.trim() || issueDescription.trim().length < 5)) {
      setErrorMsg("Please describe what went wrong (minimum 5 characters).");
      return;
    }

    setErrorMsg("");
    setStep("CONNECTING");
    sfx.playMechanicalClick();

    try {
      const res = await startStudentUpdate(
        {
          semesterLinkId: actionType === "UPDATE_RECORD" ? selectedPortalId : null,
          actionType,
          description: issueDescription.trim() || undefined,
        },
        studentSession?.token
      );

      if (res.server_busy) {
        setCooldownSeconds(res.retry_after || 60);
        setErrorMsg(res.message || "Service is under load. Server is currently serving 5 users. Please wait 1 minute.");
        setStep("SELECT");
        return;
      }

      if (res.ok && res.session_id && res.captcha_base64) {
        setSessionId(res.session_id);
        setCaptchaBase64(res.captcha_base64);
        if (res.heading) setSelectedHeading(res.heading);
        setCaptchaInput("");
        setStep("CAPTCHA");
        sfx.playSonarChime();
      } else {
        throw new Error(res.message || "Failed to initialize verification session.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to reach verification portal.";
      if (
        msg.toLowerCase().includes("under load") ||
        msg.toLowerCase().includes("serving 5") ||
        msg.toLowerCase().includes("wait 1 minute")
      ) {
        setCooldownSeconds(60);
        setErrorMsg("Service is under load. Server is currently serving 5 users. Please wait 1 minute.");
      } else {
        setErrorMsg(msg);
      }
      setStep("SELECT");
    }
  };

  // Refresh captcha button
  const handleRefreshCaptcha = async () => {
    if (!sessionId || isRefreshingCaptcha) return;
    setIsRefreshingCaptcha(true);
    sfx.playMechanicalClick();
    try {
      const res = await refreshStudentUpdateCaptcha(sessionId);
      if (res.ok && res.captcha_base64) {
        setCaptchaBase64(res.captcha_base64);
        setCaptchaInput("");
        setErrorMsg("");
        inputRef.current?.focus();
      }
    } catch {
      // ignore
    } finally {
      setIsRefreshingCaptcha(false);
    }
  };

  // Step 3 -> Step 4: Submit captcha
  const handleSubmitCaptcha = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = captchaInput.trim();
    if (!cleanCode || cleanCode.length < 2) {
      setErrorMsg("Please enter the verification code displayed.");
      return;
    }

    setErrorMsg("");
    setStep("VERIFYING");
    sfx.playMechanicalClick();

    try {
      const res = await submitStudentUpdateCaptcha(
        sessionId,
        cleanCode,
        studentSession?.token,
        actionType,
        issueDescription.trim() || undefined
      );

      if (res.ok) {
        setSuccessMessage(res.message);
        setStep("SUCCESS");
        sfx.playSonarChime();
        if (onSuccess) onSuccess();
      } else {
        // Wrong captcha or failed validation: reload captcha and ask again
        if (res.new_captcha_base64) {
          setCaptchaBase64(res.new_captcha_base64);
        }
        setCaptchaInput("");
        setErrorMsg(res.message || "Incorrect verification code. A new code has been loaded. Please try again.");
        setStep("CAPTCHA");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification request failed.";
      setErrorMsg(msg);
      setStep("CAPTCHA");
    }
  };

  return (
    <div
      onClick={step === "VERIFYING" ? undefined : onClose}
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
                step === "SUCCESS"
                  ? isObsidian
                    ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-400"
                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : isObsidian
                  ? "bg-cyan-950/40 border-cyan-800/40 text-cyan-400"
                  : "bg-blue-50 border-blue-200 text-blue-700"
              }`}
            >
              {step === "SUCCESS" ? (
                <IconCheck className="w-4 h-4" />
              ) : (
                <IconRotateCcw className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                {step === "CAPTCHA" || step === "VERIFYING"
                  ? "Security Verification"
                  : step === "SUCCESS"
                  ? actionType === "DELETE_REQUEST"
                    ? "Deletion Request Sent"
                    : actionType === "ISSUE_REPORT"
                    ? "Ticket Created"
                    : "Record Updated"
                  : actionType === "DELETE_REQUEST"
                  ? "Request Profile Deletion"
                  : actionType === "ISSUE_REPORT"
                  ? "Report Marksheet Issue"
                  : "Update Examination Record"}
              </h2>
              <p className="text-[11px] opacity-60 font-mono">
                {targetUsn} {student?.name ? `• ${student.name}` : ""}
              </p>
            </div>
          </div>

          {step !== "VERIFYING" && (
            <button
              onClick={() => {
                sfx.playMechanicalClick();
                onClose();
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
            >
              <IconClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {!isOwner ? (
            /* Non-Owner Block: Only verified owner can update their record */
            <div className="py-6 text-center space-y-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto border ${
                  isObsidian
                    ? "bg-white/5 border-white/10 text-slate-300"
                    : "bg-slate-100 border-slate-200 text-slate-600"
                }`}
              >
                <IconShield className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold">Account Holder Only</p>
              <p className="text-xs opacity-65 max-w-sm mx-auto leading-relaxed">
                Only the verified owner of <strong>{targetUsn}</strong> can initiate record updates.
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
          ) : step === "SELECT" ? (
            /* Step 1: Select Action & Options */
            <div className="space-y-4">
              {/* Action Mode Segmented Switcher */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playMechanicalClick();
                    setActionType("UPDATE_RECORD");
                    setErrorMsg("");
                  }}
                  className={`py-2 px-2 rounded-lg font-medium transition-all text-center cursor-pointer ${
                    actionType === "UPDATE_RECORD"
                      ? isObsidian
                        ? "bg-slate-800 text-cyan-400 font-bold shadow-xs"
                        : "bg-white text-blue-600 font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Update Record
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sfx.playMechanicalClick();
                    setActionType("DELETE_REQUEST");
                    setErrorMsg("");
                  }}
                  className={`py-2 px-2 rounded-lg font-medium transition-all text-center cursor-pointer ${
                    actionType === "DELETE_REQUEST"
                      ? isObsidian
                        ? "bg-slate-800 text-rose-400 font-bold shadow-xs"
                        : "bg-white text-rose-600 font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Delete Request
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sfx.playMechanicalClick();
                    setActionType("ISSUE_REPORT");
                    setErrorMsg("");
                  }}
                  className={`py-2 px-2 rounded-lg font-medium transition-all text-center cursor-pointer ${
                    actionType === "ISSUE_REPORT"
                      ? isObsidian
                        ? "bg-slate-800 text-amber-400 font-bold shadow-xs"
                        : "bg-white text-amber-600 font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Something Wrong
                </button>
              </div>

              {/* Mode 1: Update Record by Examination Portal */}
              {actionType === "UPDATE_RECORD" && (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <label className="block text-[11px] font-bold uppercase tracking-wider opacity-70">
                    Select Examination Record to Update
                  </label>
                  <p className="text-xs opacity-65 leading-relaxed">
                    Choose the examination portal heading corresponding to your recent results or revaluation:
                  </p>

                  {loadingPortals ? (
                    <div className="py-8 text-center text-xs opacity-60 flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      <span>Loading available examination portals...</span>
                    </div>
                  ) : portals.length === 0 ? (
                    <div
                      className={`p-4 rounded-2xl border text-xs text-center opacity-70 ${
                        isObsidian ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      No examination portal links have been configured by the administrator yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
                      {portals.map((p) => {
                        const isSelected = selectedPortalId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              sfx.playMechanicalClick();
                              setSelectedPortalId(p.id);
                              setSelectedHeading(p.title);
                              setErrorMsg("");
                            }}
                            className={`p-3 text-left rounded-xl border transition-all text-xs flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? isObsidian
                                  ? "bg-cyan-950/30 border-cyan-500/80 text-white ring-1 ring-cyan-500/50"
                                  : "bg-blue-50 border-blue-500/80 text-blue-950 ring-1 ring-blue-500/30"
                                : isObsidian
                                ? "bg-slate-900/40 border-slate-800/80 text-slate-300 hover:border-slate-700"
                                : "bg-slate-50/70 border-slate-200/80 text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-xs truncate">{p.title}</p>
                              <p className="text-[10px] opacity-60 font-mono mt-0.5">
                                Semester {p.semester} • Results Portal
                              </p>
                            </div>

                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-3 ${
                                isSelected
                                  ? "border-blue-600 bg-blue-600 dark:border-cyan-400 dark:bg-cyan-400"
                                  : "border-slate-300 dark:border-slate-700"
                              }`}
                            >
                              {isSelected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Mode 2: Delete Request */}
              {actionType === "DELETE_REQUEST" && (
                <div className="space-y-3 p-4 rounded-2xl border bg-rose-500/5 border-rose-500/20 text-xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400 font-bold">
                    <IconShield className="w-4 h-4" />
                    <span>Request Profile Deletion & Removal</span>
                  </div>
                  <p className="opacity-80 leading-relaxed">
                    Submit a formal deletion request to the administrator. Once reviewed, your profile and marksheet records will be removed from the public portal.
                  </p>
                  <div className="p-2.5 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-300">
                    💡 A verification captcha is required to confirm account ownership and generate a deletion ticket for the admin.
                  </div>
                </div>
              )}

              {/* Mode 3: Something Went Wrong / Issue Report */}
              {actionType === "ISSUE_REPORT" && (
                <div className="space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold uppercase tracking-wider opacity-70">
                      Describe What Went Wrong
                    </label>
                    <span className="text-[10px] opacity-50 font-mono">Required</span>
                  </div>
                  <textarea
                    rows={3}
                    value={issueDescription}
                    onChange={(e) => {
                      setIssueDescription(e.target.value);
                      setErrorMsg("");
                    }}
                    placeholder="e.g. Marksheet updated wrongly, grade mismatch in subjects, please fix it..."
                    className={`w-full p-3 rounded-xl border text-xs outline-none transition-all resize-none leading-relaxed ${
                      isObsidian
                        ? "bg-slate-950/60 border-slate-700 text-white focus:border-amber-400"
                        : "bg-white border-slate-300 text-slate-900 focus:border-amber-500"
                    }`}
                  />
                  <p className="text-[11px] opacity-60 leading-normal">
                    Please describe the specific issue. An administrative ticket will be generated with your remarks.
                  </p>
                </div>
              )}

              {/* High Load Cooldown Banner */}
              {cooldownSeconds > 0 && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1.5 animate-in fade-in ${
                    isObsidian
                      ? "bg-amber-950/30 border-amber-800/40 text-amber-200"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span className="font-semibold">Service Under Load</span>
                    </span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/20 font-semibold tabular-nums">
                      0:{String(cooldownSeconds).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="opacity-80">
                    Server is currently serving 5 active users. Please wait 1 minute.
                  </p>
                </div>
              )}

              {errorMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    isObsidian
                      ? "bg-rose-950/30 border-rose-800/40 text-rose-300"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  {errorMsg}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  disabled={
                    cooldownSeconds > 0 ||
                    (actionType === "UPDATE_RECORD" && (loadingPortals || !selectedPortalId)) ||
                    (actionType === "ISSUE_REPORT" && (!issueDescription.trim() || issueDescription.trim().length < 5))
                  }
                  onClick={handleStartUpdate}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 disabled:opacity-50 transition-all cursor-pointer shadow-sm active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <IconLock className="w-3.5 h-3.5" />
                  <span>
                    {cooldownSeconds > 0
                      ? `Please wait (${cooldownSeconds}s)`
                      : "Verify to create ticket"}
                  </span>
                </button>
              </div>
            </div>
          ) : step === "CONNECTING" ? (
            /* Step 2: Establishing Session Loading State */
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold">Connecting to verification portal...</p>
                <p className="text-xs opacity-60">Preparing ticket verification session. Please wait.</p>
              </div>
            </div>
          ) : step === "CAPTCHA" ? (
            /* Step 3: Interactive Captcha Verification */
            <form onSubmit={handleSubmitCaptcha} className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs opacity-85 leading-relaxed font-medium">
                  Verify and creating ticket for admin to see
                </p>
                <p className="text-[11px] opacity-60 leading-relaxed">
                  Please solve this captcha to verify your identity and generate your request ticket:
                </p>
              </div>

              {/* Captcha Image Container */}
              <div
                className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2.5 ${
                  isObsidian
                    ? "bg-slate-950/60 border-slate-800"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="relative group">
                  {captchaBase64 ? (
                    <img
                      src={`data:image/png;base64,${captchaBase64}`}
                      alt="Verification Captcha"
                      className="h-12 object-contain rounded-lg border border-slate-700/30 shadow-xs"
                    />
                  ) : (
                    <div className="h-12 w-36 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg flex items-center justify-center text-xs opacity-60">
                      Loading code...
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleRefreshCaptcha}
                    disabled={isRefreshingCaptcha}
                    title="Refresh verification code"
                    className="absolute -top-2 -right-2 p-1.5 rounded-full bg-slate-900 border border-slate-700 text-white dark:bg-white dark:text-slate-900 dark:border-slate-300 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <IconRotateCcw
                      className={`w-3.5 h-3.5 ${isRefreshingCaptcha ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
                <span className="text-[11px] opacity-60 font-mono">
                  Click refresh icon if code is unreadable
                </span>
              </div>

              {/* Captcha Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider opacity-70">
                    Enter Verification Code
                  </label>
                  <span className="text-[10px] font-mono text-cyan-400 font-medium">
                    Case-Sensitive (a-z & A-Z)
                  </span>
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  maxLength={10}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={captchaInput}
                  onChange={(e) => {
                    setCaptchaInput(e.target.value);
                    setErrorMsg("");
                  }}
                  placeholder="e.g. 5k9P2"
                  className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none font-mono tracking-widest text-center font-bold transition-all ${
                    isObsidian
                      ? "bg-slate-950/60 border-slate-700 text-white focus:border-cyan-400"
                      : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                  }`}
                />
              </div>

              {cooldownSeconds > 0 && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1.5 animate-in fade-in ${
                    isObsidian
                      ? "bg-amber-950/30 border-amber-800/40 text-amber-200"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span className="font-semibold">Service Under Load</span>
                    </span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/20 font-semibold tabular-nums">
                      0:{String(cooldownSeconds).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="opacity-80">
                    Server is currently serving 5 active users. Please wait 1 minute.
                  </p>
                </div>
              )}

              {errorMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs leading-snug flex items-center gap-2 ${
                    isObsidian
                      ? "bg-rose-950/30 border-rose-800/40 text-rose-300"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playMechanicalClick();
                    setStep("SELECT");
                    setErrorMsg("");
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-700/50 hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!captchaInput.trim()}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 disabled:opacity-50 transition-all cursor-pointer shadow-sm active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <IconCheck className="w-3.5 h-3.5" />
                  <span>Verify to create ticket</span>
                </button>
              </div>
            </form>
          ) : step === "VERIFYING" ? (
            /* Step 4: Loading State while marks are fetched */
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold">Creating a ticket for admin to view and update record...</p>
                <p className="text-xs opacity-60">Please do not close this window.</p>
              </div>
            </div>
          ) : (
            /* Step 5: Success Prompt */
            <div className="py-6 text-center space-y-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border ${
                  actionType === "DELETE_REQUEST"
                    ? isObsidian
                      ? "bg-rose-950/40 border-rose-800/50 text-rose-400"
                      : "bg-rose-50 border-rose-200 text-rose-700"
                    : isObsidian
                    ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-400"
                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                }`}
              >
                <IconCheck className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold">
                  {actionType === "DELETE_REQUEST"
                    ? "Deletion Request Submitted"
                    : actionType === "ISSUE_REPORT"
                    ? "Ticket Created"
                    : "Admin updated your record"}
                </h3>
                <p className="text-xs opacity-75 max-w-sm mx-auto leading-relaxed">
                  {actionType === "DELETE_REQUEST"
                    ? "deletion request sent to the admin ur profile will be removed from the portal."
                    : actionType === "ISSUE_REPORT"
                    ? successMessage || "Ticket created for admin to view and resolve your issue."
                    : "Refresh the website to see the updated results."}
                </p>
              </div>

              <div className="pt-2">
                {actionType === "UPDATE_RECORD" ? (
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playMechanicalClick();
                      window.location.reload();
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <IconRotateCcw className="w-4 h-4" />
                    <span>Refresh Website</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playMechanicalClick();
                      onClose();
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Close Window
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
