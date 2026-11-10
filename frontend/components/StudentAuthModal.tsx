"use client";

import React, { useState, useRef } from "react";
import { sfx } from "../lib/sfx";
import {
  fetchAuthStatus,
  loginOrRegisterStudent,
  submitUsnDispute,
  reportMissingUsn,
  AuthStatus,
  AuthSession,
} from "../lib/api";
import { IconClose } from "./Icons";

interface StudentAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
  isObsidian?: boolean;
  initialUsn?: string;
}

export default function StudentAuthModal({
  isOpen,
  onClose,
  onSuccess,
  isObsidian = true,
  initialUsn = "",
}: StudentAuthModalProps) {
  const [mode, setMode] = useState<"auth" | "dispute">("auth");
  const [usn, setUsn] = useState(initialUsn.toUpperCase());
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [checkingUsn, setCheckingUsn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeSuccess, setDisputeSuccess] = useState<string | null>(null);

  // Selfie capture state
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Missing USN report & notice state
  const [reportingMissing, setReportingMissing] = useState(false);
  const [missingReportSuccess, setMissingReportSuccess] = useState<string | null>(null);
  const [missingStudentName, setMissingStudentName] = useState("");
  const [missingStudentBranch, setMissingStudentBranch] = useState("CSE");
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setError(null);
    setDisputeSuccess(null);
    setMissingReportSuccess(null);
    setPassword("");
    setNewPassword("");
    setSelfieBase64(null);
    setSelfiePreview(null);
    setMode("auth");
  };

  const handleClose = () => {
    sfx.playMechanicalClick();
    resetForm();
    onClose();
  };

  const handleReportMissingUsn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usn.trim()) {
      setError("Please enter your USN before submitting a report.");
      return;
    }
    setReportingMissing(true);
    setError(null);
    try {
      const res = await reportMissingUsn({
        usn: usn.trim().toUpperCase(),
        name: missingStudentName.trim(),
        branch: missingStudentBranch,
        message: `Student reported USN not found. Requesting scraper import for ${usn.trim().toUpperCase()} (${missingStudentBranch}).`,
      });
      setMissingReportSuccess(res.message || "Report sent! Admin will scrape your USN shortly.");
      sfx.playSonar();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to report missing USN";
      setError(msg);
    } finally {
      setReportingMissing(false);
    }
  };

  // Check USN status on blur or when user finishes typing 10 chars
  const handleCheckUsn = async (candidateUsn: string) => {
    const clean = candidateUsn.trim().toUpperCase();
    if (clean.length < 5) return;
    setCheckingUsn(true);
    setError(null);
    try {
      const status = await fetchAuthStatus(clean);
      setAuthStatus(status);
      if (!status.exists) {
        setError(null);
      }
    } catch {
      // Offline or network error
    } finally {
      setCheckingUsn(false);
    }
  };

  // Client-side image compression to <50KB Base64 JPEG
  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 420;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.65);
          setSelfieBase64(compressed);
          setSelfiePreview(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usn.trim()) {
      setError("Please enter your USN.");
      return;
    }
    if (!password.trim() || password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const session = await loginOrRegisterStudent(usn.trim(), password.trim());
      // Enforce session-based storage: only persists until tab/browser is closed
      sessionStorage.setItem("vtu_student_token", session.token);
      sessionStorage.setItem("vtu_student_session", JSON.stringify(session));
      sessionStorage.setItem("vtu_student_usn", session.usn);

      sfx.playMechanicalClick();
      onSuccess(session);
      resetForm();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to authenticate";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usn.trim()) {
      setError("Please enter your USN.");
      return;
    }
    if (!newPassword.trim() || newPassword.length < 4) {
      setError("New password must be at least 4 characters.");
      return;
    }
    if (!selfieBase64) {
      setError("Please take or upload a clear selfie to prove ownership of your USN.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await submitUsnDispute(usn.trim(), newPassword.trim(), selfieBase64);
      setDisputeSuccess(res.message);
      sfx.playMechanicalClick();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit dispute";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden transition-all duration-200 ${
          isObsidian
            ? "bg-[#0f1115] border-white/10 text-white"
            : "bg-white border-zinc-200 text-zinc-900"
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isObsidian ? "border-white/10 bg-white/[0.02]" : "border-zinc-100 bg-zinc-50/50"
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">
              {mode === "auth" ? "🔐" : "🛡️"}
            </span>
            <div>
              <h2 className="font-semibold text-base sm:text-lg tracking-tight">
                {mode === "auth" ? "Student Access Portal" : "Verify USN Ownership"}
              </h2>
              <p className={`text-xs ${isObsidian ? "text-zinc-400" : "text-zinc-500"}`}>
                {mode === "auth"
                  ? "Enter USN & password to unlock your complete rank"
                  : "Submit photo verification for admin review"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className={`p-2 rounded-xl transition-colors ${
              isObsidian ? "hover:bg-white/10 text-zinc-400" : "hover:bg-zinc-100 text-zinc-500"
            }`}
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs sm:text-sm leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          {disputeSuccess ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl text-emerald-400">
                ✓
              </div>
              <h3 className="font-semibold text-base">Claim Submitted!</h3>
              <p className={`text-xs sm:text-sm px-4 ${isObsidian ? "text-zinc-400" : "text-zinc-600"}`}>
                {disputeSuccess}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDisputeSuccess(null);
                    setMode("auth");
                  }}
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                >
                  Return to Login
                </button>
              </div>
            </div>
          ) : mode === "auth" ? (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {/* USN Field */}
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isObsidian ? "text-zinc-300" : "text-zinc-700"}`}>
                  University Seat Number (USN)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={usn}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setUsn(val);
                      if (val.length >= 7) handleCheckUsn(val);
                    }}
                    onBlur={() => handleCheckUsn(usn)}
                    placeholder="e.g. 1DB22CS001"
                    maxLength={10}
                    className={`w-full px-3.5 py-2.5 text-sm font-mono tracking-wider rounded-xl border outline-none transition-all ${
                      isObsidian
                        ? "bg-white/5 border-white/10 text-white focus:border-emerald-500 focus:bg-white/[0.08]"
                        : "bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-emerald-500 focus:bg-white"
                    }`}
                    required
                  />
                  {checkingUsn && (
                    <span className="absolute right-3 top-3 text-xs text-zinc-400 animate-spin">
                      ⏳
                    </span>
                  )}
                </div>

                {authStatus?.exists ? (
                  <div className="mt-2 text-xs flex items-center justify-between">
                    <span className={authStatus.is_claimed ? "text-amber-400" : "text-emerald-400"}>
                      {authStatus.name} ({authStatus.branch}) •{" "}
                      {authStatus.is_claimed ? "🔒 Claimed (Password Protected)" : "🌱 Unclaimed (Create Password)"}
                    </span>
                  </div>
                ) : authStatus && !authStatus.exists ? (
                  <div className="mt-3">
                    {missingReportSuccess ? (
                      <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-1">
                        <p className="font-bold">✅ Report Received by Admin</p>
                        <p className="text-[11px] opacity-90">{missingReportSuccess}</p>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                        <div>
                          <span className="text-xs font-bold text-amber-400 block">⚠️ USN Not Found in College Database</span>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Your USN isn&apos;t in the database yet, so you cannot log in. Send a message to the admin below to scrape your results.
                          </p>
                        </div>

                        {/* Quick Report to Admin Form */}
                        <div className="space-y-2 pt-1">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={missingStudentName}
                              onChange={(e) => setMissingStudentName(e.target.value)}
                              placeholder="Your Name (Optional)"
                              className="px-2.5 py-1.5 text-xs rounded-lg border bg-black/20 border-white/10 text-white outline-none focus:border-amber-400"
                            />
                            <select
                              value={missingStudentBranch}
                              onChange={(e) => setMissingStudentBranch(e.target.value)}
                              className="px-2.5 py-1.5 text-xs rounded-lg border bg-black/20 border-white/10 text-white outline-none focus:border-amber-400"
                            >
                              <option value="CSE" className="bg-zinc-900">CSE</option>
                              <option value="DS" className="bg-zinc-900">DS</option>
                              <option value="AIML" className="bg-zinc-900">AIML</option>
                              <option value="ISE" className="bg-zinc-900">ISE</option>
                              <option value="ECE" className="bg-zinc-900">ECE</option>
                              <option value="MECH" className="bg-zinc-900">MECH</option>
                              <option value="CIVIL" className="bg-zinc-900">CIVIL</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={handleReportMissingUsn}
                            disabled={reportingMissing}
                            className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
                          >
                            {reportingMissing ? (
                              <span>Sending Request...</span>
                            ) : (
                              <span>📢 Request Admin to Scrape My USN</span>
                            )}
                          </button>
                        </div>

                        {/* Data Transparency & Privacy Notice */}
                        <div className="pt-2 border-t border-amber-500/10">
                          <button
                            type="button"
                            onClick={() => setShowPrivacyNotice(!showPrivacyNotice)}
                            className="text-[10px] text-amber-400/80 hover:text-amber-400 underline flex items-center gap-1"
                          >
                            <span>{showPrivacyNotice ? "Hide" : "View"} Data Collection & Privacy Notice</span>
                          </button>

                          {showPrivacyNotice && (
                            <div className="mt-2 p-2.5 rounded-xl bg-black/30 border border-white/10 text-[10px] text-zinc-300 space-y-1.5 leading-relaxed">
                              <p><strong>📋 Collected Fields:</strong> University Seat Number (USN), Student Name, Branch, VTU Semester Marks, and encrypted password hash.</p>
                              <p><strong>🎯 Purpose:</strong> College academic analytics, branch percentiles, and private student-controlled performance comparisons.</p>
                              <p><strong>👁️ Visibility:</strong> Public preview is strictly limited to Top 3 per branch & Top 5 campus-wide. Complete marksheets and ranking insights require verified student login.</p>
                              <p><strong>🔒 Data Retention:</strong> Maintained during active academic semesters. Identity selfies used for ownership dispute verification are purged post-approval.</p>
                              <p><strong>⚖️ Correction & Complaint Route:</strong> To request marks correction, USN unlinking, or profile deletion, students can submit a request through this portal or reach college administration directly.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Password Field & Submit (Only when USN exists or not yet typed) */}
              {(!authStatus || authStatus.exists) && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`text-xs font-medium ${isObsidian ? "text-zinc-300" : "text-zinc-700"}`}>
                        {authStatus?.is_claimed ? "Password" : "Create Password (to claim USN)"}
                      </label>
                      {authStatus?.is_claimed && (
                        <button
                          type="button"
                          onClick={() => {
                            sfx.playMechanicalClick();
                            setMode("dispute");
                            setError(null);
                          }}
                          className="text-[11px] text-emerald-400 hover:underline"
                        >
                          Not you? Claim USN
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        authStatus?.is_claimed
                          ? "Enter your account password"
                          : "Create a password (min 4 chars)"
                      }
                      minLength={4}
                      className={`w-full px-3.5 py-2.5 text-sm rounded-xl border outline-none transition-all ${
                        isObsidian
                          ? "bg-white/5 border-white/10 text-white focus:border-emerald-500 focus:bg-white/[0.08]"
                          : "bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-emerald-500 focus:bg-white"
                      }`}
                      required
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl text-sm font-semibold tracking-wide bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    {loading
                      ? "Authenticating..."
                      : authStatus?.is_claimed
                      ? "Unlock Results & Rankings"
                      : "Claim USN & Create Password"}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playMechanicalClick();
                        setMode("dispute");
                        setError(null);
                      }}
                      className={`text-xs ${isObsidian ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-800"}`}
                    >
                      Did someone else take your USN? <span className="text-emerald-400 underline">Send Selfie Verification</span>
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : (
            /* Dispute / Ownership Form */
            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                isObsidian ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"
              }`}>
                📸 <strong>Selfie Verification:</strong> To ensure privacy and prevent unauthorized account takeover, take or upload a selfie. The admin will verify your identity against the college records and approve your ownership.
              </div>

              {/* USN Field */}
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isObsidian ? "text-zinc-300" : "text-zinc-700"}`}>
                  Your USN
                </label>
                <input
                  type="text"
                  value={usn}
                  onChange={(e) => setUsn(e.target.value.toUpperCase())}
                  placeholder="e.g. 1DB22CS001"
                  maxLength={10}
                  className={`w-full px-3.5 py-2.5 text-sm font-mono tracking-wider rounded-xl border outline-none transition-all ${
                    isObsidian
                      ? "bg-white/5 border-white/10 text-white focus:border-emerald-500"
                      : "bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-emerald-500"
                  }`}
                  required
                />
              </div>

              {/* New Password */}
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isObsidian ? "text-zinc-300" : "text-zinc-700"}`}>
                  Set New Password (activated upon admin approval)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create new password (min 4 chars)"
                  minLength={4}
                  className={`w-full px-3.5 py-2.5 text-sm rounded-xl border outline-none transition-all ${
                    isObsidian
                      ? "bg-white/5 border-white/10 text-white focus:border-emerald-500"
                      : "bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-emerald-500"
                  }`}
                  required
                />
              </div>

              {/* Selfie Upload / Camera */}
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isObsidian ? "text-zinc-300" : "text-zinc-700"}`}>
                  Selfie Photo (Front Camera or Gallery)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleSelfieChange}
                  className="hidden"
                />

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 py-2.5 px-3.5 rounded-xl border text-xs font-medium flex items-center justify-center space-x-2 transition-all ${
                      isObsidian
                        ? "bg-white/5 border-white/10 hover:bg-white/10 text-white"
                        : "bg-zinc-100 border-zinc-300 hover:bg-zinc-200 text-zinc-800"
                    }`}
                  >
                    <span>📷</span>
                    <span>{selfiePreview ? "Change Photo" : "Take / Choose Selfie"}</span>
                  </button>

                  {selfiePreview && (
                    <div className="relative w-11 h-11 rounded-xl overflow-hidden border-2 border-emerald-500 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selfiePreview}
                        alt="Selfie Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Dispute */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold tracking-wide bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Submit Verification to Admin"}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playMechanicalClick();
                    setMode("auth");
                    setError(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                >
                  ← Back to standard login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

