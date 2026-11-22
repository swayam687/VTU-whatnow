"use client";

import React, { useState, useRef, useEffect } from "react";
import { sfx } from "../lib/sfx";
import {
  fetchAuthStatus,
  loginOrRegisterStudent,
  submitUsnDispute,
  reportMissingUsn,
  setStoredStudentSession,
  startOnDemandRegistration,
  refreshOnDemandCaptcha,
  submitOnDemandCaptcha,
  submitLoginGateCaptcha,
  AuthStatus,
  AuthSession,
} from "../lib/api";
import { IconClose, IconEye, IconEyeOff } from "./Icons";

interface StudentAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
  isObsidian?: boolean;
  initialUsn?: string;
}

type OnDemandState = "idle" | "connecting" | "captcha_ready" | "extracting" | "success";

interface CharScramble {
  char: string;
  isLocked: boolean;
}

/**
 * Sequential character-by-character scramble animation (same high-tech decrypting as StudentDetailModal):
 * Staggers locks smoothly with natural character sequence progression.
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

    const cleanUsn = targetUsn.trim().toUpperCase() || "VTU ACCESS";
    const len = cleanUsn.length;
    const TOTAL_MS = 1400;

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

      const minLock = 250;
      const maxLock = 1300;
      const lockT = len <= 1 ? TOTAL_MS : minLock + (i / (len - 1)) * (maxLock - minLock);
      lockTimes.push(lockT);
    }

    setDisplayChars(charSequences.map((seq) => ({ char: seq[0], isLocked: false })));
    setIsScrambleComplete(false);

    const startTime = performance.now();
    let animId: number;
    let lastTick = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;

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
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [checkingUsn, setCheckingUsn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeSuccess, setDisputeSuccess] = useState<string | null>(null);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  // On-demand live VTU extraction & distributed login gate state
  const [onDemandState, setOnDemandState] = useState<OnDemandState>("idle");
  const [onDemandSessionId, setOnDemandSessionId] = useState<string | null>(null);
  const [captchaBase64, setCaptchaBase64] = useState<string | null>(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [refreshingCaptcha, setRefreshingCaptcha] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [gateMessage, setGateMessage] = useState("Please solve this captcha to verify your session and update campus records.");
  const [failCount, setFailCount] = useState(0);
  const [bypassedToast, setBypassedToast] = useState<string | null>(null);
  const [extractedStudent, setExtractedStudent] = useState<{
    name: string;
    branch: string;
    totalMarks: number;
    maxMarks: number;
    percentage: number;
  } | null>(null);

  // Sequential character-by-character decryption scramble animation
  const isDecryptingActive = onDemandState === "connecting" || onDemandState === "extracting";
  const { displayChars } = useSequentialUSNScramble(
    usn.trim().toUpperCase() || "VTU ACCESS",
    isDecryptingActive
  );

  // Manual admin report toggle
  const [showAdminReport, setShowAdminReport] = useState(false);
  const [reportingMissing, setReportingMissing] = useState(false);
  const [missingReportSuccess, setMissingReportSuccess] = useState<string | null>(null);
  const [missingStudentName, setMissingStudentName] = useState("");
  const [missingStudentBranch, setMissingStudentBranch] = useState("CSE");

  // Selfie capture state for disputes
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captchaInputRef = useRef<HTMLInputElement | null>(null);

  // Ticker timer for slow VTU connection wait
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (onDemandState === "connecting" || onDemandState === "extracting") {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [onDemandState]);

  // Autofocus captcha input when ready
  useEffect(() => {
    if (onDemandState === "captcha_ready" && captchaInputRef.current) {
      setTimeout(() => {
        captchaInputRef.current?.focus();
      }, 100);
    }
  }, [onDemandState]);

  if (!isOpen) return null;

  const resetForm = () => {
    setError(null);
    setDisputeSuccess(null);
    setMissingReportSuccess(null);
    setPassword("");
    setNewPassword("");
    setShowPassword(false);
    setShowNewPassword(false);
    setSelfieBase64(null);
    setSelfiePreview(null);
    setAgreedToPrivacy(false);
    setOnDemandState("idle");
    setOnDemandSessionId(null);
    setCaptchaBase64(null);
    setCaptchaInput("");
    setElapsedSeconds(0);
    setExtractedStudent(null);
    setShowAdminReport(false);
    setMode("auth");
  };

  const handleClose = () => {
    sfx.playMechanicalClick();
    resetForm();
    onClose();
  };

  // Check USN status on blur or when user finishes typing 7+ chars
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
      // Network or backend unavailable
    } finally {
      setCheckingUsn(false);
    }
  };

  // -------------------------------------------------------------
  // Live On-Demand Captcha Flow
  // -------------------------------------------------------------

  const handleStartOnDemand = async () => {
    const cleanUsn = usn.trim().toUpperCase();
    if (!cleanUsn || cleanUsn.length < 5) {
      setError("Please enter a valid USN.");
      return;
    }
    if (!password.trim() || password.length < 4) {
      setError("Please choose a password with at least 4 characters.");
      return;
    }
    if (!agreedToPrivacy) {
      setError("Please read and agree to the Privacy Policy to proceed.");
      return;
    }

    setError(null);
    setLoading(true);
    setOnDemandState("connecting");
    setElapsedSeconds(0);
    sfx.playMechanicalClick();

    const startTime = Date.now();
    const MAX_WAIT_MS = 30000; // Wait up to 30 seconds
    let res: { ok?: boolean; session_id?: string; captcha_base64?: string; message?: string } | null = null;
    let lastError: string | null = null;

    while (Date.now() - startTime < MAX_WAIT_MS) {
      try {
        res = await startOnDemandRegistration(cleanUsn);
        if (res && res.ok && res.session_id && res.captcha_base64) {
          break; // Captcha received
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : "Connecting to VTU...";
        const elapsed = Date.now() - startTime;
        if (elapsed < MAX_WAIT_MS - 2500) {
          await new Promise((r) => setTimeout(r, 2000));
        } else {
          break;
        }
      }
    }

    if (res && res.ok && res.session_id && res.captcha_base64) {
      setOnDemandSessionId(res.session_id);
      setCaptchaBase64(res.captcha_base64);
      setOnDemandState("captcha_ready");
      setCaptchaInput("");
      sfx.playSonar();
      setLoading(false);
      return;
    }

    // 30 seconds expired without captcha: return to login screen
    setError(lastError || "VTU examination portal did not provide a captcha within 30 seconds. Please try again.");
    setOnDemandState("idle");
    setLoading(false);
  };

  const handleRefreshCaptcha = async () => {
    if (!onDemandSessionId || refreshingCaptcha) return;
    setRefreshingCaptcha(true);
    sfx.playMechanicalClick();
    try {
      const res = await refreshOnDemandCaptcha(onDemandSessionId);
      if (res.ok && res.captcha_base64) {
        setCaptchaBase64(res.captcha_base64);
        setCaptchaInput("");
      } else {
        setError(res.message || "Could not reload captcha. Please try again.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reload captcha";
      setError(msg);
    } finally {
      setRefreshingCaptcha(false);
    }
  };

  const handleSubmitCaptcha = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!onDemandSessionId) {
      setError("Session expired. Please request a new captcha.");
      setOnDemandState("idle");
      return;
    }
    if (!captchaInput.trim()) {
      setError("Please enter the captcha characters.");
      return;
    }

    setError(null);
    setOnDemandState("extracting");
    setElapsedSeconds(0);
    sfx.playMechanicalClick();

    try {
      const res = await submitLoginGateCaptcha(
        onDemandSessionId,
        captchaInput.trim(),
        usn.trim().toUpperCase(),
        password.trim()
      );

      if (res.ok && res.auth_response) {
        // Marksheet parsed and student authenticated
        const session = res.auth_response;
        setStoredStudentSession(session);
        sfx.playMechanicalClick();
        onSuccess(session);

        // Directly close modal and enter portal without flashing the login form!
        handleClose();
      } else {
        // Failed attempt
        const newFailCount = res.fail_count !== undefined ? res.fail_count : failCount + 1;
        setFailCount(newFailCount);

        if (newFailCount >= 3 || res.reason === "max_attempts_exceeded") {
          // 3 wrong attempts finished: prompt user to refresh and login again
          setError("⚠️ You have completed 3 wrong attempts. Please refresh the captcha or return to login and try again.");
          setOnDemandState("captcha_ready");
          setCaptchaInput("");
          return;
        }

        if (res.new_captcha_base64) {
          setCaptchaBase64(res.new_captcha_base64);
        }
        setCaptchaInput("");
        setError(res.message || `Captcha code was incorrect. (${newFailCount}/3 attempts)`);
        setOnDemandState("captcha_ready");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification request failed";
      setError(msg);
      setOnDemandState("idle");
    }
  };

  // -------------------------------------------------------------
  // Standard Auth & Dispute Handlers
  // -------------------------------------------------------------

  const handleStandardAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usn.trim()) {
      setError("Please enter your USN.");
      return;
    }
    if (!password.trim() || password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (!agreedToPrivacy) {
      setError("Please check and agree to the Privacy Policy to sign in.");
      return;
    }

    setLoading(true);
    setError(null);
    // Instantly transition to decrypting scramble animation so the user is never left waiting on the form
    setOnDemandState("connecting");
    setElapsedSeconds(0);
    sfx.playMechanicalClick();

    const cleanUsn = usn.trim().toUpperCase();
    const cleanPassword = password.trim();
    const startTime = Date.now();
    const MAX_WAIT_MS = 30000; // Stay on loading screen and retry for up to 30 seconds

    let challenge: { require_captcha?: boolean; session_id?: string; captcha_base64?: string; message?: string } | null = null;
    let lastError: string | null = null;

    while (Date.now() - startTime < MAX_WAIT_MS) {
      try {
        challenge = await loginOrRegisterStudent(cleanUsn, cleanPassword);
        if (challenge && challenge.require_captcha && challenge.session_id) {
          break; // Captcha challenge acquired
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Establishing session with VTU servers...";
        lastError = msg;

        // When password is wrong or credentials invalid: STOP IMMEDIATELY! Do not show any captcha!
        const isAuthCredentialError =
          msg.toLowerCase().includes("incorrect password") ||
          msg.toLowerCase().includes("password") ||
          msg.toLowerCase().includes("claim ownership") ||
          msg.toLowerCase().includes("deleted") ||
          msg.toLowerCase().includes("hidden") ||
          msg.includes("401") ||
          msg.includes("403");

        if (isAuthCredentialError) {
          setError(msg);
          setOnDemandState("idle");
          setLoading(false);
          sfx.playMechanicalClick();
          return;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed < MAX_WAIT_MS - 2500) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          break;
        }
      }
    }

    // Check if Captcha arrived
    if (challenge && challenge.require_captcha && challenge.session_id) {
      setOnDemandSessionId(challenge.session_id);
      if (challenge.captcha_base64) {
        setCaptchaBase64(challenge.captcha_base64);
      }
      setGateMessage(challenge.message || "Please solve this captcha to verify your session and update campus records.");
      setFailCount(0);
      setCaptchaInput("");
      setOnDemandState("captcha_ready");
      sfx.playSonar();
      setLoading(false);
      return;
    }

    // 30 seconds elapsed without captcha: return to login screen
    setError(
      lastError || "VTU examination servers did not provide a captcha within 30 seconds. Please try again."
    );
    setOnDemandState("idle");
    setLoading(false);
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

  // Client-side image compression to <50KB Base64 JPEG for disputes
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
        if (e.target === e.currentTarget && onDemandState !== "connecting" && onDemandState !== "extracting") {
          handleClose();
        }
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
              {onDemandState === "captcha_ready"
                ? "🧩"
                : onDemandState === "connecting" || onDemandState === "extracting"
                ? "⚡"
                : mode === "auth"
                ? "🔐"
                : "🛡️"}
            </span>
            <div>
              <h2 className="font-semibold text-base sm:text-lg tracking-tight">
                {onDemandState === "captcha_ready"
                  ? "Solve VTU Security Captcha"
                  : onDemandState === "connecting"
                  ? "Connecting to VTU"
                  : onDemandState === "extracting"
                  ? "Extracting Marksheet"
                  : onDemandState === "success"
                  ? "Registration Complete"
                  : mode === "auth"
                  ? "Student Access Portal"
                  : "Verify USN Ownership"}
              </h2>
              <p className={`text-xs ${isObsidian ? "text-zinc-400" : "text-zinc-500"}`}>
                {onDemandState === "captcha_ready"
                  ? "Type the characters from the official VTU image"
                  : onDemandState === "connecting"
                  ? "Connecting directly to VTU examination servers"
                  : onDemandState === "extracting"
                  ? "Parsing subjects, grades, and computing rankings"
                  : onDemandState === "success"
                  ? "Your marksheet has been saved and secured"
                  : mode === "auth"
                  ? "Enter USN & password to unlock full rank and marksheet"
                  : "Submit photo verification for admin review"}
              </p>
            </div>
          </div>
          {onDemandState !== "connecting" && onDemandState !== "extracting" && (
            <button
              onClick={handleClose}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isObsidian ? "hover:bg-white/10 text-zinc-400" : "hover:bg-zinc-100 text-zinc-500"
              }`}
            >
              <IconClose className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {bypassedToast && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs sm:text-sm leading-relaxed space-y-1 animate-in fade-in">
              <p className="flex items-start gap-1.5 font-medium">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{bypassedToast}</span>
              </p>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs sm:text-sm leading-relaxed space-y-2 animate-in fade-in">
              <p className="flex items-start gap-1.5">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{error}</span>
              </p>
              {error.toLowerCase().includes("selfie") && mode === "auth" && (
                <button
                  type="button"
                  onClick={() => {
                    sfx.playMechanicalClick();
                    setMode("dispute");
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <span>📸 Send Selfie Verification Now →</span>
                </button>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 1: CONNECTING & GENERATING CAPTCHA (DECRYPTING SCRAMBLE)            */}
          {/* ========================================================================= */}
          {onDemandState === "connecting" ? (
            <div className="py-6 px-1 space-y-5 text-center animate-in fade-in duration-200">
              {/* Rotating beacon */}
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-spin border-t-cyan-400" />
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-cyan-500/40 flex items-center justify-center font-mono font-bold text-xs text-cyan-300 shadow-lg shadow-cyan-950/40">
                  VTU
                </div>
              </div>

              {/* Status Header */}
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-[11px] font-medium tracking-wide">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span>DECRYPTING VTU GATEWAY & SECURITY RECORD</span>
                </div>
                <h3 className="font-semibold text-base sm:text-lg tracking-tight text-white">
                  Verifying Campus Records...
                </h3>
              </div>

              {/* The Sequential Scramble Box */}
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="inline-flex items-center gap-1 sm:gap-1.5 px-4 py-2 rounded-xl bg-slate-950/90 border border-cyan-500/40 shadow-xl shadow-cyan-950/50 max-w-fit">
                  {displayChars.map((item, idx) => (
                    <span
                      key={idx}
                      className={`inline-block w-5 sm:w-6 text-center font-mono font-bold text-base sm:text-lg tabular-nums tracking-wider transition-colors duration-100 ${
                        item.isLocked
                          ? "text-cyan-300 font-extrabold"
                          : "text-amber-400 font-medium animate-pulse"
                      }`}
                    >
                      {item.char}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  Handshaking official examination portal
                </span>
              </div>

              {/* Slow VTU Portal Notice */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 text-left space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Connection Latency</span>
                  <span className="font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    {elapsedSeconds}s / 30s
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">
                  VTU examination servers take 15–30 seconds to connect and stream the verification challenge. Please keep this window open.
                </p>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setOnDemandState("idle");
                    setError(null);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  Cancel Connection
                </button>
              </div>
            </div>

          ) : onDemandState === "captcha_ready" ? (
            /* ========================================================================= */
            /* STAGE 2: CAPTCHA SOLVING SCREEN                                          */
            /* ========================================================================= */
            <form onSubmit={handleSubmitCaptcha} className="space-y-4 animate-in fade-in duration-200">
              <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                isObsidian ? "bg-white/[0.02] border-white/10 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-700"
              }`}>
                {gateMessage}
                {failCount > 0 && (
                  <span className="block mt-1 font-mono text-[11px] text-amber-400">
                    Attempt {failCount}/3
                  </span>
                )}
              </div>

              {/* Captcha Image Container with High Contrast & Hairline Border */}
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-white/15 flex flex-col items-center justify-center space-y-2.5 shadow-inner">
                <div className="p-2 bg-white rounded-xl shadow-md border border-zinc-200">
                  {captchaBase64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/png;base64,${captchaBase64}`}
                      alt="VTU Security Captcha"
                      className="h-14 sm:h-16 mx-auto object-contain select-none"
                    />
                  ) : (
                    <div className="h-14 w-44 flex items-center justify-center text-xs text-zinc-400 font-mono">
                      Loading Captcha...
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshCaptcha}
                    disabled={refreshingCaptcha}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors cursor-pointer"
                  >
                    <span>{refreshingCaptcha ? "⏳" : "🔄"}</span>
                    <span>{refreshingCaptcha ? "Refreshing..." : "Cannot read? Refresh Captcha"}</span>
                  </button>
                </div>
              </div>

              {failCount >= 3 ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-sm">
                    <span>⚠️</span>
                    <span>3 Wrong Attempts Completed</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed px-2">
                    You have reached the maximum of 3 incorrect captcha attempts. Please refresh the captcha to generate a new image or return to the login screen.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setFailCount(0);
                        setError(null);
                        handleRefreshCaptcha();
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-md shadow-cyan-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>🔄</span>
                      <span>Refresh Captcha & Try Again</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOnDemandState("idle");
                        setFailCount(0);
                        setError(null);
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>←</span>
                      <span>Return to Login</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Captcha Input Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`block text-xs font-medium ${isObsidian ? "text-zinc-300" : "text-zinc-700"}`}>
                        Enter Captcha Code
                      </label>
                      <span className="text-[11px] font-mono text-cyan-400 font-medium">
                        Case-Sensitive (a-z & A-Z)
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
                      className={`w-full px-4 py-3 text-lg font-mono text-center tracking-widest rounded-xl border outline-none transition-all ${
                        isObsidian
                          ? "bg-white/5 border-white/10 text-white focus:border-cyan-400 focus:bg-white/[0.08]"
                          : "bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-cyan-500 focus:bg-white"
                      }`}
                      required
                    />
                  </div>

                  {/* Submit Buttons */}
                  <button
                    type="submit"
                    disabled={!captchaInput.trim()}
                    className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold tracking-wide bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Verify Captcha & Continue →
                  </button>
                </>
              )}

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setOnDemandState("idle");
                    setError(null);
                  }}
                  className={`text-xs transition-colors cursor-pointer ${
                    isObsidian ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  ← Back to details
                </button>
              </div>
            </form>

          ) : onDemandState === "extracting" ? (
            /* ========================================================================= */
            /* STAGE 3: EXTRACTING & SECURING ACCOUNT (DECRYPTING SCRAMBLE)              */
            /* ========================================================================= */
            <div className="py-6 px-1 space-y-5 text-center animate-in fade-in duration-200">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-spin border-t-emerald-400" />
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-emerald-500/40 flex items-center justify-center font-mono font-bold text-xs text-emerald-300 shadow-lg shadow-emerald-950/40">
                  VTU
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px] font-medium tracking-wide">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>PARSING OFFICIAL RESULT LEDGER</span>
                </div>
                <h3 className="font-semibold text-base sm:text-lg tracking-tight text-white">
                  Verifying Captcha & Extracting Marksheet
                </h3>
              </div>

              {/* The Sequential Scramble Box */}
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="inline-flex items-center gap-1 sm:gap-1.5 px-4 py-2 rounded-xl bg-slate-950/90 border border-emerald-500/40 shadow-xl shadow-emerald-950/50 max-w-fit">
                  {displayChars.map((item, idx) => (
                    <span
                      key={idx}
                      className={`inline-block w-5 sm:w-6 text-center font-mono font-bold text-base sm:text-lg tabular-nums tracking-wider transition-colors duration-100 ${
                        item.isLocked
                          ? "text-emerald-300 font-extrabold"
                          : "text-amber-400 font-medium animate-pulse"
                      }`}
                    >
                      {item.char}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  Computing SGPA credits and authenticating profile
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 text-left space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Processing Stage</span>
                  <span className="font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {elapsedSeconds}s elapsed
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">
                  Submitting solution to VTU examination server and verifying security checksum.
                </p>
              </div>
            </div>

          ) : onDemandState === "success" ? (
            /* ========================================================================= */
            /* STAGE 4: REGISTRATION / AUTHENTICATION SUCCESS                            */
            /* ========================================================================= */
            <div className="py-5 space-y-4 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-3xl text-emerald-400">
                ✓
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-lg text-emerald-400">Authentication Verified!</h3>
                <p className={`text-xs ${isObsidian ? "text-zinc-300" : "text-zinc-700"}`}>
                  Entering your student portal...
                </p>
              </div>

              {extractedStudent && (
                <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                  isObsidian ? "bg-white/[0.02] border-white/10 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-800"
                }`}>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">University Seat Number:</span>
                    <span className="font-mono font-bold">{usn.trim().toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Total Marks Scored:</span>
                    <span className="font-semibold">{extractedStudent.totalMarks} / {extractedStudent.maxMarks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Overall Percentage:</span>
                    <span className="font-semibold text-emerald-400">{extractedStudent.percentage}%</span>
                  </div>
                </div>
              )}

              <p className="text-xs text-zinc-400 animate-pulse">
                Redirecting to dashboard...
              </p>
            </div>

          ) : disputeSuccess ? (
            /* ========================================================================= */
            /* DISPUTE SUCCESS SCREEN                                                   */
            /* ========================================================================= */
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
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors cursor-pointer"
                >
                  Return to Login
                </button>
              </div>
            </div>

          ) : mode === "auth" ? (
            /* ========================================================================= */
            /* STANDARD AUTH / REGISTER FORM                                             */
            /* ========================================================================= */
            <form onSubmit={handleStandardAuthSubmit} className="space-y-4">
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
                  authStatus.is_hidden ? (
                    <div className="mt-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <span>🚫</span>
                        <span>USN Deleted / Hidden</span>
                      </div>
                      <p className="text-xs leading-relaxed opacity-95">
                        USN deleted, request admin to add this USN data again and send your selfie to verify that you are the owner of the USN.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          sfx.playMechanicalClick();
                          setMode("dispute");
                          setError(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <span>📸 Send Selfie Verification to Admin →</span>
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs flex items-center justify-between">
                      <span className={authStatus.is_claimed ? "text-amber-400" : "text-emerald-400"}>
                        {authStatus.name} ({authStatus.branch}) •{" "}
                        {authStatus.is_claimed ? "🔒 Claimed (Password Protected)" : "🌱 Unclaimed (Create Password)"}
                      </span>
                    </div>
                  )
                ) : authStatus && !authStatus.exists ? (
                  /* USN NOT in DB: Inform student they can instantly register via live VTU captcha */
                  <div className="mt-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 space-y-1.5 animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-cyan-400">
                      <span>✨</span>
                      <span>New USN • Instant VTU Extraction</span>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${isObsidian ? "text-zinc-300" : "text-zinc-600"}`}>
                      This USN is not in the database yet. Set your password below and solve a live VTU captcha to automatically extract your marksheet!
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Password Field (Rendered when USN is not hidden) */}
              {(!authStatus || !authStatus.is_hidden) && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`text-xs font-medium ${isObsidian ? "text-zinc-300" : "text-zinc-700"}`}>
                        {authStatus?.is_claimed
                          ? "Password"
                          : authStatus && !authStatus.exists
                          ? "Create New Password (to lock your account)"
                          : "Create Password (to claim USN)"}
                      </label>
                      {authStatus?.is_claimed && (
                        <button
                          type="button"
                          onClick={() => {
                            sfx.playMechanicalClick();
                            setMode("dispute");
                            setError(null);
                          }}
                          className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                        >
                          Not you? Claim USN
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          authStatus?.is_claimed
                            ? "Enter your account password"
                            : "Create a password (min 4 chars)"
                        }
                        minLength={4}
                        className={`w-full px-3.5 py-2.5 pr-10 text-sm rounded-xl border outline-none transition-all ${
                          isObsidian
                            ? "bg-white/5 border-white/10 text-white focus:border-emerald-500 focus:bg-white/[0.08]"
                            : "bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-emerald-500 focus:bg-white"
                        }`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute right-3 top-3 text-zinc-400 hover:text-white transition-colors cursor-pointer`}
                      >
                        {showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Privacy Policy Agreement Checkbox */}
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs">
                      <input
                        type="checkbox"
                        checked={agreedToPrivacy}
                        onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-500 shrink-0"
                      />
                      <span className={isObsidian ? "text-zinc-300" : "text-zinc-700"}>
                        I have read and agree to the{" "}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-cyan-400 hover:underline font-semibold"
                        >
                          Privacy Policy
                        </a>
                      </span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  {authStatus && !authStatus.exists ? (
                    <button
                      type="button"
                      onClick={handleStartOnDemand}
                      disabled={loading || !agreedToPrivacy || !password.trim()}
                      className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold tracking-wide bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-lg shadow-cyan-500/20 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>⚡</span>
                      <span>Fetch VTU Marksheet & Register</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading || !agreedToPrivacy}
                      className="w-full py-3 px-4 rounded-xl text-sm font-semibold tracking-wide bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 shadow-sm active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {loading
                        ? "Signing In..."
                        : authStatus?.is_claimed
                        ? "Unlock Results & Rankings"
                        : "Claim USN & Create Password"}
                    </button>
                  )}

                  {/* Optional: Dispute Link or Admin Report Drawer */}
                  <div className="pt-2 text-center space-y-2">
                    {authStatus && !authStatus.exists ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowAdminReport(!showAdminReport)}
                          className={`text-xs ${isObsidian ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-800"}`}
                        >
                          Having trouble with VTU? <span className="text-amber-400 underline">{showAdminReport ? "Hide" : "Request Admin to Add USN manually"}</span>
                        </button>
                      </div>
                    ) : (
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
                    )}
                  </div>

                  {/* Collapsible Admin Report Form (Fallback for missing USN) */}
                  {showAdminReport && authStatus && !authStatus.exists && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3 text-left animate-in fade-in">
                      <div>
                        <span className="text-xs font-bold text-amber-400 block">📢 Request Admin Scrape</span>
                        <p className={`text-[11px] mt-0.5 ${isObsidian ? "text-zinc-400" : "text-zinc-600"}`}>
                          If the live scraper cannot connect, request the administrator to batch import your semester marks.
                        </p>
                      </div>

                      {missingReportSuccess ? (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                          {missingReportSuccess}
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={missingStudentName}
                              onChange={(e) => setMissingStudentName(e.target.value)}
                              placeholder="Your Name (Optional)"
                              className={`px-2.5 py-1.5 text-xs rounded-lg border outline-none ${
                                isObsidian
                                  ? "bg-black/30 border-white/10 text-white focus:border-amber-400"
                                  : "bg-white border-zinc-300 text-zinc-900 focus:border-amber-500"
                              }`}
                            />
                            <select
                              value={missingStudentBranch}
                              onChange={(e) => setMissingStudentBranch(e.target.value)}
                              className={`px-2.5 py-1.5 text-xs rounded-lg border outline-none ${
                                isObsidian
                                  ? "bg-black/30 border-white/10 text-white focus:border-amber-400"
                                  : "bg-white border-zinc-300 text-zinc-900 focus:border-amber-500"
                              }`}
                            >
                              <option value="CSE" className={isObsidian ? "bg-zinc-900" : "bg-white text-zinc-900"}>CSE</option>
                              <option value="DS" className={isObsidian ? "bg-zinc-900" : "bg-white text-zinc-900"}>DS</option>
                              <option value="AIML" className={isObsidian ? "bg-zinc-900" : "bg-white text-zinc-900"}>AIML</option>
                              <option value="ISE" className={isObsidian ? "bg-zinc-900" : "bg-white text-zinc-900"}>ISE</option>
                              <option value="ECE" className={isObsidian ? "bg-zinc-900" : "bg-white text-zinc-900"}>ECE</option>
                              <option value="MECH" className={isObsidian ? "bg-zinc-900" : "bg-white text-zinc-900"}>MECH</option>
                              <option value="CIVIL" className={isObsidian ? "bg-zinc-900" : "bg-white text-zinc-900"}>CIVIL</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={handleReportMissingUsn}
                            disabled={reportingMissing}
                            className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            {reportingMissing ? "Sending Report..." : "Submit Report to Admin"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </form>
          ) : (
            /* ========================================================================= */
            /* DISPUTE / OWNERSHIP FORM                                                  */
            /* ========================================================================= */
            <form onSubmit={handleDisputeSubmit} className="space-y-4 animate-in fade-in">
              <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                isObsidian ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"
              }`}>
                📸 <strong>Selfie Verification:</strong> To ensure privacy and prevent unauthorized account takeover, take or upload a selfie. The admin will verify your identity against college records and approve your ownership.
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
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Create new password (min 4 chars)"
                    minLength={4}
                    className={`w-full px-3.5 py-2.5 pr-10 text-sm rounded-xl border outline-none transition-all ${
                      isObsidian
                        ? "bg-white/5 border-white/10 text-white focus:border-emerald-500"
                        : "bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-emerald-500"
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                  </button>
                </div>
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
                    className={`flex-1 py-2.5 px-3.5 rounded-xl border text-xs font-medium flex items-center justify-center space-x-2 transition-all cursor-pointer ${
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
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold tracking-wide bg-amber-600 hover:bg-amber-700 text-white shadow-xs active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
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
                  className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
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
