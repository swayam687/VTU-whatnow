"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ScrapeStatus,
  Student,
  fetchScrapeStatus,
  fetchStudents,
  startScraper,
  stopScraper,
  submitScraperCaptcha,
  verifyAdminPassword,
  deleteStudent,
  updateStudentSocials,
} from "../../lib/api";
import {
  IconSearch,
  IconClose,
  IconTrash,
  IconCheck,
  IconExternalLink,
  IconGitHub,
  IconLinkedIn,
} from "../../components/Icons";
import { sfx } from "../../lib/sfx";
import Identicon from "../../components/Identicon";

const PRESET_SEMESTERS = [
  { id: "1", label: "Semester 1", url: "https://results.vtu.ac.in/D25J26Ecbcs/index.php" },
  { id: "2", label: "Semester 2", url: "https://results.vtu.ac.in/MJ26cbcs/index.php" },
  { id: "custom", label: "Custom Link", url: "" },
];

const QUICK_BRANCHES = [
  { code: "CS", name: "CSE" },
  { code: "CD", name: "DS" },
  { code: "CY", name: "CY" },
  { code: "IS", name: "ISE" },
  { code: "CI", name: "AIML" },
  { code: "IE", name: "ECE" },
];

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [adminKey, setAdminKey] = useState<string>("admin123");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const [mode, setMode] = useState<"single" | "range">("single");
  const [semester, setSemester] = useState("1");
  const [customUrl, setCustomUrl] = useState("");
  const [singleUsn, setSingleUsn] = useState("1RM25CS001");
  const [startUsn, setStartUsn] = useState("1RM25CS001");
  const [endUsn, setEndUsn] = useState("1RM25CS060");
  
  const [status, setStatus] = useState<ScrapeStatus>({
    is_running: false,
    status: "idle",
    message: "Ready to scrape",
    processed_count: 0,
    total_count: 0,
    logs: [],
  });

  // Captcha solving state & visual inspection helpers
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaZoom, setCaptchaZoom] = useState<1 | 2 | 3>(2);
  const [captchaInvert, setCaptchaInvert] = useState<boolean>(false);
  const [submittingCaptcha, setSubmittingCaptcha] = useState(false);
  const [actionError, setActionError] = useState("");

  // Stored students management
  const [recentStudents, setRecentStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState("");

  // Admin Socials Edit Modal
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editGithub, setEditGithub] = useState("");
  const [editLinkedin, setEditLinkedin] = useState("");
  const [savingSocials, setSavingSocials] = useState(false);
  const [saveSocialsMsg, setSaveSocialsMsg] = useState("");

  const captchaInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Check saved admin session
  useEffect(() => {
    try {
      const savedKey = typeof window !== "undefined" ? sessionStorage.getItem("vtu_admin_key") : null;
      if (savedKey) {
        setAdminKey(savedKey);
        setIsAuthenticated(true);
      }
    } catch {
      // ignore
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setAuthError("");
    setIsVerifying(true);
    try {
      const ok = await verifyAdminPassword(passwordInput.trim());
      if (ok) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("vtu_admin_key", passwordInput.trim());
        }
        setAdminKey(passwordInput.trim());
        setIsAuthenticated(true);
        setPasswordInput("");
      } else {
        setAuthError("Incorrect password. Please try again.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to communicate with backend.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("vtu_admin_key");
    }
    setAdminKey("");
    setIsAuthenticated(false);
  };

  // Smart adaptive polling for scraper status
  useEffect(() => {
    let alive = true;
    let timer: NodeJS.Timeout;

    const poll = async () => {
      try {
        const data = await fetchScrapeStatus();
        if (alive) {
          if (data.is_running) {
            sfx.playGeigerTick();
          }
          setStatus(data);
          if (data.captcha_base64 && captchaInputRef.current) {
            captchaInputRef.current.focus();
          }
          const interval = (data.is_running || data.captcha_base64) ? 1000 : 3000;
          timer = setTimeout(poll, interval);
        }
      } catch {
        if (alive) timer = setTimeout(poll, 3000);
      }
    };

    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  // Refresh recent and all students
  const loadStudentRecords = () => {
    fetchStudents({ sort: "recent" })
      .then((data) => {
        setRecentStudents(data.slice(0, 8));
        setAllStudents(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadStudentRecords();
  }, [status.is_running, status.status]);

  // Auto scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [status.logs]);

  const handleStart = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActionError("");

    const targetStart = mode === "single" ? singleUsn.trim().toUpperCase() : startUsn.trim().toUpperCase();
    const targetEnd = mode === "single" ? targetStart : endUsn.trim().toUpperCase();

    if (!targetStart) {
      setActionError("Please enter a valid USN.");
      return;
    }

    try {
      await startScraper(
        {
          start_usn: targetStart,
          end_usn: targetEnd,
          semester,
          custom_url: semester === "custom" ? customUrl.trim() : undefined,
        },
        adminKey
      );
    } catch (err: any) {
      if (err.message && (err.message.includes("401") || err.message.toLowerCase().includes("admin authorization"))) {
        handleLogout();
        setActionError("Session expired. Please sign in again.");
      } else {
        setActionError(err.message || "Failed to start scraper. Check if backend is running.");
      }
    }
  };

  const handleStop = async () => {
    try {
      await stopScraper(adminKey);
    } catch (err: any) {
      if (err.message && (err.message.includes("401") || err.message.toLowerCase().includes("admin authorization"))) {
        handleLogout();
      }
      setActionError(err.message || "Failed to stop scraper");
    }
  };

  const handleCaptchaSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!captchaInput.trim() || submittingCaptcha) return;

    setSubmittingCaptcha(true);
    setActionError("");
    try {
      await submitScraperCaptcha(captchaInput.trim(), adminKey);
      setCaptchaInput("");
    } catch (err: any) {
      if (err.message && (err.message.includes("401") || err.message.toLowerCase().includes("admin authorization"))) {
        handleLogout();
      }
      setActionError(err.message || "Failed to submit captcha");
    } finally {
      setSubmittingCaptcha(false);
    }
  };

  const handleDeleteStudent = async (usn: string) => {
    if (!confirm(`Are you sure you want to permanently delete student ${usn} and all marks from the database?`)) {
      return;
    }
    setActionError("");
    try {
      await deleteStudent(usn, adminKey);
      setDeleteSuccessMsg(`Student ${usn} was successfully deleted.`);
      setTimeout(() => setDeleteSuccessMsg(""), 3500);
      loadStudentRecords();
    } catch (err: any) {
      setActionError(err.message || "Failed to delete student.");
    }
  };

  // Open Socials Edit Modal
  const handleOpenEditSocials = (student: Student) => {
    setEditingStudent(student);
    setEditGithub(student.github_url || "");
    setEditLinkedin(student.linkedin_url || "");
    setSaveSocialsMsg("");
  };

  // Save Socials via Admin
  const handleSaveSocials = async () => {
    if (!editingStudent) return;
    setSavingSocials(true);
    setSaveSocialsMsg("");
    setActionError("");
    try {
      const res = await updateStudentSocials(
        editingStudent.usn,
        {
          github_url: editGithub,
          linkedin_url: editLinkedin,
        },
        adminKey
      );

      setSaveSocialsMsg("Social accounts saved successfully!");
      loadStudentRecords();
      setTimeout(() => {
        setEditingStudent(null);
        setSaveSocialsMsg("");
      }, 1500);
    } catch (err: any) {
      setActionError(err.message || "Failed to update social profiles.");
    } finally {
      setSavingSocials(false);
    }
  };

  const handleQuickBranch = (code: string) => {
    setStartUsn(`1RM25${code}001`);
    setEndUsn(`1RM25${code}060`);
    setSingleUsn(`1RM25${code}001`);
  };

  const filteredStoredStudents = allStudents.filter((s) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase().trim();
    return s.name.toLowerCase().includes(q) || s.usn.toLowerCase().includes(q) || s.branch.toLowerCase().includes(q);
  });

  const progressPercent =
    status.total_count > 0
      ? Math.round((status.processed_count / status.total_count) * 100)
      : 0;

  if (checkingAuth) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 text-center text-slate-400 font-medium text-xs sm:text-sm">
        Verifying administrator session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-5">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center mx-auto text-base font-bold">
            🔒
          </div>
          <h2 className="text-xl font-bold text-slate-900">Admin Authentication</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            The scraper control room is restricted to admins to manage VTU scraping tasks, delete records, and update student profiles.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Admin Password
            </label>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter password (default: admin123)"
              className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-mono"
              autoFocus
            />
          </div>

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={isVerifying || !passwordInput.trim()}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm disabled:opacity-50"
          >
            {isVerifying ? "Verifying..." : "Unlock Control Room"}
          </button>

          <div className="text-center pt-2">
            <Link href="/" className="text-xs font-medium text-slate-500 hover:text-slate-800">
              ← Return to Public Dashboard
            </Link>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-xs font-bold text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Admin Scraper Control Room
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Query student marks from VTU with case-sensitive captcha inspection, database record deletion, and profile management.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-semibold text-slate-600 hover:text-rose-600 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 transition-colors shadow-sm"
          >
            Sign Out
          </button>
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                status.is_running
                  ? "bg-emerald-500 animate-ping"
                  : status.status === "error"
                  ? "bg-rose-500"
                  : "bg-slate-300"
              }`}
            />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              {status.is_running
                ? "Scraper Active"
                : status.status === "error"
                ? "Error"
                : "Ready"}
            </span>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl font-medium flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} className="text-rose-500 text-xs font-bold p-1">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {deleteSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-2xl font-medium flex items-center justify-between">
          <span>{deleteSuccessMsg}</span>
          <button onClick={() => setDeleteSuccessMsg("")} className="text-emerald-500 text-xs font-bold p-1">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Scraper Form Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-sm space-y-5">
        {/* Mode Selector Tabs */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Scraping Mode
          </label>
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                mode === "single"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Single Student USN
            </button>
            <button
              type="button"
              onClick={() => setMode("range")}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                mode === "range"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Batch Range Scraper (001–060)
            </button>
          </div>
        </div>

        {/* Examination / Semester Link */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Target Examination / Semester Link
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PRESET_SEMESTERS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSemester(s.id)}
                disabled={status.is_running}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  semester === s.id
                    ? "border-slate-900 bg-slate-900 text-white font-bold"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
                } disabled:opacity-50`}
              >
                <div className="text-xs sm:text-sm">{s.label}</div>
                {s.url && <div className={`text-[10px] truncate mt-0.5 ${semester === s.id ? "text-slate-300" : "text-slate-400"}`}>{s.url}</div>}
              </button>
            ))}
          </div>
          {semester === "custom" && (
            <input
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://results.vtu.ac.in/.../index.php"
              className="w-full mt-2 p-3 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          )}
        </div>

        {/* Quick Branch Autofill */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Quick Branch Autofill (2025 Batch)
          </label>
          <div className="flex flex-wrap gap-2">
            {QUICK_BRANCHES.map((b) => (
              <button
                key={b.code}
                type="button"
                onClick={() => handleQuickBranch(b.code)}
                disabled={status.is_running}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-50 transition-colors"
              >
                {b.name} ({b.code})
              </button>
            ))}
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleStart} className="space-y-4">
          {mode === "single" ? (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Student USN
              </label>
              <input
                type="text"
                value={singleUsn}
                onChange={(e) => setSingleUsn(e.target.value.toUpperCase())}
                placeholder="e.g. 1RM25CS045"
                disabled={status.is_running}
                className="w-full p-3 font-mono text-sm sm:text-base uppercase font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Start USN
                </label>
                <input
                  type="text"
                  value={startUsn}
                  onChange={(e) => setStartUsn(e.target.value.toUpperCase())}
                  placeholder="1RM25CS001"
                  disabled={status.is_running}
                  className="w-full p-3 font-mono text-xs sm:text-sm uppercase font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  End USN
                </label>
                <input
                  type="text"
                  value={endUsn}
                  onChange={(e) => setEndUsn(e.target.value.toUpperCase())}
                  placeholder="1RM25CS060"
                  disabled={status.is_running}
                  className="w-full p-3 font-mono text-xs sm:text-sm uppercase font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50"
                />
              </div>
            </div>
          )}

          {/* Action Button: Start / Stop */}
          <div className="pt-2">
            {status.is_running ? (
              <button
                type="button"
                onClick={handleStop}
                className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all"
              >
                Stop Current Scraping Task
              </button>
            ) : (
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-all"
              >
                {mode === "single" ? `Fetch Results for ${singleUsn}` : "Start Scraping Range"}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Progress & Current Status Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <div>
            <span className="font-bold text-slate-800">Status:</span>
            <span className="ml-2 font-medium text-slate-600">{status.message}</span>
          </div>
          {status.total_count > 0 && (
            <span className="font-bold text-slate-900 font-mono">
              {status.processed_count} / {status.total_count} ({progressPercent}%)
            </span>
          )}
        </div>

        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              status.status === "error" ? "bg-rose-500" : "bg-slate-900"
            }`}
            style={{ width: `${status.total_count > 0 ? progressPercent : 0}%` }}
          />
        </div>

        {status.current_usn && (
          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>Querying: <strong className="font-mono text-slate-800">{status.current_usn}</strong></span>
            <span>Range: {status.start_usn} → {status.end_usn}</span>
          </div>
        )}
      </div>

      {/* Enhanced Case-Sensitive Captcha Solving Box */}
      {status.captcha_base64 && (
        <div className="bg-amber-50/80 border-2 border-amber-300 rounded-3xl p-5 sm:p-7 shadow-lg space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 px-2 py-0.5 rounded bg-amber-200/70">
                Action Required
              </span>
              <h3 className="font-black text-amber-950 text-base sm:text-lg mt-1">
                Solve VTU Captcha for <span className="font-mono text-blue-700">{status.current_usn}</span>
              </h3>
            </div>
            
            {/* Visual Inspection Controls (Zoom & Invert) */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-amber-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 px-1">Zoom:</span>
              {([1, 2, 3] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setCaptchaZoom(z)}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-lg ${
                    captchaZoom === z
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {z}x
                </button>
              ))}
              <div className="w-px h-4 bg-slate-200 mx-0.5" />
              <button
                type="button"
                onClick={() => setCaptchaInvert((v) => !v)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-colors ${
                  captchaInvert
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {captchaInvert ? "Normal Contrast" : "High Contrast"}
              </button>
            </div>
          </div>

          {/* Captcha Image Display Container */}
          <div className="bg-white p-4 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row items-center gap-4">
            <div
              className={`bg-slate-100 p-3 rounded-xl border border-slate-200 flex items-center justify-center transition-all ${
                captchaInvert ? "filter invert" : ""
              }`}
            >
              <img
                src={`data:image/png;base64,${status.captcha_base64}`}
                alt="VTU Captcha"
                style={{
                  height: captchaZoom === 1 ? "42px" : captchaZoom === 2 ? "64px" : "84px",
                }}
                className="object-contain transition-all"
              />
            </div>

            {/* Input Form without uppercase CSS class */}
            <form onSubmit={handleCaptchaSubmit} className="flex-1 w-full space-y-2">
              <div className="flex gap-2">
                <input
                  ref={captchaInputRef}
                  type="text"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  placeholder="Type captcha (exact small & caps)..."
                  autoFocus
                  className="flex-1 p-3 border-2 border-amber-300 rounded-xl text-center font-mono font-bold text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
                <button
                  type="submit"
                  disabled={submittingCaptcha || !captchaInput.trim()}
                  className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm disabled:opacity-50 whitespace-nowrap"
                >
                  {submittingCaptcha ? "Submitting..." : "Submit Captcha"}
                </button>
              </div>

              {/* Real-time Character Breakdown to Differentiate Small vs Capital */}
              {captchaInput && (
                <div className="p-2.5 rounded-xl bg-amber-100/50 border border-amber-200">
                  <p className="text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1.5 text-center">
                    Character Breakdown (Verify Small vs Capital):
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {captchaInput.split("").map((ch, idx) => {
                      const isLower = /[a-z]/.test(ch);
                      const isUpper = /[A-Z]/.test(ch);
                      const isDigit = /[0-9]/.test(ch);
                      return (
                        <div
                          key={idx}
                          className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold flex items-center gap-1 border ${
                            isLower
                              ? "bg-blue-100 border-blue-300 text-blue-900"
                              : isUpper
                              ? "bg-purple-100 border-purple-300 text-purple-900"
                              : "bg-slate-100 border-slate-300 text-slate-800"
                          }`}
                        >
                          <span className="text-sm font-black underline underline-offset-2">{ch}</span>
                          <span className="text-[9px] font-sans uppercase font-bold opacity-75">
                            {isLower ? "small" : isUpper ? "CAPS" : "digit"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </form>
          </div>

          <p className="text-[11px] text-amber-700 text-center font-medium">
            Tip: Press <kbd className="px-1.5 py-0.5 bg-amber-200/60 rounded font-mono font-bold text-amber-900">Enter</kbd> to submit immediately.
          </p>
        </div>
      )}

      {/* Live Activity Log */}
      <div className="bg-slate-900 rounded-3xl p-5 text-slate-200 shadow-sm">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Scraper Activity Log
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Real-time</span>
        </div>

        <div
          ref={logContainerRef}
          className="h-44 overflow-y-auto font-mono text-xs space-y-1 pr-2 scrollbar-thin text-slate-300"
        >
          {status.logs.length === 0 ? (
            <p className="text-slate-600 italic">No activity logs recorded yet. Start a scraper job above.</p>
          ) : (
            status.logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                <span className="text-slate-600 mr-2">›</span>
                <span
                  className={
                    log.includes("✅")
                      ? "text-emerald-400 font-semibold"
                      : log.includes("❌")
                      ? "text-rose-400 font-semibold"
                      : log.includes("⚠️")
                      ? "text-amber-300"
                      : "text-slate-300"
                  }
                >
                  {log}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stored Students Database Management (Delete Power & Social Profiles Control) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900 text-base">
              Stored Student Records in Database ({allStudents.length})
            </h2>
            <p className="text-xs text-slate-400">Search, edit social profile links, or delete student records</p>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search USN or Name..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <span className="absolute left-2.5 top-2 text-slate-400">
              <IconSearch className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {filteredStoredStudents.length === 0 ? (
          <p className="text-center py-8 text-xs text-slate-400">
            {studentSearch ? "No students matching your search." : "No students currently stored in the database."}
          </p>
        ) : (
          <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {filteredStoredStudents.map((s) => (
              <div
                key={s.usn}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Identicon
                    usn={s.usn}
                    percentage={s.percentage}
                    totalBacklogs={s.total_backlogs}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">{s.name}</span>
                      <span className="text-[10px] font-bold text-slate-500 px-1.5 py-0.2 rounded bg-slate-100 uppercase">
                        {s.branch}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs text-slate-400">{s.usn}</span>
                      {s.github_url && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-mono">
                          GitHub
                        </span>
                      )}
                      {s.linkedin_url && (
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-mono">
                          LinkedIn
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <span className="font-bold text-xs text-slate-900">{s.percentage.toFixed(1)}%</span>
                    <span className="text-[10px] text-slate-400 block">{s.total_marks} marks</span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.total_backlogs > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {s.total_backlogs === 0 ? "0 BL" : `${s.total_backlogs} BL`}
                  </span>

                  {/* Admin Edit Socials Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditSocials(s)}
                    title={`Edit GitHub & LinkedIn for ${s.name}`}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Socials
                  </button>

                  {/* Admin Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteStudent(s.usn)}
                    title={`Delete ${s.name} (${s.usn})`}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors"
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Socials Edit Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Admin Profile Manager
                </span>
                <h3 className="font-bold text-slate-900 text-base mt-0.5">
                  Edit Socials for {editingStudent.name}
                </h3>
                <p className="font-mono text-xs text-slate-400">{editingStudent.usn}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  GitHub Profile URL or Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editGithub}
                    onChange={(e) => setEditGithub(e.target.value)}
                    placeholder="e.g. username or github.com/username"
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                  />
                  <span className="absolute left-2.5 top-2.5 text-slate-400">
                    <IconGitHub className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  LinkedIn Profile URL or Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editLinkedin}
                    onChange={(e) => setEditLinkedin(e.target.value)}
                    placeholder="e.g. username or linkedin.com/in/username"
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                  />
                  <span className="absolute left-2.5 top-2.5 text-blue-600">
                    <IconLinkedIn className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {saveSocialsMsg && (
                <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 p-2 rounded-xl text-center">
                  {saveSocialsMsg}
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSocials}
                disabled={savingSocials}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50"
              >
                {savingSocials ? "Saving..." : "Save Profiles"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
