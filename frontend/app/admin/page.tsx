"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ScrapeStatus,
  Student,
  SemesterLink,
  BrowserStatus,
  DisputeRecord,
  LoginLogsData,
  fetchScrapeStatus,
  fetchStudents,
  startScraper,
  stopScraper,
  submitScraperCaptcha,
  verifyAdminPassword,
  deleteStudent,
  updateStudentSocials,
  fetchSemesterLinks,
  createSemesterLink,
  deleteSemesterLink,
  fetchBrowserStatus,
  installBrowser,
  checkBackendHealth,
  fetchAdminDisputes,
  reviewAdminDispute,
  fetchAdminLoginLogs,
  fetchAdminComparisonLogs,
  ComparisonLogsData,
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

const QUICK_BRANCHES = [
  { code: "CS", name: "CSE" },
  { code: "CD", name: "DS" },
  { code: "CY", name: "CY" },
  { code: "IS", name: "ISE" },
  { code: "CI", name: "AIML" },
  { code: "IE", name: "ECE" },
  { code: "EE", name: "EEE" },
  { code: "ME", name: "MECH" },
  { code: "CV", name: "CIVIL" },
];

export default function AdminPanel() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [adminKey, setAdminKey] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Active top-level tab: 'scraper' | 'semesters' | 'records' | 'disputes' | 'logs' | 'system'
  const [activeTab, setActiveTab] = useState<"scraper" | "semesters" | "records" | "disputes" | "logs" | "system">("scraper");

  // USN Disputes state
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [disputeFilter, setDisputeFilter] = useState<string>("all");
  const [selectedSelfieZoom, setSelectedSelfieZoom] = useState<string | null>(null);
  const [disputeActionMsg, setDisputeActionMsg] = useState<string>("");
  const [processingDisputeId, setProcessingDisputeId] = useState<number | null>(null);

  // Login Logs & Comparison state
  const [loginLogsData, setLoginLogsData] = useState<LoginLogsData | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsSubTab, setLogsSubTab] = useState<"logins" | "comparisons">("logins");
  const [comparisonLogsData, setComparisonLogsData] = useState<ComparisonLogsData | null>(null);
  const [compareLogsLoading, setCompareLogsLoading] = useState(false);

  // Scraper configuration
  const [mode, setMode] = useState<"single" | "range">("single");
  const [singleUsn, setSingleUsn] = useState("1RM25CS001");
  const [startUsn, setStartUsn] = useState("1RM25CS001");
  const [endUsn, setEndUsn] = useState("1RM25CS060");
  const [selectedSemesterLinkId, setSelectedSemesterLinkId] = useState<number | null>(null);
  const [customUrl, setCustomUrl] = useState("");
  const [useCustomUrl, setUseCustomUrl] = useState(false);

  // Dynamic Semester Links
  const [semesterLinks, setSemesterLinks] = useState<SemesterLink[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkSem, setNewLinkSem] = useState("1");
  const [addingLink, setAddingLink] = useState(false);
  const [linkActionMsg, setLinkActionMsg] = useState("");

  // Scraper status & Captcha
  const [status, setStatus] = useState<ScrapeStatus>({
    is_running: false,
    status: "idle",
    message: "Ready to scrape",
    processed_count: 0,
    total_count: 0,
    logs: [],
  });
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaZoom, setCaptchaZoom] = useState<1 | 2 | 3>(2);
  const [captchaInvert, setCaptchaInvert] = useState<boolean>(false);
  const [submittingCaptcha, setSubmittingCaptcha] = useState(false);

  // System & Browser Diagnostics
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus | null>(null);
  const [verifyingBrowser, setVerifyingBrowser] = useState(false);
  const [browserMsg, setBrowserMsg] = useState("");
  const [backendOnline, setBackendOnline] = useState(true);

  // Stored students management
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState("");
  const [actionError, setActionError] = useState("");

  // Socials edit modal
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editGithub, setEditGithub] = useState("");
  const [editLinkedin, setEditLinkedin] = useState("");
  const [savingSocials, setSavingSocials] = useState(false);
  const [saveSocialsMsg, setSaveSocialsMsg] = useState("");

  const captchaInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Check saved admin session on mount
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

  // Check backend health & browser status
  const checkHealthAndDiagnostics = async () => {
    const isHealthy = await checkBackendHealth();
    setBackendOnline(isHealthy);
    if (isHealthy) {
      const bStatus = await fetchBrowserStatus();
      setBrowserStatus(bStatus);
    }
  };

  useEffect(() => {
    checkHealthAndDiagnostics();
  }, []);

  // Load Semester Links
  const loadSemesterLinks = async () => {
    try {
      const links = await fetchSemesterLinks();
      setSemesterLinks(links);
      if (links.length > 0 && selectedSemesterLinkId === null) {
        const defaultLink = links.find((l) => l.is_default) || links[0];
        setSelectedSemesterLinkId(defaultLink.id);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSemesterLinks();
  }, []);

  // Load Students
  const loadStudentRecords = () => {
    fetchStudents({ sort: "recent" })
      .then((data) => setAllStudents(data))
      .catch(() => {});
  };

  // Load Disputes
  const loadDisputes = async () => {
    if (!adminKey) return;
    setDisputesLoading(true);
    try {
      const data = await fetchAdminDisputes(
        adminKey,
        disputeFilter === "all" ? undefined : disputeFilter
      );
      setDisputes(data);
    } catch (err) {
      console.error("Failed to load disputes", err);
    } finally {
      setDisputesLoading(false);
    }
  };

  // Load Login Logs
  const loadLoginLogs = async () => {
    if (!adminKey) return;
    setLogsLoading(true);
    try {
      const data = await fetchAdminLoginLogs(adminKey);
      setLoginLogsData(data);
    } catch (err) {
      console.error("Failed to load login logs", err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Load Comparison Tracker Logs
  const loadComparisonLogs = async () => {
    if (!adminKey) return;
    setCompareLogsLoading(true);
    try {
      const data = await fetchAdminComparisonLogs(adminKey);
      setComparisonLogsData(data);
    } catch (err) {
      console.error("Failed to load comparison logs", err);
    } finally {
      setCompareLogsLoading(false);
    }
  };

  const handleReviewDispute = async (id: number, action: "approve" | "reject", notes?: string) => {
    if (!adminKey) return;
    setProcessingDisputeId(id);
    setDisputeActionMsg("");
    sfx.playClick();
    try {
      const res = await reviewAdminDispute(id, action, notes, adminKey);
      setDisputeActionMsg(res.message);
      await loadDisputes();
      loadStudentRecords();
      sfx.playSonar();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to review dispute";
      setDisputeActionMsg(msg);
    } finally {
      setProcessingDisputeId(null);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadStudentRecords();
      if (activeTab === "disputes") {
        loadDisputes();
      } else if (activeTab === "logs") {
        loadLoginLogs();
        loadComparisonLogs();
      }
    }
  }, [isAuthenticated, activeTab, disputeFilter, logsSubTab]);

  // Status Polling
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
          const interval = data.is_running || data.captcha_base64 ? 1000 : 3000;
          timer = setTimeout(poll, interval);
        }
      } catch {
        if (alive) timer = setTimeout(poll, 4000);
      }
    };

    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  // Auto scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [status.logs]);

  // Admin Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setAuthError("");
    setIsVerifying(true);
    sfx.playClick();
    try {
      const ok = await verifyAdminPassword(passwordInput.trim());
      if (ok) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("vtu_admin_key", passwordInput.trim());
        }
        setAdminKey(passwordInput.trim());
        setIsAuthenticated(true);
        setPasswordInput("");
        sfx.playSonar();
      } else {
        setAuthError("Incorrect password. Please verify your admin password.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to reach backend server. Cold start may take ~45s.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    sfx.playClick();
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("vtu_admin_key");
    }
    setAdminKey("");
    setIsAuthenticated(false);
  };

  // Start Scraper
  const handleStart = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActionError("");
    sfx.playClick();

    const targetStart = mode === "single" ? singleUsn.trim().toUpperCase() : startUsn.trim().toUpperCase();
    const targetEnd = mode === "single" ? targetStart : endUsn.trim().toUpperCase();

    if (!targetStart) {
      setActionError("Please provide a valid USN.");
      return;
    }

    const payload: {
      start_usn: string;
      end_usn: string;
      semester: string;
      custom_url?: string;
      semester_link_id?: number;
    } = {
      start_usn: targetStart,
      end_usn: targetEnd,
      semester: "1",
    };

    if (useCustomUrl && customUrl.trim()) {
      payload.custom_url = customUrl.trim();
    } else if (selectedSemesterLinkId) {
      payload.semester_link_id = selectedSemesterLinkId;
      const foundLink = semesterLinks.find((l) => l.id === selectedSemesterLinkId);
      if (foundLink) {
        payload.semester = foundLink.semester;
      }
    }

    try {
      await startScraper(payload, adminKey);
    } catch (err: any) {
      if (err.message && (err.message.includes("401") || err.message.toLowerCase().includes("admin authorization"))) {
        handleLogout();
        setActionError("Session expired. Please sign in again.");
      } else {
        setActionError(err.message || "Failed to initiate scraper.");
      }
    }
  };

  // Stop Scraper
  const handleStop = async () => {
    sfx.playClick();
    try {
      await stopScraper(adminKey);
    } catch (err: any) {
      setActionError(err.message || "Failed to stop scraper");
    }
  };

  // Captcha Submit
  const handleCaptchaSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!captchaInput.trim() || submittingCaptcha) return;

    setSubmittingCaptcha(true);
    setActionError("");
    sfx.playClick();
    try {
      await submitScraperCaptcha(captchaInput.trim(), adminKey);
      setCaptchaInput("");
      sfx.playSonar();
    } catch (err: any) {
      setActionError(err.message || "Failed to submit captcha");
    } finally {
      setSubmittingCaptcha(false);
    }
  };

  // Semester Links CRUD
  const handleAddSemesterLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;

    setAddingLink(true);
    setLinkActionMsg("");
    setActionError("");
    sfx.playClick();

    try {
      const created = await createSemesterLink(
        {
          title: newLinkTitle.trim(),
          url: newLinkUrl.trim(),
          semester: newLinkSem.trim() || "1",
        },
        adminKey
      );
      setNewLinkTitle("");
      setNewLinkUrl("");
      setNewLinkSem("1");
      setLinkActionMsg(`Added "${created.title}" successfully!`);
      await loadSemesterLinks();
      setSelectedSemesterLinkId(created.id);
      setTimeout(() => setLinkActionMsg(""), 3000);
    } catch (err: any) {
      setActionError(err.message || "Failed to add semester link");
    } finally {
      setAddingLink(false);
    }
  };

  const handleDeleteSemesterLink = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to remove semester portal link "${title}"?`)) return;

    setActionError("");
    sfx.playClick();
    try {
      await deleteSemesterLink(id, adminKey);
      setLinkActionMsg(`Deleted "${title}".`);
      await loadSemesterLinks();
      if (selectedSemesterLinkId === id) {
        setSelectedSemesterLinkId(semesterLinks.length > 1 ? semesterLinks[0].id : null);
      }
      setTimeout(() => setLinkActionMsg(""), 3000);
    } catch (err: any) {
      setActionError(err.message || "Failed to delete semester link");
    }
  };

  // Verify / Prewarm Playwright Browser
  const handleVerifyBrowser = async () => {
    setVerifyingBrowser(true);
    setBrowserMsg("");
    sfx.playClick();
    try {
      const res = await installBrowser(adminKey);
      setBrowserMsg(res.message);
      await checkHealthAndDiagnostics();
    } catch (err: any) {
      setBrowserMsg(err.message || "Browser check failed.");
    } finally {
      setVerifyingBrowser(false);
    }
  };

  // Student Delete & Socials
  const handleDeleteStudent = async (usn: string) => {
    if (!confirm(`Permanently delete student ${usn} and all associated marks from Supabase?`)) return;
    setActionError("");
    sfx.playClick();
    try {
      await deleteStudent(usn, adminKey);
      setDeleteSuccessMsg(`Student ${usn} deleted successfully.`);
      setTimeout(() => setDeleteSuccessMsg(""), 3500);
      loadStudentRecords();
    } catch (err: any) {
      setActionError(err.message || "Failed to delete student.");
    }
  };

  const handleOpenEditSocials = (student: Student) => {
    sfx.playClick();
    setEditingStudent(student);
    setEditGithub(student.github_url || "");
    setEditLinkedin(student.linkedin_url || "");
    setSaveSocialsMsg("");
  };

  const handleSaveSocials = async () => {
    if (!editingStudent) return;
    setSavingSocials(true);
    setSaveSocialsMsg("");
    setActionError("");
    sfx.playClick();
    try {
      await updateStudentSocials(
        editingStudent.usn,
        { github_url: editGithub, linkedin_url: editLinkedin },
        adminKey
      );
      setSaveSocialsMsg("Social accounts saved successfully!");
      loadStudentRecords();
      setTimeout(() => {
        setEditingStudent(null);
        setSaveSocialsMsg("");
      }, 1200);
    } catch (err: any) {
      setActionError(err.message || "Failed to update profiles.");
    } finally {
      setSavingSocials(false);
    }
  };

  const handleQuickBranch = (code: string) => {
    sfx.playClick();
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
    status.total_count > 0 ? Math.round((status.processed_count / status.total_count) * 100) : 0;

  // -------------------------------------------------------------
  // Render: Loading Screen
  // -------------------------------------------------------------
  if (checkingAuth) {
    return (
      <div className="max-w-md mx-auto my-28 p-8 text-center text-slate-400 font-medium text-xs sm:text-sm">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-3" />
        Verifying administrator credentials...
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render: Login Screen
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-md mx-auto my-6 sm:my-16 px-3 sm:px-0">
        <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto text-lg font-bold shadow-sm">
              🔒
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Admin Portal</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              Manage VTU scraping queues, configure examination semester links, and inspect student records.
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
                placeholder="Enter admin password"
                className="w-full p-3 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-mono"
                autoFocus
              />
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl leading-relaxed">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying || !passwordInput.trim()}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {isVerifying ? "Verifying..." : "Sign In to Admin Portal"}
            </button>

            <div className="text-center pt-2">
              <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                ← Return to Student Directory
              </Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render: Main Admin Dashboard
  // -------------------------------------------------------------
  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-6 space-y-4 sm:space-y-6 pb-24 sm:pb-16 min-h-screen">
      {/* Top Header */}
      <div className="border-b border-slate-200/80 pb-3 sm:pb-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            onClick={() => sfx.playClick()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition-colors"
          >
            ← Results Dashboard
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 transition-colors shadow-2xs"
          >
            Sign Out
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
              Admin Control Room
            </h1>
            <p className="text-slate-500 text-[11px] sm:text-xs">
              Scraper queues, semester links, USN claims verification, and student login audits.
            </p>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  status.is_running
                    ? "bg-emerald-500 animate-ping"
                    : status.status === "error"
                    ? "bg-rose-500"
                    : "bg-slate-300"
                }`}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                {status.is_running ? "Scraping..." : status.status === "error" ? "Error" : "Idle"}
              </span>
            </div>

            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-2xs ${
                browserStatus?.status === "ready"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              <span>{browserStatus?.status === "ready" ? "Browser Ready ✅" : "Browser ⚠️"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl font-medium flex items-center justify-between shadow-xs">
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} className="text-rose-500 hover:text-rose-800 text-xs font-bold p-1">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {deleteSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-2xl font-medium flex items-center justify-between shadow-xs">
          <span>{deleteSuccessMsg}</span>
          <button onClick={() => setDeleteSuccessMsg("")} className="text-emerald-500 hover:text-emerald-800 text-xs font-bold p-1">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mobile-First Tab Navigation (Responsive 3-col grid on mobile, flex row on tablet/desktop) */}
      <div className="grid grid-cols-3 sm:flex items-center gap-1 sm:gap-1.5 bg-slate-100 p-1 sm:p-1.5 rounded-2xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setActiveTab("scraper");
          }}
          className={`py-2 px-1.5 sm:px-3 text-[11px] sm:text-xs font-bold rounded-xl transition-all text-center sm:flex-1 flex items-center justify-center gap-1 ${
            activeTab === "scraper"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <span>🚀</span>
          <span>Scraper</span>
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setActiveTab("semesters");
          }}
          className={`py-2 px-1.5 sm:px-3 text-[11px] sm:text-xs font-bold rounded-xl transition-all text-center sm:flex-1 flex items-center justify-center gap-1 ${
            activeTab === "semesters"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <span>🔗</span>
          <span>Semesters</span>
          <span className="hidden sm:inline text-[9px] px-1 py-0.2 rounded-full bg-slate-200 text-slate-700 font-mono">
            {semesterLinks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setActiveTab("records");
          }}
          className={`py-2 px-1.5 sm:px-3 text-[11px] sm:text-xs font-bold rounded-xl transition-all text-center sm:flex-1 flex items-center justify-center gap-1 ${
            activeTab === "records"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <span>👥</span>
          <span>Students</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-mono">
            {allStudents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setActiveTab("disputes");
            loadDisputes();
          }}
          className={`py-2 px-1.5 sm:px-3 text-[11px] sm:text-xs font-bold rounded-xl transition-all text-center sm:flex-1 flex items-center justify-center gap-1 ${
            activeTab === "disputes"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <span>🛡️</span>
          <span>Claims</span>
          {disputes.filter((d) => d.status === "pending").length > 0 && (
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-mono animate-pulse font-bold">
              {disputes.filter((d) => d.status === "pending").length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setActiveTab("logs");
            loadLoginLogs();
          }}
          className={`py-2 px-1.5 sm:px-3 text-[11px] sm:text-xs font-bold rounded-xl transition-all text-center sm:flex-1 flex items-center justify-center gap-1 ${
            activeTab === "logs"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <span>📋</span>
          <span>Logs</span>
          {loginLogsData && (
            <span className="hidden sm:inline text-[9px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-mono">
              {loginLogsData.total_logins}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setActiveTab("system");
          }}
          className={`py-2 px-1.5 sm:px-3 text-[11px] sm:text-xs font-bold rounded-xl transition-all text-center sm:flex-1 flex items-center justify-center gap-1 ${
            activeTab === "system"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <span>⚙️</span>
          <span>System</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: SCRAPER ENGINE                                         */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "scraper" && (
        <div className="space-y-6">
          {/* Main Control Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
            {/* Mode Selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Scraping Target Mode
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    setMode("single");
                  }}
                  className={`py-2 text-xs font-bold rounded-xl transition-all ${
                    mode === "single"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Single Student USN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    setMode("range");
                  }}
                  className={`py-2 text-xs font-bold rounded-xl transition-all ${
                    mode === "range"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Batch Range Scraper (e.g. 001–060)
                </button>
              </div>
            </div>

            {/* Target Examination / Semester Links Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Target Examination Portal Link
                </label>
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    setActiveTab("semesters");
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:underline"
                >
                  + Add / Edit Portal Links
                </button>
              </div>

              {/* Dynamic Semester Link Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {semesterLinks.map((link) => {
                  const isSelected = !useCustomUrl && selectedSemesterLinkId === link.id;
                  return (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => {
                        sfx.playClick();
                        setUseCustomUrl(false);
                        setSelectedSemesterLinkId(link.id);
                      }}
                      disabled={status.is_running}
                      className={`p-3 rounded-2xl border text-left transition-all relative ${
                        isSelected
                          ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50 bg-white"
                      } disabled:opacity-50`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-bold truncate">{link.title}</span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full uppercase shrink-0 font-bold ${
                            isSelected
                              ? "bg-slate-800 text-slate-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          Sem {link.semester}
                        </span>
                      </div>
                      <div
                        className={`text-[10px] truncate mt-1 font-mono ${
                          isSelected ? "text-slate-300" : "text-slate-400"
                        }`}
                      >
                        {link.url}
                      </div>
                    </button>
                  );
                })}

                {/* Custom URL Option */}
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    setUseCustomUrl(true);
                  }}
                  disabled={status.is_running}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    useCustomUrl
                      ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50 bg-white"
                  } disabled:opacity-50`}
                >
                  <div className="text-xs sm:text-sm font-bold">Custom Portal URL</div>
                  <div
                    className={`text-[10px] mt-1 ${
                      useCustomUrl ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    Enter any VTU index.php result endpoint manually
                  </div>
                </button>
              </div>

              {useCustomUrl && (
                <div className="mt-3">
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://results.vtu.ac.in/.../index.php"
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Make sure the URL points to <code>index.php</code> (the student USN entry page).
                  </p>
                </div>
              )}
            </div>

            {/* Quick Branch Autofill */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Quick Branch Autofill (2025 Batch)
              </label>
              <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5">
                {QUICK_BRANCHES.map((b) => (
                  <button
                    key={b.code}
                    type="button"
                    onClick={() => handleQuickBranch(b.code)}
                    disabled={status.is_running}
                    className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] sm:text-xs font-bold text-slate-700 disabled:opacity-50 transition-colors text-center"
                  >
                    {b.name} ({b.code})
                  </button>
                ))}
              </div>
            </div>

            {/* USN Input Form */}
            <form onSubmit={handleStart} className="space-y-4 pt-1 border-t border-slate-100">
              {mode === "single" ? (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Student USN
                  </label>
                  <input
                    type="text"
                    value={singleUsn}
                    onChange={(e) => setSingleUsn(e.target.value.toUpperCase())}
                    placeholder="e.g. 1RM25CD052"
                    disabled={status.is_running}
                    className="w-full p-3 font-mono text-base uppercase font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50"
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
                      className="w-full p-3 font-mono text-base sm:text-sm uppercase font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50"
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
                      className="w-full p-3 font-mono text-base sm:text-sm uppercase font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50"
                    />
                  </div>
                </div>
              )}

              {/* Start / Stop Button */}
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

          {/* Scraper Progress Bar */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3">
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
                <span>
                  Querying: <strong className="font-mono text-slate-800">{status.current_usn}</strong>
                </span>
                <span>
                  Range: {status.start_usn} → {status.end_usn}
                </span>
              </div>
            )}
          </div>

          {/* Interactive Captcha Solving Card */}
          {status.captcha_base64 && (
            <div className="bg-amber-50/90 border-2 border-amber-300 rounded-3xl p-5 sm:p-7 shadow-lg space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 px-2 py-0.5 rounded bg-amber-200/70">
                    Action Required
                  </span>
                  <h3 className="font-black text-amber-950 text-base sm:text-lg mt-1">
                    Solve Captcha for <span className="font-mono text-blue-700">{status.current_usn}</span>
                  </h3>
                </div>

                {/* Captcha Controls */}
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-amber-200 shadow-xs self-start sm:self-auto">
                  <span className="text-[10px] font-bold text-slate-400 px-1">Zoom:</span>
                  {([1, 2, 3] as const).map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setCaptchaZoom(z)}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-lg ${
                        captchaZoom === z ? "bg-amber-500 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
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

              {/* Captcha Image & Form */}
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
                      className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs disabled:opacity-50 whitespace-nowrap"
                    >
                      {submittingCaptcha ? "Submitting..." : "Submit Captcha"}
                    </button>
                  </div>

                  {/* Character Breakdown */}
                  {captchaInput && (
                    <div className="p-2.5 rounded-xl bg-amber-100/50 border border-amber-200">
                      <p className="text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1.5 text-center">
                        Verify Case Sensitivity:
                      </p>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {captchaInput.split("").map((ch, idx) => {
                          const isLower = /[a-z]/.test(ch);
                          const isUpper = /[A-Z]/.test(ch);
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
                              <span className="text-[9px] uppercase font-bold opacity-75">
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

              <p className="text-[11px] text-amber-800 text-center font-medium">
                Tip: Press <kbd className="px-1.5 py-0.5 bg-amber-200/70 rounded font-mono font-bold">Enter</kbd> to submit immediately.
              </p>
            </div>
          )}

          {/* Terminal Scraper Output */}
          <div className="bg-slate-900 rounded-3xl p-5 text-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Live Scraping Activity Log
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Stream Active</span>
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
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: SEMESTER LINKS MANAGER                                 */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "semesters" && (
        <div className="space-y-4 sm:space-y-6">
          {/* Add Semester Link Card */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Add New Semester Result Portal Link</h2>
              <p className="text-xs text-slate-500">
                Configure any VTU examination result portal URL to scrape from. These are stored permanently in Supabase.
              </p>
            </div>

            {linkActionMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-medium">
                {linkActionMsg}
              </div>
            )}

            <form onSubmit={handleAddSemesterLink} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Semester Title / Label
                  </label>
                  <input
                    type="text"
                    value={newLinkTitle}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                    placeholder="e.g. Sem 1 & 2 (2022 Scheme - Jan/Feb 2026)"
                    className="w-full p-2.5 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Semester Number
                  </label>
                  <select
                    value={newLinkSem}
                    onChange={(e) => setNewLinkSem(e.target.value)}
                    className="w-full p-2.5 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                      <option key={num} value={String(num)}>
                        Semester {num}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  VTU Portal URL (index.php)
                </label>
                <input
                  type="url"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="https://results.vtu.ac.in/MJ26cbcs/index.php"
                  className="w-full p-2.5 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                  required
                />
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={addingLink || !newLinkTitle.trim() || !newLinkUrl.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 text-center"
                >
                  {addingLink ? "Saving..." : "Add Semester Portal Link"}
                </button>
              </div>
            </form>
          </div>

          {/* List of Configured Semester Links */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Configured Semester Links ({semesterLinks.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Select, copy, or delete examination portal links.
                </p>
              </div>
            </div>

            {semesterLinks.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">
                No custom semester links configured. Add one above.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {semesterLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">{link.title}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                          Sem {link.semester}
                        </span>
                        {selectedSemesterLinkId === link.id && !useCustomUrl && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Active in Scraper
                          </span>
                        )}
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-blue-600 hover:underline truncate block mt-1"
                      >
                        {link.url}
                      </a>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          sfx.playClick();
                          setUseCustomUrl(false);
                          setSelectedSemesterLinkId(link.id);
                          setActiveTab("scraper");
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
                      >
                        Use in Scraper
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSemesterLink(link.id, link.title)}
                        title={`Delete ${link.title}`}
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
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: STUDENT RECORDS MANAGEMENT                             */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "records" && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                Permanent Student Records in Supabase ({allStudents.length})
              </h2>
              <p className="text-xs text-slate-400">Search students, manage GitHub/LinkedIn links, or delete records.</p>
            </div>

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search USN, name, or branch..."
                className="w-full pl-8 pr-3 py-2 sm:py-1.5 rounded-xl border border-slate-200 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <span className="absolute left-2.5 top-2.5 text-slate-400">
                <IconSearch className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {filteredStoredStudents.length === 0 ? (
            <p className="text-center py-12 text-xs text-slate-400">
              {studentSearch ? "No students matching your search criteria." : "No student records currently stored."}
            </p>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {filteredStoredStudents.map((s) => (
                <div
                  key={s.usn}
                  className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <Identicon
                      usn={s.usn}
                      percentage={s.percentage}
                      totalBacklogs={s.total_backlogs}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">{s.name}</span>
                        <span className="text-[10px] font-bold text-slate-500 px-1.5 py-0.2 rounded bg-slate-100 uppercase">
                          {s.branch}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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

                  <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                    <div className="text-left sm:text-right">
                      <span className="font-bold text-xs text-slate-900">{s.percentage.toFixed(1)}%</span>
                      <span className="text-[10px] text-slate-400 block sm:inline sm:ml-1">({s.total_marks} pts)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          s.total_backlogs > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {s.total_backlogs === 0 ? "0 BL" : `${s.total_backlogs} BL`}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleOpenEditSocials(s)}
                        title={`Edit Socials for ${s.name}`}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        Socials
                      </button>

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
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB: USN OWNERSHIP CLAIMS & DISPUTES                          */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "disputes" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">🛡️ USN Ownership Claims &amp; Disputes</h2>
                <p className="text-xs text-slate-500">
                  Review selfie verifications submitted by genuine students claiming their USN ownership.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  {["all", "pending", "approved", "rejected"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        sfx.playClick();
                        setDisputeFilter(f);
                      }}
                      className={`px-2 sm:px-2.5 py-1 rounded-lg font-bold capitalize transition-colors text-[11px] sm:text-xs ${
                        disputeFilter === f ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    loadDisputes();
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            {disputeActionMsg && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl font-medium flex items-center justify-between">
                <span>{disputeActionMsg}</span>
                <button onClick={() => setDisputeActionMsg("")} className="text-blue-500 hover:text-blue-800 font-bold">
                  ✕
                </button>
              </div>
            )}

            {disputesLoading ? (
              <div className="text-center py-12 text-xs text-slate-400">Loading dispute requests...</div>
            ) : disputes.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
                <span className="text-2xl">🛡️</span>
                <p className="font-bold text-xs text-slate-700 mt-2">No dispute requests found</p>
                <p className="text-[11px] text-slate-400">
                  {disputeFilter === "all"
                    ? "No students have submitted dispute claims yet."
                    : `No disputes matching filter '${disputeFilter}'.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                {disputes.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-900 px-2 py-0.5 rounded bg-slate-100">
                            {d.usn}
                          </span>
                          <span className="text-[10px] font-bold text-slate-600 uppercase px-1.5 py-0.2 rounded bg-slate-100">
                            {d.branch}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-900 mt-1">{d.name}</h3>
                        {d.created_at && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Submitted: {new Date(d.created_at).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <span
                        className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                          d.status === "pending"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : d.status === "approved"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-rose-100 text-rose-800 border border-rose-200"
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>

                    {/* Selfie Preview */}
                    <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div
                        onClick={() => setSelectedSelfieZoom(d.selfie_base64)}
                        className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 shrink-0 relative group"
                        title="Click to zoom selfie"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={d.selfie_base64}
                          alt={`Selfie of ${d.name}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                          Zoom
                        </span>
                      </div>
                      <div className="text-xs min-w-0">
                        <p className="font-semibold text-slate-700">Verification Selfie</p>
                        <button
                          type="button"
                          onClick={() => setSelectedSelfieZoom(d.selfie_base64)}
                          className="text-[11px] text-blue-600 hover:underline font-medium block mt-0.5"
                        >
                          🔍 Tap to inspect full photo
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    {d.status === "pending" ? (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          disabled={processingDisputeId === d.id}
                          onClick={() => handleReviewDispute(d.id, "approve")}
                          className="flex-1 py-2.5 px-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50 text-center"
                        >
                          {processingDisputeId === d.id ? "Processing..." : "✓ Approve & Transfer"}
                        </button>
                        <button
                          type="button"
                          disabled={processingDisputeId === d.id}
                          onClick={() => {
                            const notes = prompt("Enter rejection reason (optional):") || undefined;
                            handleReviewDispute(d.id, "reject", notes);
                          }}
                          className="py-2.5 px-3 text-xs font-bold rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 text-center"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                        <span>
                          Reviewed: {d.reviewed_at ? new Date(d.reviewed_at).toLocaleDateString() : "Done"}
                        </span>
                        {d.admin_notes && (
                          <span className="text-slate-400 italic">Note: {d.admin_notes}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB: LOGIN & COMPARISON AUDIT LOGS                            */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "logs" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {logsSubTab === "logins" ? "📋 Student Login Audit Logs" : "🔍 Student Comparison Tracker"}
                </h2>
                <p className="text-xs text-slate-500">
                  {logsSubTab === "logins"
                    ? "Real-time record of students who logged in, how many times, with timestamps and network IPs."
                    : "Real-time record of which students compared themselves or their peers to whom."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  if (logsSubTab === "logins") loadLoginLogs();
                  else loadComparisonLogs();
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors self-start sm:self-auto"
              >
                ↻ Refresh
              </button>
            </div>

            {/* Sub-tab switcher: Logins vs Comparisons */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  setLogsSubTab("logins");
                  loadLoginLogs();
                }}
                className={`py-1.5 px-3 text-xs font-bold rounded-xl transition-all ${
                  logsSubTab === "logins"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                📋 Student Logins ({loginLogsData?.total_logins || 0})
              </button>

              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  setLogsSubTab("comparisons");
                  loadComparisonLogs();
                }}
                className={`py-1.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                  logsSubTab === "comparisons"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>🔍 Who Compared Whom</span>
                {comparisonLogsData && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700 text-white font-mono">
                    {comparisonLogsData.total_comparisons}
                  </span>
                )}
              </button>
            </div>

            {logsSubTab === "comparisons" ? (
              compareLogsLoading ? (
                <div className="text-center py-12 text-xs text-slate-400">Loading student comparison tracker...</div>
              ) : !comparisonLogsData || comparisonLogsData.recent_logs.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
                  <span className="text-2xl">🔍</span>
                  <p className="font-bold text-xs text-slate-700 mt-2">No comparisons recorded yet</p>
                  <p className="text-[11px] text-slate-400">
                    Whenever students compare themselves or peers, the exact who-compared-whom record appears here for the admin.
                  </p>
                </div>
              ) : (
                <>
                  {/* Metrics Cards */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50/60 text-center sm:text-left">
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                        Comparisons
                      </span>
                      <p className="text-lg sm:text-2xl font-black font-mono text-slate-900 mt-0.5 sm:mt-1">
                        {comparisonLogsData.total_comparisons}
                      </p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50/60 text-center sm:text-left">
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                        Most Compared Peer
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-emerald-600 mt-1 truncate">
                        {comparisonLogsData.top_targets[0]
                          ? `${comparisonLogsData.top_targets[0].name.split(" ")[0]} (${comparisonLogsData.top_targets[0].count}x)`
                          : "None"}
                      </p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50/60 text-center sm:text-left">
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                        Active Viewer
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 mt-1 truncate">
                        {comparisonLogsData.active_viewers[0]
                          ? `${comparisonLogsData.active_viewers[0].name || comparisonLogsData.active_viewers[0].usn}`
                          : "Anonymous"}
                      </p>
                    </div>
                  </div>

                  {/* Top Targeted Students Leaderboard */}
                  {comparisonLogsData.top_targets.length > 0 && (
                    <div className="space-y-2.5">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                        Most Compared-Against Students (Peers Being Checked)
                      </h3>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                        {comparisonLogsData.top_targets.map((target) => (
                          <div
                            key={target.usn}
                            className="p-2.5 sm:p-3 flex items-center justify-between text-xs hover:bg-slate-50/50"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-slate-900 shrink-0">{target.usn}</span>
                              <span className="text-slate-700 truncate">{target.name}</span>
                              <span className="text-[10px] text-slate-400 uppercase shrink-0">({target.branch})</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold shrink-0">
                              {target.count} peer compares
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Real-time Who Compared Whom Live Stream */}
                  <div className="space-y-2.5">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                      Live Stream: Who Compared Themselves To Whom
                    </h3>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {comparisonLogsData.recent_logs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50/50"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-500">Initiator:</span>
                              <span className="font-bold text-slate-900 px-1.5 py-0.5 rounded bg-slate-100 font-mono">
                                {log.viewer_name ? `${log.viewer_name} (${log.viewer_usn || "guest"})` : log.viewer_usn || "Anonymous Visitor"}
                              </span>
                              <span className="text-slate-400 font-bold">compared</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-700 flex-wrap">
                              <span className="font-semibold text-blue-700">{log.student1_name} ({log.student1_usn})</span>
                              <span className="font-bold text-slate-400">vs</span>
                              <span className="font-semibold text-purple-700">{log.student2_name} ({log.student2_usn})</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 text-[11px] text-slate-400 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                            {log.ip_address && (
                              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">
                                IP: {log.ip_address}
                              </span>
                            )}
                            {log.compared_at && (
                              <span className="font-mono text-[10px]">
                                {new Date(log.compared_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.compared_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )
            ) : logsLoading ? (
              <div className="text-center py-12 text-xs text-slate-400">Loading audit logs...</div>
            ) : !loginLogsData ? (
              <div className="text-center py-12 text-xs text-slate-400">No login logs available.</div>
            ) : (
              <>
                {/* Metrics Cards: 3 columns on all screen sizes */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50/60 text-center sm:text-left">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                      Total Logins
                    </span>
                    <p className="text-lg sm:text-2xl font-black font-mono text-slate-900 mt-0.5 sm:mt-1">
                      {loginLogsData.total_logins}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50/60 text-center sm:text-left">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                      Unique Students
                    </span>
                    <p className="text-lg sm:text-2xl font-black font-mono text-emerald-600 mt-0.5 sm:mt-1">
                      {loginLogsData.unique_students}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50/60 text-center sm:text-left">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                      Top User
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 mt-1 truncate">
                      {loginLogsData.frequency[0]
                        ? `${loginLogsData.frequency[0].name.split(" ")[0]} (${loginLogsData.frequency[0].login_count}x)`
                        : "None"}
                    </p>
                  </div>
                </div>

                {/* Most Active Frequency Table */}
                <div className="space-y-2.5">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Student Login Frequency
                  </h3>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {loginLogsData.frequency.length === 0 ? (
                      <p className="text-xs text-slate-400 p-4 text-center">No student logins recorded yet.</p>
                    ) : (
                      loginLogsData.frequency.map((item) => (
                        <div
                          key={item.usn}
                          className="p-2.5 sm:p-3 flex items-center justify-between text-xs hover:bg-slate-50/50"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                            <span className="font-mono font-bold text-slate-900 shrink-0">{item.usn}</span>
                            <span className="text-slate-600 truncate">• {item.name}</span>
                            <span className="text-[10px] text-slate-400 uppercase shrink-0">({item.branch})</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                              {item.login_count}x
                            </span>
                            {item.last_login && (
                              <span className="text-[10px] text-slate-400 hidden sm:inline">
                                {new Date(item.last_login).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Login Audit Stream */}
                <div className="space-y-2.5">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Recent Login Audit Stream
                  </h3>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {loginLogsData.recent_logs.length === 0 ? (
                      <p className="text-xs text-slate-400 p-4 text-center">No logins recorded yet.</p>
                    ) : (
                      loginLogsData.recent_logs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs hover:bg-slate-50/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="font-mono font-bold text-slate-900 shrink-0">{log.usn}</span>
                            <span className="text-slate-700 truncate">{log.name}</span>
                            <span className="text-[10px] text-slate-400 uppercase shrink-0">({log.branch})</span>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 text-[11px] text-slate-500 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            {log.ip_address && (
                              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">
                                IP: {log.ip_address}
                              </span>
                            )}
                            <span className="text-slate-400 font-mono text-[10px]">
                              {new Date(log.login_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.login_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: SYSTEM & PLAYWRIGHT DIAGNOSTICS                        */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "system" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Host &amp; Browser Engine Diagnostics</h2>
              <p className="text-xs text-slate-500">
                Verify Playwright Chromium installation status to prevent scraper launch errors.
              </p>
            </div>

            {browserMsg && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl font-medium">
                {browserMsg}
              </div>
            )}

            {/* Status Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Backend API Service
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`w-2 h-2 rounded-full ${backendOnline ? "bg-emerald-500" : "bg-rose-500"}`}
                  />
                  <span className="text-xs sm:text-sm font-bold text-slate-900">
                    {backendOnline ? "Online (Healthy)" : "Offline"}
                  </span>
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Playwright Chromium
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      browserStatus?.status === "ready" ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="text-xs sm:text-sm font-bold text-slate-900">
                    {browserStatus?.status === "ready" ? "Ready & Installed" : "Not Detected"}
                  </span>
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Operating Platform
                </span>
                <div className="text-xs sm:text-sm font-bold text-slate-900 mt-1 capitalize font-mono">
                  {browserStatus?.platform || "Linux / Windows"}
                </div>
              </div>
            </div>

            {/* Detected Cache Paths */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Detected Browser Cache Paths
              </label>
              {browserStatus?.detected_paths && browserStatus.detected_paths.length > 0 ? (
                <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-xs space-y-1 overflow-x-auto">
                  {browserStatus.detected_paths.map((p, i) => (
                    <div key={i} className="truncate text-emerald-400">
                      ✓ {p}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                  No default Chromium browser cache was detected in standard directories. Click below to verify or prewarm the browser.
                </p>
              )}
            </div>

            {/* Prewarm / Check Browser Button */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Playwright self-healing auto-installs Chromium if missing during scrape.
              </span>
              <button
                type="button"
                onClick={handleVerifyBrowser}
                disabled={verifyingBrowser}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 text-center"
              >
                {verifyingBrowser ? "Verifying Chromium..." : "Verify / Prewarm Browser"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Socials Edit Modal                                            */}
      {/* ------------------------------------------------------------- */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Profile Editor
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
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50"
              >
                {savingSocials ? "Saving..." : "Save Profiles"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selfie Fullscreen Zoom Modal */}
      {selectedSelfieZoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          onClick={() => setSelectedSelfieZoom(null)}
        >
          <div
            className="relative max-w-lg w-full bg-slate-900 border border-white/10 rounded-2xl p-3 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-white text-xs font-bold tracking-tight">
                📸 Identity Verification Selfie
              </span>
              <button
                onClick={() => setSelectedSelfieZoom(null)}
                className="text-white/60 hover:text-white p-1 rounded-lg"
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[75vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedSelfieZoom}
                alt="Enlarged verification selfie"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
