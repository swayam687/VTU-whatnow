"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  fetchAdminMissingUsnReports,
  resolveAdminMissingUsnReport,
  ComparisonLogsData,
  MissingUSNReportRecord,
  RescrapeRequestRecord,
  SemesterAuditData,
  fetchAdminRescrapeRequests,
  actionAdminRescrapeRequest,
  fetchAdminSemesterAudit,
  recalculateCumulativeTotals,
  toggleAdminStudentVisibility,
  fetchScrapeTargets,
  createScrapeTarget,
  deleteScrapeTarget,
  ScrapeTarget,
  updateStudentCredits,
  deleteCompareLog,
  deleteLoginLog,
  clearAllAdminLogs,
  deleteRescrapeRequest,
  deleteMissingReport,
  deleteDisputeRecord,
  fetchLiveCreditsSync,
  fetchAdminFacultyAudits,
  FacultyAuditsData,
  fetchAdminInsights,
  updateAdminInsightsOffset,
  AdminInsightsResponse,
  AdminInsightsItem,
} from "../../lib/api";
import {
  IconSearch,
  IconClose,
  IconTrash,
  IconCheck,
  IconExternalLink,
  IconGitHub,
  IconLinkedIn,
  IconBolt,
  IconLayers,
  IconUsers,
  IconShield,
  IconBell,
  IconFileText,
  IconSettings,
  IconLock,
  IconRotateCcw,
  IconEye,
  IconCompare,
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

function formatDateTime(isoString?: string | null): { date: string; time: string; full: string } {
  if (!isoString) return { date: "-", time: "-", full: "-" };
  let normalized = isoString.trim();
  if (!normalized.includes("T")) {
    normalized = normalized.replace(" ", "T");
  }
  // If no timezone offset (+HH:MM or Z), treat as UTC by appending Z so browser converts to local time
  if (!normalized.endsWith("Z") && !normalized.includes("+") && !/-\d\d:\d\d$/.test(normalized)) {
    normalized = `${normalized}Z`;
  }
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return { date: isoString, time: "", full: isoString };
  return {
    date: d.toLocaleDateString(),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    full: `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
  };
}

export default function AdminPanel() {
  // Theme state (Obsidian Dark Mode vs Clean Paper Mode)
  const [isObsidian, setIsObsidian] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("vtu_theme");
    const obsidian = savedTheme !== "paper";
    setIsObsidian(obsidian);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", obsidian);
      document.body.className = obsidian ? "theme-obsidian dark" : "theme-paper";
    }
  }, []);

  const handleToggleTheme = () => {
    sfx.playClick();
    setIsObsidian((prev) => {
      const next = !prev;
      localStorage.setItem("vtu_theme", next ? "obsidian" : "paper");
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next);
        document.body.className = next ? "theme-obsidian dark" : "theme-paper";
      }
      return next;
    });
  };

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [adminKey, setAdminKey] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Active top-level tab: 'scraper' | 'semesters' | 'records' | 'disputes' | 'missing_usn' | 'logs' | 'system' | 'audit' | 'faculty_audits'
  const [activeTab, setActiveTab] = useState<"scraper" | "semesters" | "records" | "disputes" | "missing_usn" | "logs" | "system" | "audit" | "faculty_audits">("scraper");

  // Faculty Audits state
  const [facultyAuditsData, setFacultyAuditsData] = useState<FacultyAuditsData | null>(null);
  const [facultyAuditsLoading, setFacultyAuditsLoading] = useState(false);
  const [facultyAuditsError, setFacultyAuditsError] = useState("");
  const [facultyAuditsSubTab, setFacultyAuditsSubTab] = useState<"logins" | "comparisons">("logins");

  const loadFacultyAudits = async () => {
    if (!adminKey) return;
    setFacultyAuditsLoading(true);
    setFacultyAuditsError("");
    try {
      const data = await fetchAdminFacultyAudits(adminKey);
      setFacultyAuditsData(data);
    } catch (err: unknown) {
      setFacultyAuditsError(err instanceof Error ? err.message : "Failed to load faculty audits");
    } finally {
      setFacultyAuditsLoading(false);
    }
  };


  // Profile Insights & Verifications State
  const [adminInsights, setAdminInsights] = useState<AdminInsightsResponse | null>(null);
  const [adminInsightsLoading, setAdminInsightsLoading] = useState(false);
  const [insightsSearch, setInsightsSearch] = useState("");
  const [adjustingUsn, setAdjustingUsn] = useState<string | null>(null);

  const loadAdminInsights = async (search?: string) => {
    if (!adminKey) return;
    setAdminInsightsLoading(true);
    try {
      const data = await fetchAdminInsights(adminKey, search);
      setAdminInsights(data);
    } catch {
      // ignore
    } finally {
      setAdminInsightsLoading(false);
    }
  };

  const handleAdjustInsights = async (
    usn: string,
    viewsDelta?: number,
    compsDelta?: number
  ) => {
    if (!adminKey) return;
    setAdjustingUsn(usn);
    sfx.playMechanicalClick();
    try {
      await updateAdminInsightsOffset(adminKey, usn, {
        views_offset_delta: viewsDelta,
        comparisons_offset_delta: compsDelta,
      });
      await loadAdminInsights(insightsSearch);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to adjust insights");
    } finally {
      setAdjustingUsn(null);
    }
  };

  // Re-scrape / Revaluation Requests state
  const [rescrapeRequests, setRescrapeRequests] = useState<RescrapeRequestRecord[]>([]);
  const [rescrapeLoading, setRescrapeLoading] = useState(false);
  const [rescrapeFilter, setRescrapeFilter] = useState<string>("all");
  const [requestsSubTab, setRequestsSubTab] = useState<"rescrape" | "missing">("rescrape");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>("");

  // Semester Coverage Audit state
  const [semesterAudit, setSemesterAudit] = useState<SemesterAuditData | null>(null);
  const [semesterAuditLoading, setSemesterAuditLoading] = useState(false);
  const [semesterAuditFilter, setSemesterAuditFilter] = useState<"all" | "missing_sem2" | "missing_sem1" | "complete">("all");
  const [semesterAuditSearch, setSemesterAuditSearch] = useState<string>("");

  // USN Disputes state
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [disputeFilter, setDisputeFilter] = useState<string>("all");
  const [selectedSelfieZoom, setSelectedSelfieZoom] = useState<string | null>(null);
  const [disputeActionMsg, setDisputeActionMsg] = useState<string>("");
  const [processingDisputeId, setProcessingDisputeId] = useState<number | null>(null);

  // Missing USN reports state
  const [missingReports, setMissingReports] = useState<MissingUSNReportRecord[]>([]);
  const [missingReportsLoading, setMissingReportsLoading] = useState(false);
  const [missingFilter, setMissingFilter] = useState<"all" | "pending" | "resolved">("pending");

  // Records visibility filter & direct toggle
  const [recordsVisibilityFilter, setRecordsVisibilityFilter] = useState<"all" | "visible" | "hidden" | "verified">("all");
  const [directUsnToToggle, setDirectUsnToToggle] = useState<string>("");
  const [directUsnLoading, setDirectUsnLoading] = useState<boolean>(false);

  // Login Logs & Comparison state
  const [loginLogsData, setLoginLogsData] = useState<LoginLogsData | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsSubTab, setLogsSubTab] = useState<"logins" | "comparisons">("logins");
  const [comparisonLogsData, setComparisonLogsData] = useState<ComparisonLogsData | null>(null);
  const [compareLogsLoading, setCompareLogsLoading] = useState(false);
  const [compareLogsError, setCompareLogsError] = useState("");

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
  const [savingLinkId, setSavingLinkId] = useState<number | null>(null);

  // Real-time credit sync & Totals recalculation
  const [syncingCredits, setSyncingCredits] = useState(false);
  const [lastCreditsSyncTime, setLastCreditsSyncTime] = useState<string | null>(null);
  const [recalculatingTotals, setRecalculatingTotals] = useState(false);

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

  // Crowdsourced Scrape Targets Queue State
  const [scrapeTargets, setScrapeTargets] = useState<ScrapeTarget[]>([]);
  const [targetStartUsn, setTargetStartUsn] = useState("");
  const [targetEndUsn, setTargetEndUsn] = useState("");
  const [targetSemester, setTargetSemester] = useState("1");
  const [targetSemesterLinkId, setTargetSemesterLinkId] = useState<number | undefined>(undefined);
  const [targetCustomVtuLink, setTargetCustomVtuLink] = useState("");
  const [targetForceUpdate, setTargetForceUpdate] = useState(false);
  const [creatingTarget, setCreatingTarget] = useState(false);
  const [targetError, setTargetError] = useState("");

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

  // Load Crowdsourced Scrape Targets Queue
  const loadScrapeTargets = async (key: string) => {
    try {
      const data = await fetchScrapeTargets(key);
      setScrapeTargets(data);
    } catch (e) {
      console.error("Failed to load scrape targets", e);
    }
  };

  const handleCreateScrapeTarget = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetStartUsn.trim() || !targetEndUsn.trim()) return;
    setCreatingTarget(true);
    setTargetError("");
    sfx.playMechanicalClick();

    const selectedLink = targetSemesterLinkId
      ? semesterLinks.find((l) => l.id === targetSemesterLinkId)
      : semesterLinks.find((l) => l.is_default);
    const resolvedSemester = selectedLink?.semester || targetSemester || "1";
    const resolvedUrl = targetCustomVtuLink.trim() || (selectedLink?.url || undefined);

    try {
      await createScrapeTarget(
        {
          start_usn: targetStartUsn.trim().toUpperCase(),
          end_usn: targetEndUsn.trim().toUpperCase(),
          semester: resolvedSemester,
          semester_link_id: targetSemesterLinkId,
          vtu_link: resolvedUrl,
          force_update: targetForceUpdate,
        },
        adminKey
      );
      setTargetStartUsn("");
      setTargetEndUsn("");
      setTargetCustomVtuLink("");
      setTargetForceUpdate(false);
      await loadScrapeTargets(adminKey);
      sfx.playClick();
      setActionSuccessMsg("Crowdsourced scraping queue created successfully!");
      setTimeout(() => setActionSuccessMsg(""), 4000);
    } catch (err: unknown) {
      setTargetError(err instanceof Error ? err.message : "Failed to create target queue");
    } finally {
      setCreatingTarget(false);
    }
  };

  // Instantly queue a student request into Crowdsourced Gate with Force Update
  const handleQueueRequestToCrowdsource = async (r: RescrapeRequestRecord) => {
    if (!adminKey) return;
    setActionLoadingId(r.id);
    sfx.playMechanicalClick();
    try {
      const sem = r.target_semester && r.target_semester !== "all" ? r.target_semester : "1";
      const link = (r.vtu_link || r.custom_url || "").trim() || undefined;
      await createScrapeTarget(
        {
          start_usn: r.usn.trim().toUpperCase(),
          end_usn: r.usn.trim().toUpperCase(),
          semester: sem,
          vtu_link: link,
          force_update: true,
        },
        adminKey
      );
      await actionAdminRescrapeRequest(
        r.id,
        "queue_crowdsource",
        `Queued into Crowdsourced Gate (Sem ${sem}, force_update=True)`,
        adminKey
      );
      await Promise.all([loadRescrapeRequests(), loadScrapeTargets(adminKey)]);
      sfx.playSonar();
      setActionSuccessMsg(`⚡ Queued ${r.usn} into Crowdsourced Gate with Force Update!`);
      setTimeout(() => setActionSuccessMsg(""), 4500);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to queue request");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Pre-fill the Crowdsourced Gate form from a student request for manual inspection
  const handlePrefillCrowdsourceForm = (r: RescrapeRequestRecord) => {
    sfx.playMechanicalClick();
    setTargetStartUsn(r.usn.trim().toUpperCase());
    setTargetEndUsn(r.usn.trim().toUpperCase());
    setTargetSemester(r.target_semester && r.target_semester !== "all" ? r.target_semester : "1");
    if (r.vtu_link || r.custom_url) {
      setTargetCustomVtuLink((r.vtu_link || r.custom_url || "").trim());
    }
    setTargetForceUpdate(true);
    setActiveTab("scraper");
    setTimeout(() => {
      const el = document.getElementById("crowdsourced-gate-form");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  };

  const handleDeleteScrapeTarget = async (id: number) => {
    if (!confirm("Are you sure you want to remove this scrape target queue?")) return;
    sfx.playMechanicalClick();
    try {
      await deleteScrapeTarget(id, adminKey);
      await loadScrapeTargets(adminKey);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete target");
    }
  };

  // Delete individual comparison log
  const handleDeleteCompareLog = async (id: number) => {
    if (!adminKey) return;
    sfx.playMechanicalClick();
    try {
      await deleteCompareLog(id, adminKey);
      setComparisonLogsData((prev) => {
        if (!prev) return prev;
        const filtered = prev.recent_logs.filter((l) => l.id !== id);
        return {
          ...prev,
          total_comparisons: Math.max(0, prev.total_comparisons - 1),
          recent_logs: filtered,
        };
      });
      sfx.playClick();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete comparison log");
    }
  };

  // Delete individual login audit log
  const handleDeleteLoginLog = async (id: number) => {
    if (!adminKey) return;
    sfx.playMechanicalClick();
    try {
      await deleteLoginLog(id, adminKey);
      setLoginLogsData((prev) => {
        if (!prev) return prev;
        const filtered = prev.recent_logs.filter((l) => l.id !== id);
        return {
          ...prev,
          total_logins: Math.max(0, prev.total_logins - 1),
          recent_logs: filtered,
        };
      });
      sfx.playClick();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete login log");
    }
  };

  const [clearingLogs, setClearingLogs] = useState(false);
  const handleClearAllLogs = async () => {
    if (!adminKey || clearingLogs) return;
    const logLabel = logsSubTab === "logins" ? "login audit logs" : "comparison tracker logs";
    if (!window.confirm(`Are you sure you want to delete all ${logLabel}? This cannot be undone.`)) return;
    setClearingLogs(true);
    sfx.playMechanicalClick();
    try {
      await clearAllAdminLogs(logsSubTab === "logins" ? "login" : "compare", adminKey);
      if (logsSubTab === "logins") {
        await loadLoginLogs();
      } else {
        await loadComparisonLogs();
      }
      sfx.playClick();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to clear logs");
    } finally {
      setClearingLogs(false);
    }
  };

  // Delete individual rescrape request
  const handleDeleteRescrapeRequest = async (id: number) => {
    if (!adminKey) return;
    if (!confirm("Permanently delete this student scrape request?")) return;
    sfx.playMechanicalClick();
    try {
      await deleteRescrapeRequest(id, adminKey);
      setRescrapeRequests((prev) => prev.filter((r) => r.id !== id));
      sfx.playClick();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete rescrape request");
    }
  };

  // Delete individual missing report
  const handleDeleteMissingReport = async (id: number) => {
    if (!adminKey) return;
    if (!confirm("Permanently delete this missing USN report?")) return;
    sfx.playMechanicalClick();
    try {
      await deleteMissingReport(id, adminKey);
      setMissingReports((prev) => prev.filter((m) => m.id !== id));
      sfx.playClick();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete missing report");
    }
  };

  // Delete individual dispute / claim
  const handleDeleteDispute = async (id: number) => {
    if (!adminKey) return;
    if (!confirm("Permanently delete this student ownership claim?")) return;
    sfx.playMechanicalClick();
    try {
      await deleteDisputeRecord(id, adminKey);
      setDisputes((prev) => prev.filter((d) => d.id !== id));
      sfx.playClick();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete dispute record");
    }
  };

  const handleSyncCreditsRealtime = async () => {
    if (!adminKey) return;
    setSyncingCredits(true);
    sfx.playMechanicalClick();
    try {
      const res = await fetchLiveCreditsSync(adminKey);
      if (res.ok && res.credits) {
        const creditMap = new Map(res.credits.map((c) => [c.usn, c.comparison_credits]));
        setAllStudents((prev) =>
          prev.map((s) => {
            if (creditMap.has(s.usn)) {
              return { ...s, comparison_credits: creditMap.get(s.usn) };
            }
            return s;
          })
        );
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setLastCreditsSyncTime(timeStr);
        sfx.playSonar();
        setActionSuccessMsg(`⚖️ Synced live credits for ${res.total_students} students!`);
        setTimeout(() => setActionSuccessMsg(""), 3500);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to sync credits");
    } finally {
      setSyncingCredits(false);
    }
  };

  // Load Students
  const loadStudentRecords = () => {
    fetchStudents({ sort: "recent", adminKey: adminKey || undefined })
      .then((data) => setAllStudents(data))
      .catch(() => { });
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
    setCompareLogsError("");
    try {
      const data = await fetchAdminComparisonLogs(adminKey);
      setComparisonLogsData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load comparison logs";
      setCompareLogsError(msg);
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

  const loadMissingReports = async () => {
    if (!adminKey) return;
    setMissingReportsLoading(true);
    try {
      const data = await fetchAdminMissingUsnReports(adminKey);
      setMissingReports(data);
    } catch (err) {
      console.error("Failed to load missing USN reports", err);
    } finally {
      setMissingReportsLoading(false);
    }
  };

  const handleResolveMissingReport = async (id: number) => {
    if (!adminKey) return;
    sfx.playClick();
    try {
      await resolveAdminMissingUsnReport(id, adminKey);
      await loadMissingReports();
      sfx.playSonar();
    } catch (err) {
      console.error("Failed to resolve missing USN report", err);
    }
  };

  const handleScrapeMissingReport = (usn: string) => {
    sfx.playClick();
    setMode("single");
    setSingleUsn(usn);
    setActiveTab("scraper");
  };

  // Load Re-scrape & Revaluation Requests
  const loadRescrapeRequests = async () => {
    if (!adminKey) return;
    setRescrapeLoading(true);
    try {
      const data = await fetchAdminRescrapeRequests(
        adminKey,
        rescrapeFilter === "all" ? undefined : rescrapeFilter
      );
      setRescrapeRequests(data);
    } catch (err) {
      console.error("Failed to load rescrape requests", err);
    } finally {
      setRescrapeLoading(false);
    }
  };

  const handleRescrapeAction = async (
    id: number,
    action: "resolve" | "reject" | "scrape_now" | "hide_student" | "unhide_student",
    notes?: string
  ) => {
    if (!adminKey) return;
    setActionLoadingId(id);
    setActionSuccessMsg("");
    sfx.playClick();
    try {
      const res = await actionAdminRescrapeRequest(id, action, notes, adminKey);
      setActionSuccessMsg(res.message);
      await loadRescrapeRequests();
      if (action === "scrape_now") {
        setActiveTab("scraper");
      }
      if (action === "hide_student" || action === "unhide_student") {
        loadStudentRecords();
      }
      sfx.playSonar();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute request action";
      setActionError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleVisibility = async (usn: string, hidden: boolean) => {
    if (!adminKey) return;
    sfx.playClick();
    try {
      const res = await toggleAdminStudentVisibility(usn, hidden, adminKey);
      setActionSuccessMsg(res.message);
      loadStudentRecords();
      sfx.playSonar();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to toggle visibility";
      alert(msg);
    }
  };

  const handleUpdateCredits = async (usn: string, amount?: number, setVal?: number) => {
    if (!adminKey) return;
    sfx.playClick();
    try {
      const res = await updateStudentCredits(usn, { amount, set: setVal }, adminKey);
      setAllStudents((prev) =>
        prev.map((st) =>
          st.usn === usn ? { ...st, comparison_credits: res.comparison_credits } : st
        )
      );
      setActionSuccessMsg(`⚖️ Comparison credits for ${usn} updated to ${res.comparison_credits}`);
      sfx.playSonar();
      setTimeout(() => setActionSuccessMsg(""), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update credits";
      alert(msg);
    }
  };

  const handleSaveAsSemesterLink = async (r: RescrapeRequestRecord) => {
    const rawUrl = (r.vtu_link || r.custom_url || "").trim();
    if (!rawUrl || !adminKey) return;

    setSavingLinkId(r.id);
    sfx.playClick();

    const sem = r.target_semester && r.target_semester !== "all" ? r.target_semester : "1";
    let linkTitle = `SEM-${sem} RESULTS`;
    if (r.request_type === "REVALUATION") {
      linkTitle = `SEM-${sem} REVAL`;
    } else if (r.request_type === "RE_EXAM") {
      linkTitle = `SEM-${sem} MAKEUP`;
    } else if (r.request_type === "MISSING_SEMESTER") {
      linkTitle = `SEM-${sem} REGULAR`;
    }

    try {
      const created = await createSemesterLink(
        {
          title: linkTitle,
          url: rawUrl,
          semester: sem,
          is_default: false,
        },
        adminKey
      );
      await loadSemesterLinks();
      setSelectedSemesterLinkId(created.id);
      setUseCustomUrl(false);
      setActionSuccessMsg(`Saved "${created.title}" as Semester Link! Activated in Scraper.`);
      sfx.playSonar();
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save semester link";
      alert(msg);
    } finally {
      setSavingLinkId(null);
    }
  };

  const handlePrefillSemesterForm = (r: RescrapeRequestRecord) => {
    const rawUrl = (r.vtu_link || r.custom_url || "").trim();
    if (!rawUrl) return;

    const sem = r.target_semester && r.target_semester !== "all" ? r.target_semester : "1";
    let linkTitle = `SEM-${sem} RESULTS`;
    if (r.request_type === "REVALUATION") {
      linkTitle = `SEM-${sem} REVAL`;
    } else if (r.request_type === "RE_EXAM") {
      linkTitle = `SEM-${sem} MAKEUP`;
    } else if (r.request_type === "MISSING_SEMESTER") {
      linkTitle = `SEM-${sem} REGULAR`;
    }

    setNewLinkTitle(linkTitle);
    setNewLinkUrl(rawUrl);
    setNewLinkSem(sem);
    setActiveTab("semesters");
    sfx.playClick();
  };

  // Load Semester Coverage Audit
  const loadSemesterAudit = async () => {
    if (!adminKey) return;
    setSemesterAuditLoading(true);
    try {
      const data = await fetchAdminSemesterAudit(adminKey);
      setSemesterAudit(data);
    } catch (err) {
      console.error("Failed to load semester audit", err);
    } finally {
      setSemesterAuditLoading(false);
    }
  };

  const handleRecalculateTotals = async () => {
    if (!adminKey || recalculatingTotals) return;
    sfx.playClick();
    setRecalculatingTotals(true);
    setActionError("");
    setActionSuccessMsg("");
    try {
      const res = await recalculateCumulativeTotals(adminKey);
      setActionSuccessMsg(res.message || "Recalculated cumulative totals successfully!");
      sfx.playSonar();
      await loadSemesterAudit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to recalculate totals";
      setActionError(msg);
    } finally {
      setRecalculatingTotals(false);
    }
  };

  const handleQuickScrapeSemester = (usn: string, semester: string) => {
    sfx.playClick();
    setMode("single");
    setSingleUsn(usn);
    setNewLinkSem(semester);
    setActiveTab("scraper");
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadStudentRecords();
      loadDisputes();
      loadMissingReports();
      loadRescrapeRequests();
      loadScrapeTargets(adminKey);
      if (activeTab === "disputes") {
        loadDisputes();
      } else if (activeTab === "missing_usn") {
        loadMissingReports();
        loadRescrapeRequests();
      } else if (activeTab === "audit") {
        loadSemesterAudit();
      } else if (activeTab === "logs") {
        loadLoginLogs();
        loadComparisonLogs();
      } else if (activeTab === "faculty_audits") {
        loadFacultyAudits();
      } else if (activeTab === "records") {
        loadAdminInsights();
      }
    }
  }, [isAuthenticated, activeTab, disputeFilter, rescrapeFilter, logsSubTab, facultyAuditsSubTab]);

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

  const insightsByUsn = useMemo(() => {
    const map = new Map<string, AdminInsightsItem>();
    if (adminInsights?.items) {
      for (const item of adminInsights.items) {
        map.set(item.usn.toUpperCase(), item);
      }
    }
    return map;
  }, [adminInsights]);

  const filteredStoredStudents = useMemo(() => {
    return allStudents.filter((s) => {
      if (recordsVisibilityFilter === "visible" && s.is_hidden) return false;
      if (recordsVisibilityFilter === "hidden" && !s.is_hidden) return false;
      if (recordsVisibilityFilter === "verified") {
        const ins = insightsByUsn.get(s.usn.toUpperCase());
        if (!ins || !ins.verified) return false;
      }
      if (!studentSearch.trim()) return true;
      const q = studentSearch.toLowerCase().trim();
      return (
        s.name.toLowerCase().includes(q) ||
        s.usn.toLowerCase().includes(q) ||
        s.branch.toLowerCase().includes(q)
      );
    });
  }, [allStudents, recordsVisibilityFilter, studentSearch, insightsByUsn]);

  const progressPercent =
    status.total_count > 0 ? Math.round((status.processed_count / status.total_count) * 100) : 0;

  // -------------------------------------------------------------
  // Render: Loading Screen
  // -------------------------------------------------------------
  if (checkingAuth) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
        <div className="p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0c0e12] shadow-sm text-center max-w-sm w-full space-y-3">
          <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-700 border-t-slate-900 dark:border-t-cyan-400 rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
            Verifying administrator credentials...
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render: Login Screen
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white dark:bg-[#0c0e12] border border-slate-200/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-cyan-400 rounded-2xl flex items-center justify-center mx-auto">
              <IconLock className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Admin Control Room</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
              Authenticate to manage scraper queues, portal endpoints, and student verification audits.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 font-mono">
                Admin Secret Key
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-cyan-500 transition-all font-mono placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-600"
                autoFocus
              />
            </div>

            {authError && (
              <div className="p-3 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-medium rounded-xl flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying || !passwordInput.trim()}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 active:scale-[0.98] text-white dark:text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isVerifying ? "Verifying Access..." : "Sign In to Control Room"}
            </button>

            <div className="text-center pt-2">
              <Link href="/" className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                ← Return to Results Directory
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
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-6 space-y-4 sm:space-y-6 pb-24 sm:pb-16 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Header */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 pb-3 sm:pb-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            onClick={() => sfx.playClick()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c0e12] hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-2xs transition-colors"
          >
            ← Results Dashboard
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleTheme}
              title={isObsidian ? "Switch to Paper Light Theme" : "Switch to Obsidian Dark Theme"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c0e12] hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-2xs transition-colors cursor-pointer"
            >
              <span>{isObsidian ? "🌙" : "☀️"}</span>
              <span className="hidden sm:inline">{isObsidian ? "Obsidian" : "Paper"}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900/40 bg-white dark:bg-[#0c0e12] hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-colors shadow-2xs cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Admin Control Room
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs">
              Scraper queues, semester links, USN claims verification, and student login audits.
            </p>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white dark:bg-[#0c0e12] border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-full shadow-2xs">
              <span
                className={`w-2 h-2 rounded-full ${status.is_running
                  ? "bg-emerald-500 animate-pulse"
                  : status.status === "error"
                    ? "bg-rose-500"
                    : "bg-slate-400 dark:bg-slate-600"
                  }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
                {status.is_running ? "Scraping Active" : status.status === "error" ? "Error" : "Scraper Idle"}
              </span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-2xs ${browserStatus?.status === "ready"
                ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300"
                : "bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/50 text-amber-800 dark:text-amber-300"
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${browserStatus?.status === "ready" ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className="font-mono">{browserStatus?.status === "ready" ? "Browser Ready" : "Browser Check"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {actionError && (
        <div className="p-3 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs rounded-xl font-medium flex items-center justify-between shadow-2xs">
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 text-xs font-bold p-1">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {deleteSuccessMsg && (
        <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl font-medium flex items-center justify-between shadow-2xs">
          <span>{deleteSuccessMsg}</span>
          <button onClick={() => setDeleteSuccessMsg("")} className="text-emerald-500 hover:text-emerald-800 dark:hover:text-emerald-200 text-xs font-bold p-1">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl font-medium flex items-center justify-between shadow-2xs">
          <span>{actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg("")} className="text-emerald-500 hover:text-emerald-800 dark:hover:text-emerald-200 text-xs font-bold p-1">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mobile-First Tab Navigation (Polished horizontally scrollable track) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x bg-slate-100/90 dark:bg-[#0c0e12] p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setActiveTab("scraper");
          }}
          className={`min-h-[42px] sm:min-h-[38px] px-3.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap shrink-0 sm:flex-1 flex items-center justify-center gap-1.5 active:scale-[0.98] ${activeTab === "scraper"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
            }`}
        >
          <IconBolt className="w-3.5 h-3.5" />
          <span>Scraper</span>
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setActiveTab("semesters");
          }}
          className={`min-h-[42px] sm:min-h-[38px] px-3.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap shrink-0 sm:flex-1 flex items-center justify-center gap-1.5 active:scale-[0.98] ${activeTab === "semesters"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
            }`}
        >
          <IconLayers className="w-3.5 h-3.5" />
          <span>Semesters</span>
          <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-mono">
            {semesterLinks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setActiveTab("records");
          }}
          className={`min-h-[42px] sm:min-h-[38px] px-3.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap shrink-0 sm:flex-1 flex items-center justify-center gap-1.5 active:scale-[0.98] ${activeTab === "records"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
            }`}
        >
          <IconUsers className="w-3.5 h-3.5" />
          <span>Students</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-mono">
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
          className={`min-h-[42px] sm:min-h-[38px] px-3.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap shrink-0 sm:flex-1 flex items-center justify-center gap-1.5 active:scale-[0.98] ${activeTab === "disputes"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
            }`}
        >
          <IconShield className="w-3.5 h-3.5" />
          <span>Claims</span>
          {disputes.filter((d) => d.status === "pending").length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500 text-white font-mono font-bold">
              {disputes.filter((d) => d.status === "pending").length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setActiveTab("missing_usn");
            loadMissingReports();
            loadRescrapeRequests();
          }}
          className={`min-h-[42px] sm:min-h-[38px] px-3.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap shrink-0 sm:flex-1 flex items-center justify-center gap-1.5 active:scale-[0.98] ${activeTab === "missing_usn"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
            }`}
        >
          <IconBell className="w-3.5 h-3.5" />
          <span>Requests</span>
          {rescrapeRequests.filter((r) => r.status === "pending").length +
            missingReports.filter((r) => r.status === "pending").length > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-600 text-white font-mono font-bold">
                {rescrapeRequests.filter((r) => r.status === "pending").length +
                  missingReports.filter((r) => r.status === "pending").length}
              </span>
            )}
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setActiveTab("audit");
            loadSemesterAudit();
          }}
          className={`min-h-[42px] sm:min-h-[38px] px-3.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap shrink-0 sm:flex-1 flex items-center justify-center gap-1.5 active:scale-[0.98] ${activeTab === "audit"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
            }`}
        >
          <IconRotateCcw className="w-3.5 h-3.5" />
          <span>Audit</span>
          {semesterAudit && semesterAudit.missing_sem2 > 0 && (
            <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50 font-mono font-semibold">
              -{semesterAudit.missing_sem2} S2
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
          className={`min-h-[42px] sm:min-h-[38px] px-3.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap shrink-0 sm:flex-1 flex items-center justify-center gap-1.5 active:scale-[0.98] ${activeTab === "logs"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
            }`}
        >
          <IconFileText className="w-3.5 h-3.5" />
          <span>Logs</span>
          {loginLogsData && (
            <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-mono">
              {loginLogsData.total_logins}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setActiveTab("faculty_audits");
            loadFacultyAudits();
          }}
          className={`min-h-[42px] sm:min-h-[38px] px-3.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap shrink-0 sm:flex-1 flex items-center justify-center gap-1.5 active:scale-[0.98] ${activeTab === "faculty_audits"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
            }`}
        >
          <span>🏛️</span>
          <span>Faculty Audits</span>
          {facultyAuditsData && (
            <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300 font-mono">
              {facultyAuditsData.login_logs.length + facultyAuditsData.comparison_logs.length}
            </span>
          )}
        </button>


        <button
          type="button"
          onClick={() => {
            sfx.playClick();
            setActiveTab("system");
          }}
          className={`min-h-[42px] sm:min-h-[38px] px-3.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap shrink-0 sm:flex-1 flex items-center justify-center gap-1.5 active:scale-[0.98] ${activeTab === "system"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
            }`}
        >
          <IconSettings className="w-3.5 h-3.5" />
          <span>System</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: SCRAPER ENGINE                                         */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "scraper" && (
        <div className="space-y-6">
          {/* Main Control Card */}
          <div className="bg-white dark:bg-[#0c0e12] rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-5">
            {/* Mode Selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 font-mono">
                Scraping Target Mode
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    setMode("single");
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all active:scale-[0.98] ${mode === "single"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
                  className={`py-2 text-xs font-bold rounded-lg transition-all active:scale-[0.98] ${mode === "range"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                >
                  Batch Range Scraper
                </button>
              </div>
            </div>

            {/* Target Examination / Semester Links Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                  Target Examination Portal Link
                </label>
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    setActiveTab("semesters");
                  }}
                  className="text-[11px] font-bold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
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
                      className={`p-3 rounded-xl border text-left transition-all relative active:scale-[0.99] cursor-pointer ${isSelected
                        ? "border-slate-900 dark:border-cyan-500 bg-slate-900 dark:bg-cyan-950/30 text-white dark:text-cyan-100 shadow-xs ring-1 ring-slate-900 dark:ring-cyan-500/50"
                        : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/60 bg-white dark:bg-slate-950"
                        } disabled:opacity-50`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-bold truncate">{link.title}</span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md uppercase shrink-0 font-bold ${isSelected
                            ? "bg-slate-800 dark:bg-cyan-900/60 text-slate-200 dark:text-cyan-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                        >
                          Sem {link.semester}
                        </span>
                      </div>
                      <div
                        className={`text-[10px] truncate mt-1 font-mono ${isSelected ? "text-slate-300 dark:text-cyan-300/70" : "text-slate-400 dark:text-slate-500"
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
                  className={`p-3 rounded-xl border text-left transition-all active:scale-[0.99] cursor-pointer ${useCustomUrl
                    ? "border-slate-900 dark:border-cyan-500 bg-slate-900 dark:bg-cyan-950/30 text-white dark:text-cyan-100 shadow-xs ring-1 ring-slate-900 dark:ring-cyan-500/50"
                    : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/60 bg-white dark:bg-slate-950"
                    } disabled:opacity-50`}
                >
                  <div className="text-xs sm:text-sm font-bold">Custom Portal URL</div>
                  <div
                    className={`text-[10px] mt-1 font-mono ${useCustomUrl ? "text-slate-300 dark:text-cyan-300/70" : "text-slate-400 dark:text-slate-500"
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
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-cyan-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Endpoint must point to <code>index.php</code> (VTU USN input page).
                  </p>
                </div>
              )}
            </div>

            {/* Quick Branch Autofill */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 font-mono">
                Quick Branch Autofill (2025 Batch)
              </label>
              <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5">
                {QUICK_BRANCHES.map((b) => (
                  <button
                    key={b.code}
                    type="button"
                    onClick={() => handleQuickBranch(b.code)}
                    disabled={status.is_running}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 disabled:opacity-50 transition-colors text-center font-mono active:scale-[0.98] cursor-pointer"
                  >
                    {b.name} ({b.code})
                  </button>
                ))}
              </div>
            </div>

            {/* USN Input Form */}
            <form onSubmit={handleStart} className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              {mode === "single" ? (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-mono">
                    Student USN
                  </label>
                  <input
                    type="text"
                    value={singleUsn}
                    onChange={(e) => setSingleUsn(e.target.value.toUpperCase())}
                    placeholder="e.g. 1RM25CD052"
                    disabled={status.is_running}
                    className="w-full p-3 font-mono text-base uppercase font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-cyan-500 disabled:bg-slate-50 dark:disabled:bg-slate-900"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-mono">
                      Start USN
                    </label>
                    <input
                      type="text"
                      value={startUsn}
                      onChange={(e) => setStartUsn(e.target.value.toUpperCase())}
                      placeholder="1RM25CS001"
                      disabled={status.is_running}
                      className="w-full p-3 font-mono text-base sm:text-sm uppercase font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-cyan-500 disabled:bg-slate-50 dark:disabled:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-mono">
                      End USN
                    </label>
                    <input
                      type="text"
                      value={endUsn}
                      onChange={(e) => setEndUsn(e.target.value.toUpperCase())}
                      placeholder="1RM25CS060"
                      disabled={status.is_running}
                      className="w-full p-3 font-mono text-base sm:text-sm uppercase font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-cyan-500 disabled:bg-slate-50 dark:disabled:bg-slate-900"
                    />
                  </div>
                </div>
              )}

              {/* Start / Stop Button */}
              <div className="pt-1">
                {status.is_running ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                  >
                    Stop Active Scraping Task
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 active:scale-[0.98] text-white dark:text-slate-950 font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                  >
                    {mode === "single" ? `Fetch Marks for ${singleUsn}` : "Start Scraping Range"}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Scraper Progress Bar */}
          <div className="bg-white dark:bg-[#0c0e12] rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">Status:</span>
                <span className="ml-2 font-medium text-slate-600 dark:text-slate-400">{status.message}</span>
              </div>
              {status.total_count > 0 && (
                <span className="font-bold text-slate-900 dark:text-cyan-400 font-mono tabular-nums">
                  {status.processed_count} / {status.total_count} ({progressPercent}%)
                </span>
              )}
            </div>

            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${status.status === "error" ? "bg-rose-500" : "bg-slate-900 dark:bg-cyan-400"
                  }`}
                style={{ width: `${status.total_count > 0 ? progressPercent : 0}%` }}
              />
            </div>

            {status.current_usn && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex justify-between font-mono">
                <span>
                  Querying: <strong className="text-slate-900 dark:text-white">{status.current_usn}</strong>
                </span>
                <span>
                  Range: {status.start_usn} → {status.end_usn}
                </span>
              </div>
            )}
          </div>

          {/* Interactive Captcha Solving Card */}
          {status.captcha_base64 && (
            <div className="bg-white dark:bg-[#0c0e12] border border-amber-300/80 dark:border-amber-600/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 font-mono">
                      Captcha Required
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base mt-0.5">
                    Solve Verification for <span className="font-mono text-cyan-600 dark:text-cyan-400">{status.current_usn}</span>
                  </h3>
                </div>

                {/* Captcha Controls */}
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800 self-start sm:self-auto">
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 px-1 font-mono">Zoom:</span>
                  {([1, 2, 3] as const).map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setCaptchaZoom(z)}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer active:scale-95 ${captchaZoom === z
                        ? "bg-slate-900 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                        }`}
                    >
                      {z}x
                    </button>
                  ))}
                  <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => setCaptchaInvert((v) => !v)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-lg border transition-colors cursor-pointer active:scale-95 ${captchaInvert
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white font-bold"
                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                  >
                    {captchaInvert ? "Normal" : "High Contrast"}
                  </button>
                </div>
              </div>

              {/* Captcha Image & Form */}
              <div className="bg-slate-50/60 dark:bg-slate-900/50 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4">
                <div
                  className={`bg-white p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all ${captchaInvert ? "filter invert" : ""
                    }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
                      placeholder="Type captcha characters..."
                      autoFocus
                      className="flex-1 p-3 border-2 border-amber-300 dark:border-amber-500/80 rounded-xl text-center font-mono font-bold text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={submittingCaptcha || !captchaInput.trim()}
                      className="px-5 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs disabled:opacity-50 whitespace-nowrap cursor-pointer active:scale-95"
                    >
                      {submittingCaptcha ? "Submitting..." : "Submit Captcha"}
                    </button>
                  </div>

                  {/* Character Breakdown */}
                  {captchaInput && (
                    <div className="p-2.5 rounded-xl bg-amber-100/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                      <p className="text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider mb-1.5 text-center font-mono">
                        Verify Case Sensitivity:
                      </p>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {captchaInput.split("").map((ch, idx) => {
                          const isLower = /[a-z]/.test(ch);
                          const isUpper = /[A-Z]/.test(ch);
                          return (
                            <div
                              key={idx}
                              className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold flex items-center gap-1 border ${isLower
                                ? "bg-blue-100 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-300"
                                : isUpper
                                  ? "bg-purple-100 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-300"
                                  : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-300"
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

              <p className="text-[11px] text-amber-800 dark:text-amber-300/80 text-center font-mono">
                Tip: Press <kbd className="px-1.5 py-0.5 bg-amber-200/70 dark:bg-amber-900/60 rounded font-mono font-bold">Enter</kbd> to submit immediately.
              </p>
            </div>
          )}

          {/* Terminal Scraper Output */}
          <div className="bg-slate-950 rounded-2xl sm:rounded-3xl p-4 sm:p-5 text-slate-200 shadow-sm border border-slate-800/90">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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
                  <div key={idx} className="leading-relaxed flex items-start gap-2">
                    <span className="text-slate-600 select-none">›</span>
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

          {/* Crowdsourced Distributed Scraping Targets Card */}
          <div
            id="crowdsourced-gate-form"
            className="bg-white dark:bg-[#0c0e12] rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Crowdsourced Distributed Scraping Gate
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Queue USN ranges for student logins to solve sequentially. As students sign in, they solve live VTU captchas to extract these records.
                </p>
              </div>

              <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 self-start sm:self-auto font-semibold">
                {scrapeTargets.filter((t) => t.status === "PENDING").length} Active Queues
              </span>
            </div>

            {/* Target Input Form */}
            <form onSubmit={handleCreateScrapeTarget} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 font-mono">
                    Start USN
                  </label>
                  <input
                    type="text"
                    value={targetStartUsn}
                    onChange={(e) => setTargetStartUsn(e.target.value.toUpperCase())}
                    placeholder="e.g. 1RM25CS001"
                    maxLength={10}
                    className="w-full px-3 py-2.5 text-xs font-mono uppercase rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 font-mono">
                    End USN
                  </label>
                  <input
                    type="text"
                    value={targetEndUsn}
                    onChange={(e) => setTargetEndUsn(e.target.value.toUpperCase())}
                    placeholder="e.g. 1RM25CS060"
                    maxLength={10}
                    className="w-full px-3 py-2.5 text-xs font-mono uppercase rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 font-mono">
                    Semester & Saved Link
                  </label>
                  <select
                    value={targetSemesterLinkId ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      setTargetSemesterLinkId(val);
                      if (val) {
                        const found = semesterLinks.find((l) => l.id === val);
                        if (found && found.semester) {
                          setTargetSemester(found.semester);
                        }
                      } else {
                        const def = semesterLinks.find((l) => l.is_default);
                        setTargetSemester(def?.semester || "1");
                      }
                    }}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                  >
                    <option value="">Default Active Portal Link</option>
                    {semesterLinks.map((l) => (
                      <option key={l.id} value={l.id}>
                        Sem {l.semester} - {l.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Portal Link Input */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 font-mono">
                  Custom Portal Link (Optional • Overrides Saved Link)
                </label>
                <input
                  type="url"
                  value={targetCustomVtuLink}
                  onChange={(e) => setTargetCustomVtuLink(e.target.value)}
                  placeholder="https://results.vtu.ac.in/.../index.php (e.g. Revaluation, Makeup, or specific exam link)"
                  className="w-full px-3 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  Leave empty to use the active semester link, or paste a student-provided revaluation link.
                </p>
              </div>

              {/* Force Update / Revaluation Toggle */}
              <div className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Force Update / Revaluation Mode
                    </span>
                    {targetForceUpdate && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase font-mono">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {targetForceUpdate
                      ? "⚡ Forces sequential re-scrape of every USN in range (does NOT skip USNs with existing semester marks; overwrites with revaluation grades)"
                      : "⏩ Fast scan mode (automatically skips USNs that already have marks in the database for this semester)"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sfx.playMechanicalClick();
                    setTargetForceUpdate(!targetForceUpdate);
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden self-start sm:self-auto ${targetForceUpdate ? "bg-cyan-500" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${targetForceUpdate ? "translate-x-5" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {targetError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  ⚠️ {targetError}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creatingTarget || !targetStartUsn.trim() || !targetEndUsn.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>{creatingTarget ? "Queueing..." : "+ Queue for Student Logins"}</span>
                </button>
              </div>
            </form>

            {/* Existing Scrape Targets List */}
            <div className="space-y-2 pt-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                Active & Completed Scrape Targets
              </label>

              {scrapeTargets.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 font-mono">
                  No crowdsource scrape targets queued. Verified students will log in directly without solving captchas.
                </div>
              ) : (
                <div className="space-y-2">
                  {scrapeTargets.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${t.status === "COMPLETED" ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                              }`}
                          />
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {t.start_usn} → {t.end_usn}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                            Sem {t.semester}
                          </span>
                          {t.force_update && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-bold">
                              FORCE UPDATE
                            </span>
                          )}
                          <span
                            className={`text-[9px] uppercase font-bold font-mono px-1.5 py-0.5 rounded ${t.status === "COMPLETED"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-400"
                              }`}
                          >
                            {t.status}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-md">
                          Current Progress: <strong className="text-cyan-400">{t.current_usn_index || t.start_usn}</strong>
                          {t.vtu_link && ` • ${t.vtu_link}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleDeleteScrapeTarget(t.id)}
                          className="px-2.5 py-1 text-[11px] font-medium text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
          <div className="bg-white dark:bg-[#0c0e12] rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Add New Semester Result Portal Link</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure any VTU examination result portal URL to scrape from. These are stored permanently in Supabase.
              </p>
            </div>

            {linkActionMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl font-medium">
                {linkActionMsg}
              </div>
            )}

            <form onSubmit={handleAddSemesterLink} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Semester Title / Label
                  </label>
                  <input
                    type="text"
                    value={newLinkTitle}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                    placeholder="e.g. Sem 1 & 2 (2022 Scheme - Jan/Feb 2026)"
                    className="w-full p-2.5 text-base sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Semester Number
                  </label>
                  <select
                    value={newLinkSem}
                    onChange={(e) => setNewLinkSem(e.target.value)}
                    className="w-full p-2.5 text-base sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-cyan-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  VTU Portal URL (index.php)
                </label>
                <input
                  type="url"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="https://results.vtu.ac.in/MJ26cbcs/index.php"
                  className="w-full p-2.5 text-base sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-cyan-500 font-mono"
                  required
                />
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={addingLink || !newLinkTitle.trim() || !newLinkUrl.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 text-center cursor-pointer active:scale-98"
                >
                  {addingLink ? "Saving..." : "Add Semester Portal Link"}
                </button>
              </div>
            </form>
          </div>

          {/* List of Configured Semester Links */}
          <div className="bg-white dark:bg-[#0c0e12] rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Configured Semester Links ({semesterLinks.length})
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Select, copy, or delete examination portal links.
                </p>
              </div>
            </div>

            {semesterLinks.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400 dark:text-slate-500">
                No custom semester links configured. Add one above.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {semesterLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{link.title}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                          Sem {link.semester}
                        </span>
                        {selectedSemesterLinkId === link.id && !useCustomUrl && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Active in Scraper
                          </span>
                        )}
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 hover:underline truncate block mt-1"
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
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                      >
                        Use in Scraper
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSemesterLink(link.id, link.title)}
                        title={`Delete ${link.title}`}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-800 transition-colors cursor-pointer"
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
      {/* TAB 3: UNIFIED STUDENT RECORDS & INSIGHTS DASHBOARD           */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "records" && (
        <div className="bg-white dark:bg-[#0c0e12] rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-5">
          {/* Top Hero & Live Metric Summary (Student Dashboard Style) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Student Records &amp; Intelligence Hub</span>
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                Manage live visibility, synchronized comparison credits, verification timestamps, and weekly profile view &amp; peer comparison metrics.
              </p>
            </div>

            {/* Live Metrics Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Total</span>
                <span className="font-mono font-extrabold text-xs text-slate-900 dark:text-white">{allStudents.length}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <span className="text-[10px] uppercase font-bold">Verified</span>
                <span className="font-mono font-extrabold text-xs">
                  {adminInsights?.total_verified ?? allStudents.filter((s) => insightsByUsn.get(s.usn.toUpperCase())?.verified).length}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <span className="text-[10px] uppercase font-bold">Hidden</span>
                <span className="font-mono font-extrabold text-xs">
                  {allStudents.filter((s) => s.is_hidden).length}
                </span>
              </div>
            </div>
          </div>

          {/* Unified Action & Filter Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "all", label: `All Records (${allStudents.length})` },
                { id: "visible", label: `Visible (${allStudents.filter((s) => !s.is_hidden).length})` },
                { id: "hidden", label: `Hidden (${allStudents.filter((s) => s.is_hidden).length})` },
                {
                  id: "verified",
                  label: `Verified (${adminInsights?.total_verified ?? allStudents.filter((s) => insightsByUsn.get(s.usn.toUpperCase())?.verified).length})`,
                },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    setRecordsVisibilityFilter(f.id as "all" | "visible" | "hidden" | "verified");
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    recordsVisibilityFilter === f.id
                      ? "bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-xs"
                      : "bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-transparent dark:border-slate-800"
                  }`}
                >
                  {f.label}
                </button>
              ))}

              {/* Real-Time Live Credit Sync Button */}
              <button
                type="button"
                disabled={syncingCredits}
                onClick={handleSyncCreditsRealtime}
                title="Fetch live comparison credits for all students in real-time from database"
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <IconRotateCcw className={`w-3.5 h-3.5 ${syncingCredits ? "animate-spin text-cyan-600 dark:text-cyan-400" : "text-slate-600 dark:text-slate-400"}`} />
                <span>{syncingCredits ? "Syncing..." : "Sync Credits"}</span>
                {lastCreditsSyncTime && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium hidden lg:inline">
                    • {lastCreditsSyncTime}
                  </span>
                )}
              </button>

              {/* Refresh Insights Button */}
              <button
                type="button"
                disabled={adminInsightsLoading}
                onClick={() => loadAdminInsights(insightsSearch)}
                title="Refresh insights and verification activity timestamps"
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <IconRotateCcw className={`w-3.5 h-3.5 ${adminInsightsLoading ? "animate-spin text-cyan-600 dark:text-cyan-400" : "text-slate-600 dark:text-slate-400"}`} />
                <span>{adminInsightsLoading ? "Refreshing..." : "Refresh Insights"}</span>
              </button>
            </div>

            {/* Search Input with Instant USN Quick Toggle */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setDirectUsnToToggle(e.target.value.toUpperCase());
                  }}
                  placeholder="Search USN, name, or branch..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-cyan-500 font-mono"
                />
                <span className="absolute left-2.5 top-2 text-slate-400">
                  <IconSearch className="w-3.5 h-3.5" />
                </span>
              </div>

              {/* Quick direct toggle button if exact USN entered */}
              {studentSearch.trim().length >= 9 && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={directUsnLoading}
                    onClick={async () => {
                      setDirectUsnLoading(true);
                      await handleToggleVisibility(studentSearch.trim().toUpperCase(), true);
                      setDirectUsnLoading(false);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    title="Directly hide this USN"
                  >
                    Hide
                  </button>
                  <button
                    type="button"
                    disabled={directUsnLoading}
                    onClick={async () => {
                      setDirectUsnLoading(true);
                      await handleToggleVisibility(studentSearch.trim().toUpperCase(), false);
                      setDirectUsnLoading(false);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    title="Directly unhide this USN"
                  >
                    Unhide
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Student Dashboard-Styled List of Student Records */}
          {filteredStoredStudents.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {studentSearch ? "No students matching your search criteria." : "No student records currently stored."}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Try adjusting your search query or switching filters above.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              {filteredStoredStudents.map((s) => {
                const ins = insightsByUsn.get(s.usn.toUpperCase());
                const hasBacklogs = s.total_backlogs > 0;

                return (
                  <div
                    key={s.usn}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 ${
                      s.is_hidden
                        ? "bg-amber-950/10 border-amber-500/30 dark:bg-amber-950/20"
                        : "bg-white dark:bg-[#0b0d11] border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
                    }`}
                  >
                    {/* Student Profile Info Section */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                      <div className="shrink-0">
                        <Identicon
                          usn={s.usn}
                          percentage={s.percentage}
                          totalBacklogs={s.total_backlogs}
                          customPixelArt={s.avatar_pixel_art}
                          size={42}
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight truncate">
                            {s.name}
                          </span>
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-cyan-300">
                            {s.usn}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {s.branch}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              hasBacklogs
                                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            }`}
                          >
                            {hasBacklogs ? `${s.total_backlogs} BL` : "All Clear"}
                          </span>
                          {s.is_hidden && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300">
                              Hidden
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                            {s.percentage ? `${s.percentage.toFixed(1)}%` : "N/A"}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-[11px]">
                            {s.total_marks || 0} / {s.max_marks || 0}
                          </span>

                          {/* Verification Audit Status */}
                          <span>•</span>
                          {ins?.verified ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                              <span>✅ Verified</span>
                              {ins.verified_at && (
                                <span className="font-mono font-medium text-slate-300">
                                  {formatDateTime(ins.verified_at).full}
                                </span>
                              )}
                              {ins.last_ip && (
                                <span className="font-mono text-[9px] text-slate-400">
                                  IP: {ins.last_ip}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                              ⏳ Unverified
                            </span>
                          )}

                          {s.github_url && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              GitHub
                            </span>
                          )}
                          {s.linkedin_url && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400">
                              LinkedIn
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Interactive Admin Controls Toolbar */}
                    <div className="flex items-center justify-between xl:justify-end gap-2 flex-wrap pt-2.5 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                      {/* Weekly Views Adjuster */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <IconEye className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 uppercase">
                          Views
                        </span>
                        <span className="font-mono font-extrabold text-xs text-cyan-600 dark:text-cyan-400 tabular-nums px-1 min-w-[20px] text-center">
                          {ins?.views_this_week ?? 0}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={adjustingUsn === s.usn}
                            onClick={() => handleAdjustInsights(s.usn, -5, undefined)}
                            className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer transition-colors"
                            title="Decrease views by 5"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            disabled={adjustingUsn === s.usn}
                            onClick={() => handleAdjustInsights(s.usn, -1, undefined)}
                            className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer transition-colors"
                            title="Decrease views by 1"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            disabled={adjustingUsn === s.usn}
                            onClick={() => handleAdjustInsights(s.usn, 1, undefined)}
                            className="px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-[10px] font-mono font-bold disabled:opacity-40 cursor-pointer transition-colors"
                            title="Increase views by 1"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            disabled={adjustingUsn === s.usn}
                            onClick={() => handleAdjustInsights(s.usn, 5, undefined)}
                            className="px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-[10px] font-mono font-bold disabled:opacity-40 cursor-pointer transition-colors"
                            title="Increase views by 5"
                          >
                            +5
                          </button>
                        </div>
                      </div>

                      {/* Peer Compares Adjuster */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <IconCompare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 uppercase">
                          Compares
                        </span>
                        <span className="font-mono font-extrabold text-xs text-indigo-600 dark:text-indigo-400 tabular-nums px-1 min-w-[20px] text-center">
                          {ins?.comparisons_this_week ?? 0}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={adjustingUsn === s.usn}
                            onClick={() => handleAdjustInsights(s.usn, undefined, -5)}
                            className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer transition-colors"
                            title="Decrease compares by 5"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            disabled={adjustingUsn === s.usn}
                            onClick={() => handleAdjustInsights(s.usn, undefined, -1)}
                            className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer transition-colors"
                            title="Decrease compares by 1"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            disabled={adjustingUsn === s.usn}
                            onClick={() => handleAdjustInsights(s.usn, undefined, 1)}
                            className="px-1.5 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-[10px] font-mono font-bold disabled:opacity-40 cursor-pointer transition-colors"
                            title="Increase compares by 1"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            disabled={adjustingUsn === s.usn}
                            onClick={() => handleAdjustInsights(s.usn, undefined, 5)}
                            className="px-1.5 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-[10px] font-mono font-bold disabled:opacity-40 cursor-pointer transition-colors"
                            title="Increase compares by 5"
                          >
                            +5
                          </button>
                        </div>
                      </div>

                      {/* Comparison Credits Adjuster */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs shrink-0">
                        <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 uppercase">
                          Credits
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateCredits(s.usn, -1)}
                          disabled={(s.comparison_credits ?? 2) <= 0}
                          title="Decrease credits by 1"
                          className="w-5 h-5 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer transition-colors active:scale-95"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={s.comparison_credits ?? 2}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 0) {
                              handleUpdateCredits(s.usn, undefined, val);
                            }
                          }}
                          className="w-6 text-center text-xs font-mono font-extrabold bg-transparent border-0 outline-none text-slate-900 dark:text-cyan-200 p-0 tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCredits(s.usn, 1)}
                          title="Increase credits by 1"
                          className="w-5 h-5 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors active:scale-95"
                        >
                          +
                        </button>
                      </div>

                      {/* Hide/Unhide Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleVisibility(s.usn, !s.is_hidden)}
                        title={s.is_hidden ? `Unhide ${s.name} (${s.usn})` : `Hide ${s.name} (${s.usn})`}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                          s.is_hidden
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800"
                        }`}
                      >
                        {s.is_hidden ? "✅ Unhide" : "🚫 Hide"}
                      </button>

                      {/* Socials Modal */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditSocials(s)}
                        title={`Edit Socials for ${s.name}`}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      >
                        Socials
                      </button>

                      {/* Delete Student Record */}
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(s.usn)}
                        title={`Delete ${s.name} (${s.usn})`}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-800 transition-colors cursor-pointer"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB: USN OWNERSHIP CLAIMS & DISPUTES                          */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "disputes" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white dark:bg-[#0c0e12] rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <IconShield className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span>USN Ownership Claims &amp; Disputes</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Review selfie verifications submitted by students claiming verified account ownership.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-slate-100/80 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  {["all", "pending", "approved", "rejected"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        sfx.playClick();
                        setDisputeFilter(f);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-medium capitalize transition-colors text-[11px] sm:text-xs ${disputeFilter === f ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <IconRotateCcw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {disputeActionMsg && (
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-800 dark:text-blue-300 text-xs rounded-xl font-medium flex items-center justify-between">
                <span>{disputeActionMsg}</span>
                <button onClick={() => setDisputeActionMsg("")} className="text-blue-500 hover:text-blue-800 dark:hover:text-blue-200 font-bold p-1">
                  <IconClose className="w-3 h-3" />
                </button>
              </div>
            )}

            {disputesLoading ? (
              <div className="text-center py-12 text-xs text-slate-400">Loading dispute requests...</div>
            ) : disputes.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <IconShield className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="font-semibold text-xs text-slate-700 dark:text-slate-300 mt-2">No dispute requests found</p>
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
                    className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1218] hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                            {d.usn}
                          </span>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                            {d.branch}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1">{d.name}</h3>
                        {d.created_at && (
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            Submitted: {formatDateTime(d.created_at).full}
                          </p>
                        )}
                      </div>

                      <span
                        className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${d.status === "pending"
                          ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                          : d.status === "approved"
                            ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                            : "bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50"
                          }`}
                      >
                        {d.status}
                      </span>
                    </div>

                    {/* Selfie Preview */}
                    <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                      <div
                        onClick={() => setSelectedSelfieZoom(d.selfie_base64)}
                        className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90 shrink-0 relative group"
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
                        <p className="font-semibold text-slate-700 dark:text-slate-300">Verification Photo</p>
                        <button
                          type="button"
                          onClick={() => setSelectedSelfieZoom(d.selfie_base64)}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium block mt-0.5 cursor-pointer"
                        >
                          Inspect full photo
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    {d.status === "pending" ? (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          disabled={processingDisputeId === d.id}
                          onClick={() => handleReviewDispute(d.id, "approve")}
                          className="flex-1 py-2 px-3 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 shadow-2xs transition-colors disabled:opacity-50 text-center active:scale-[0.98] cursor-pointer"
                        >
                          {processingDisputeId === d.id ? "Processing..." : "Approve & Transfer"}
                        </button>
                        <button
                          type="button"
                          disabled={processingDisputeId === d.id}
                          onClick={() => {
                            const notes = prompt("Enter rejection reason (optional):") || undefined;
                            handleReviewDispute(d.id, "reject", notes);
                          }}
                          className="py-2 px-3 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50 text-center active:scale-[0.98] cursor-pointer"
                        >
                          ✕ Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDispute(d.id)}
                          title="Permanently delete this claim record"
                          className="py-2 px-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-center cursor-pointer"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span>
                          Reviewed: {d.reviewed_at ? formatDateTime(d.reviewed_at).date : "Done"}
                        </span>
                        <div className="flex items-center gap-2">
                          {d.admin_notes && (
                            <span className="text-slate-400 italic">Note: {d.admin_notes}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteDispute(d.id)}
                            title="Permanently delete this claim record"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          >
                            <IconTrash className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
      {/* TAB: STUDENT UPDATE & SCRAPE REQUESTS                         */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "missing_usn" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white dark:bg-[#0c0e12] rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <IconBell className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span>Student Update &amp; Scrape Requests</span>
                  {rescrapeRequests.filter((r) => r.status === "pending").length +
                    missingReports.filter((r) => r.status === "pending").length > 0 && (
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                        {rescrapeRequests.filter((r) => r.status === "pending").length +
                          missingReports.filter((r) => r.status === "pending").length} pending
                      </span>
                    )}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Review student requests for revaluation results, missing semester marks, and unindexed USNs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  loadMissingReports();
                  loadRescrapeRequests();
                }}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition-colors self-start sm:self-auto flex items-center gap-1.5 cursor-pointer"
              >
                <IconRotateCcw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Sub-tab Switcher: Revaluation/Re-scrape vs Missing USN Reports */}
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  setRequestsSubTab("rescrape");
                  loadRescrapeRequests();
                }}
                className={`py-1.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${requestsSubTab === "rescrape"
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                <IconRotateCcw className="w-3 h-3" />
                <span>Revaluation &amp; Re-scrape</span>
                {rescrapeRequests.filter((r) => r.status === "pending").length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500 text-white font-mono">
                    {rescrapeRequests.filter((r) => r.status === "pending").length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  setRequestsSubTab("missing");
                  loadMissingReports();
                }}
                className={`py-1.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${requestsSubTab === "missing"
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                <IconUsers className="w-3 h-3" />
                <span>Unindexed USN Reports</span>
                {missingReports.filter((r) => r.status === "pending").length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-600 text-white font-mono">
                    {missingReports.filter((r) => r.status === "pending").length}
                  </span>
                )}
              </button>
            </div>

            {/* Sub-tab 1: Re-scrape & Revaluation Requests */}
            {requestsSubTab === "rescrape" && (
              <div className="space-y-4">
                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["pending", "in_progress", "resolved", "rejected", "all"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        sfx.playClick();
                        setRescrapeFilter(f);
                      }}
                      className={`py-1 px-2.5 text-[11px] font-semibold rounded-lg capitalize transition-colors cursor-pointer ${rescrapeFilter === f
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                    >
                      {f === "in_progress" ? "In Progress" : f} (
                      {f === "all"
                        ? rescrapeRequests.length
                        : rescrapeRequests.filter((r) => r.status === f).length}
                      )
                    </button>
                  ))}
                </div>

                {rescrapeLoading ? (
                  <div className="py-12 text-center text-xs text-slate-400">Loading student re-scrape requests...</div>
                ) : rescrapeRequests.filter((r) => rescrapeFilter === "all" || r.status === rescrapeFilter).length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    {rescrapeFilter === "pending"
                      ? "No pending student re-scrape or revaluation requests."
                      : "No requests found matching this filter."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {rescrapeRequests
                      .filter((r) => rescrapeFilter === "all" || r.status === rescrapeFilter)
                      .map((r) => (
                        <div
                          key={r.id}
                          className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0f1218] hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{r.usn}</span>
                                {r.branch && (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase">
                                    {r.branch}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/50 text-cyan-800 dark:text-cyan-300 text-[10px] font-bold">
                                  Sem {r.target_semester}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">{r.name}</p>
                            </div>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${r.status === "pending"
                                ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                                : r.status === "in_progress"
                                  ? "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"
                                  : r.status === "resolved"
                                    ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                                }`}
                            >
                              {r.status === "in_progress" ? "Scraping" : r.status}
                            </span>
                          </div>

                          {/* Request Reason & Subject Code */}
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className={`font-semibold px-2 py-0.5 rounded ${r.request_type === "DATA_DELETION"
                              ? "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60 font-bold"
                              : "text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800"
                              }`}>
                              {r.request_type === "REVALUATION"
                                ? "Revaluation Passed"
                                : r.request_type === "MISSING_SEMESTER"
                                  ? "Missing Semester"
                                  : r.request_type === "RE_EXAM"
                                    ? "Makeup Exam"
                                    : r.request_type === "DATA_DELETION"
                                      ? "Deletion Request"
                                      : "Update Request"}
                            </span>
                            {r.subject_codes && (
                              <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                                Subjects: <strong className="text-slate-900 dark:text-slate-100">{r.subject_codes}</strong>
                              </span>
                            )}
                          </div>

                          {/* VTU Link / Custom URL if provided */}
                          {(r.vtu_link || r.custom_url) && (
                            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 space-y-2 text-xs">
                              <div>
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                  Student Provided VTU Result Link / Note:
                                </span>
                                <span className="text-[11px] font-mono text-slate-800 dark:text-slate-200 break-all select-all block bg-white dark:bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 font-medium">
                                  {r.vtu_link || r.custom_url}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                <button
                                  type="button"
                                  disabled={savingLinkId === r.id}
                                  onClick={() => handleSaveAsSemesterLink(r)}
                                  title="One-click save directly into database semester_links table and activate in scraper"
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-xl shadow-xs transition-transform active:scale-[0.98] cursor-pointer disabled:opacity-50"
                                >
                                  <span>{savingLinkId === r.id ? "Saving Link..." : "💾 Save as Semester Link"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePrefillSemesterForm(r)}
                                  title="Open in Add Semester Link form pre-filled with this link & context title"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                                >
                                  <span>Pre-fill in Semesters Form ↗</span>
                                </button>
                                <a
                                  href={r.vtu_link || r.custom_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xs hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                                >
                                  <span>Open Link</span>
                                  <IconExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          )}

                          {/* Student Note */}
                          {r.message && (
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                              <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                                Student Message:
                              </p>
                              <p className="italic">&ldquo;{r.message}&rdquo;</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                            <span>
                              {formatDateTime(r.created_at).time} • {formatDateTime(r.created_at).date}
                            </span>
                            {r.ip_address && (
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-400">
                                IP: {r.ip_address}
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          {r.status === "pending" || r.status === "in_progress" ? (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                              {r.request_type === "DATA_DELETION" ? (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={actionLoadingId === r.id}
                                    onClick={() => handleRescrapeAction(r.id, "hide_student")}
                                    className="flex-1 min-h-[40px] py-2.5 px-3 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors text-center flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                                  >
                                    <IconShield className="w-3.5 h-3.5" />
                                    <span>{actionLoadingId === r.id ? "Hiding..." : "Hide Record"}</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={actionLoadingId === r.id}
                                    onClick={() => handleRescrapeAction(r.id, "reject", "Ignored by admin")}
                                    className="min-h-[40px] py-2.5 px-3 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center cursor-pointer"
                                    title="Ignore deletion request"
                                  >
                                    ✕ Ignore
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {/* Custom Link vs No Link Actions */}
                                  {r.vtu_link || r.custom_url ? (
                                    <div className="space-y-2">
                                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                        <button
                                          type="button"
                                          disabled={actionLoadingId === r.id}
                                          onClick={() => handleQueueRequestToCrowdsource(r)}
                                          title="Add to Crowdsourced Distributed Scraping Gate with student semester, custom link, and Force Update enabled"
                                          className="flex-1 min-h-[42px] py-2.5 px-3.5 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs transition-all text-center flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                                        >
                                          <IconBolt className="w-3.5 h-3.5" />
                                          <span>{actionLoadingId === r.id ? "Queueing..." : "⚡ Queue in Gate (Force Update)"}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handlePrefillCrowdsourceForm(r)}
                                          title="Open and inspect in Crowdsourced Gate form pre-filled with link and Force Update ON"
                                          className="min-h-[42px] py-2.5 px-3 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-center cursor-pointer"
                                        >
                                          Configure in Gate ↗
                                        </button>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          disabled={actionLoadingId === r.id}
                                          onClick={() => handleRescrapeAction(r.id, "scrape_now")}
                                          className="flex-1 min-h-[38px] py-2 px-3 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 shadow-xs transition-colors text-center flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                                        >
                                          <span>Scrape Now (Manual)</span>
                                        </button>

                                        <button
                                          type="button"
                                          disabled={actionLoadingId === r.id}
                                          onClick={() => handleRescrapeAction(r.id, "resolve")}
                                          className="min-h-[38px] py-2 px-3 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors text-center cursor-pointer"
                                        >
                                          ✓ Done
                                        </button>

                                        <button
                                          type="button"
                                          disabled={actionLoadingId === r.id}
                                          onClick={() => handleRescrapeAction(r.id, "reject")}
                                          className="min-h-[38px] py-2 px-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-center cursor-pointer"
                                          title="Dismiss / Reject request"
                                        >
                                          ✕
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleDeleteRescrapeRequest(r.id)}
                                          title="Permanently delete this request record"
                                          className="min-h-[38px] py-2 px-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-center cursor-pointer"
                                        >
                                          <IconTrash className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    /* No link provided by student: clear indicator + manual scrape option */
                                    <div className="space-y-2">
                                      <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50 text-[11px] text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                                        <span className="font-bold">ℹ️ No custom link:</span>
                                        <span>Manual admin scrape or enter link in Gate</span>
                                      </div>

                                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                        <button
                                          type="button"
                                          disabled={actionLoadingId === r.id}
                                          onClick={() => handleRescrapeAction(r.id, "scrape_now")}
                                          className="flex-1 min-h-[42px] py-2.5 px-3 text-xs font-bold rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 shadow-xs transition-colors text-center flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                                        >
                                          <IconBolt className="w-3.5 h-3.5" />
                                          <span>{actionLoadingId === r.id ? "Launching..." : "Scrape Now (Manual)"}</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handlePrefillCrowdsourceForm(r)}
                                          title="Pre-fill USN and semester into Gate form to add custom link"
                                          className="min-h-[42px] py-2.5 px-3 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-center cursor-pointer"
                                        >
                                          + Add Link & Queue
                                        </button>

                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            disabled={actionLoadingId === r.id}
                                            onClick={() => handleRescrapeAction(r.id, "resolve")}
                                            className="min-h-[42px] py-2 px-3 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors text-center cursor-pointer"
                                          >
                                            ✓ Done
                                          </button>

                                          <button
                                            type="button"
                                            disabled={actionLoadingId === r.id}
                                            onClick={() => handleRescrapeAction(r.id, "reject")}
                                            className="min-h-[42px] py-2 px-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-center cursor-pointer"
                                            title="Dismiss / Reject request"
                                          >
                                            ✕
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleDeleteRescrapeRequest(r.id)}
                                            title="Permanently delete this request record"
                                            className="min-h-[42px] py-2 px-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-center cursor-pointer"
                                          >
                                            <IconTrash className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                              <span className={r.status === "resolved" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-400"}>
                                {r.status === "resolved"
                                  ? (r.request_type === "DATA_DELETION" ? "✓ Hidden" : "✓ Resolved")
                                  : (r.request_type === "DATA_DELETION" ? "✕ Ignored" : "✕ Rejected")}
                              </span>
                              <div className="flex items-center gap-2">
                                {r.resolved_at && (
                                  <span className="font-mono text-[10px] text-slate-400">
                                    {formatDateTime(r.resolved_at).date}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRescrapeRequest(r.id)}
                                  title="Permanently delete this request record"
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                >
                                  <IconTrash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Missing USN Reports */}
            {requestsSubTab === "missing" && (
              <div className="space-y-4">
                {/* Filter buttons */}
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick();
                      setMissingFilter("pending");
                    }}
                    className={`py-1.5 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${missingFilter === "pending"
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                  >
                    Pending ({missingReports.filter((r) => r.status === "pending").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick();
                      setMissingFilter("resolved");
                    }}
                    className={`py-1.5 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${missingFilter === "resolved"
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                  >
                    Resolved ({missingReports.filter((r) => r.status === "resolved").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick();
                      setMissingFilter("all");
                    }}
                    className={`py-1.5 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${missingFilter === "all"
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                  >
                    All ({missingReports.length})
                  </button>
                </div>

                {/* Content List */}
                {missingReportsLoading ? (
                  <div className="py-12 text-center text-xs text-slate-400">Loading requests...</div>
                ) : missingReports.filter((r) => missingFilter === "all" || r.status === missingFilter).length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    {missingFilter === "pending"
                      ? "No pending unindexed USN requests. All submitted USNs have been scraped."
                      : "No requests found for this filter."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {missingReports
                      .filter((r) => missingFilter === "all" || r.status === missingFilter)
                      .map((r) => (
                        <div
                          key={r.id}
                          className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0f1218] hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{r.usn}</span>
                                {r.branch && (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase">
                                    {r.branch}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">{r.name}</p>
                            </div>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${r.status === "pending"
                                ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                                : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                                }`}
                            >
                              {r.status}
                            </span>
                          </div>

                          {r.message && (
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                              <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                                Student Note:
                              </p>
                              <p className="italic">&ldquo;{r.message}&rdquo;</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                            <span>
                              {formatDateTime(r.reported_at).time} • {formatDateTime(r.reported_at).date}
                            </span>
                            {r.ip_address && (
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-400">
                                IP: {r.ip_address}
                              </span>
                            )}
                          </div>

                          {/* Action buttons */}
                          {r.status === "pending" ? (
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => handleScrapeMissingReport(r.usn)}
                                className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 shadow-xs transition-colors text-center flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                              >
                                <IconBolt className="w-3.5 h-3.5" />
                                <span>Scrape Now</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResolveMissingReport(r.id)}
                                className="py-2 px-3 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors text-center cursor-pointer"
                              >
                                ✓ Mark Done
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMissingReport(r.id)}
                                title="Delete missing report"
                                className="py-2 px-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-center cursor-pointer"
                              >
                                <IconTrash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <span>✓</span>
                                <span>Resolved</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteMissingReport(r.id)}
                                title="Delete missing report"
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              >
                                <IconTrash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB: SEMESTER COVERAGE AUDIT (SEM-1 VS SEM-2)                 */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "audit" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white dark:bg-[#0c0e12] rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <IconRotateCcw className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span>Semester Coverage Audit</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time detection of Sem 1 vs Sem 2 coverage. Instantly identify missing semester marks and trigger scrapes.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={handleRecalculateTotals}
                  disabled={recalculatingTotals}
                  title="Recalculate and combine multi-semester totals and deduplicate backlogs for all students from database marks without re-scraping VTU"
                  className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/80 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <IconBolt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{recalculatingTotals ? "Recalculating..." : "⚡ Sync / Recalculate Totals"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    loadSemesterAudit();
                  }}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <IconRotateCcw className="w-3 h-3" />
                  <span>Refresh Audit</span>
                </button>
              </div>
            </div>

            {/* Summary Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Total Students</p>
                <p className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
                  {semesterAudit?.total_students || 0}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Registered in database</p>
              </div>

              <div className="p-3 sm:p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20">
                <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Both Sems (1 &amp; 2)</p>
                <p className="text-xl sm:text-2xl font-black font-mono text-emerald-800 dark:text-emerald-300 mt-1">
                  {semesterAudit?.complete_both_sems || 0}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Complete records</p>
              </div>

              <div className="p-3 sm:p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
                <p className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400 tracking-wider">Missing Sem 2</p>
                <p className="text-xl sm:text-2xl font-black font-mono text-amber-900 dark:text-amber-300 mt-1">
                  {semesterAudit?.missing_sem2 || 0}
                </p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">Sem 1 scraped only</p>
              </div>

              <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Missing Sem 1</p>
                <p className="text-xl sm:text-2xl font-black font-mono text-slate-800 dark:text-slate-200 mt-1">
                  {semesterAudit?.missing_sem1 || 0}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Sem 2 scraped only</p>
              </div>
            </div>

            {/* Controls: Search & Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: "all", label: "All Students", count: semesterAudit?.total_students || 0 },
                  { id: "missing_sem2", label: "Missing Sem 2", count: semesterAudit?.missing_sem2 || 0 },
                  { id: "missing_sem1", label: "Missing Sem 1", count: semesterAudit?.missing_sem1 || 0 },
                  { id: "complete", label: "Complete (Both Sems)", count: semesterAudit?.complete_both_sems || 0 },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      sfx.playClick();
                      setSemesterAuditFilter(tab.id as "all" | "missing_sem2" | "missing_sem1" | "complete");
                    }}
                    className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${semesterAuditFilter === tab.id
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                  >
                    <span>{tab.label}</span>
                    <span className="ml-1.5 font-mono text-[10px] opacity-75">({tab.count})</span>
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-60">
                <input
                  type="text"
                  value={semesterAuditSearch}
                  onChange={(e) => setSemesterAuditSearch(e.target.value)}
                  placeholder="Search USN, name, or branch..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                />
                <span className="absolute left-2.5 top-2 text-slate-400">
                  <IconSearch className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* Audit List Table */}
            {semesterAuditLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Analyzing semester coverage...</div>
            ) : !semesterAudit || semesterAudit.students.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No student records to audit.</div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[550px] overflow-y-auto">
                {semesterAudit.students
                  .filter((s) => {
                    if (semesterAuditFilter === "missing_sem2") return !s.has_sem2;
                    if (semesterAuditFilter === "missing_sem1") return !s.has_sem1;
                    if (semesterAuditFilter === "complete") return s.has_sem1 && s.has_sem2;
                    return true;
                  })
                  .filter((s) => {
                    if (!semesterAuditSearch.trim()) return true;
                    const q = semesterAuditSearch.toLowerCase().trim();
                    return s.usn.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.branch.toLowerCase().includes(q);
                  })
                  .map((s) => (
                    <div
                      key={s.usn}
                      className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Identicon
                          usn={s.usn}
                          percentage={s.percentage}
                          totalBacklogs={s.total_backlogs}
                          size={36}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">{s.name}</span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 uppercase">
                              {s.branch}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="font-mono text-xs text-slate-400">{s.usn}</span>

                            {/* Semester Status Indicators */}
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${s.has_sem1
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50"
                                }`}
                            >
                              <span>{s.has_sem1 ? "✓" : "✕"}</span>
                              <span>Sem 1</span>
                            </span>

                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${s.has_sem2
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                                : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                                }`}
                            >
                              <span>{s.has_sem2 ? "✓" : "✕"}</span>
                              <span>Sem 2 {s.has_sem2 ? "" : "(Missing)"}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                        <div className="text-left sm:text-right font-mono text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">{s.percentage.toFixed(1)}%</span>
                          <span className="text-[11px] text-slate-400 ml-1">({s.total_marks} pts)</span>
                          <div className="text-[10px] mt-0.5">
                            {s.total_backlogs > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 font-bold">{s.total_backlogs} BL</span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">0 Backlogs</span>
                            )}
                          </div>
                        </div>

                        {/* One-click Action to Scrape Missing Semester */}
                        {!s.has_sem2 ? (
                          <button
                            type="button"
                            onClick={() => handleQuickScrapeSemester(s.usn, "2")}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs flex items-center gap-1.5 transition-transform active:scale-[0.98] cursor-pointer"
                          >
                            <IconBolt className="w-3.5 h-3.5" />
                            <span>Scrape Sem 2</span>
                          </button>
                        ) : !s.has_sem1 ? (
                          <button
                            type="button"
                            onClick={() => handleQuickScrapeSemester(s.usn, "1")}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-xs flex items-center gap-1.5 transition-transform active:scale-[0.98] cursor-pointer"
                          >
                            <IconBolt className="w-3.5 h-3.5" />
                            <span>Scrape Sem 1</span>
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1.5 rounded-xl flex items-center gap-1">
                            <IconCheck className="w-3.5 h-3.5" />
                            <span>Both Complete</span>
                          </span>
                        )}
                      </div>
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
          <div className="bg-white dark:bg-[#0c0e12] rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {logsSubTab === "logins" ? "📋 Student Login Audit Logs" : "🔍 Student Comparison Tracker"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {logsSubTab === "logins"
                    ? "Real-time record of students who logged in, how many times, with timestamps and network IPs. (Logs older than 2 days are automatically purged)"
                    : "Real-time record of which students compared themselves or their peers to whom. (Logs older than 2 days are automatically purged)"}
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  disabled={clearingLogs}
                  onClick={handleClearAllLogs}
                  className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Delete all logs in this view"
                >
                  <IconTrash className="w-3 h-3" />
                  <span>{clearingLogs ? "Clearing..." : "Clear Logs"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    if (logsSubTab === "logins") loadLoginLogs();
                    else loadComparisonLogs();
                  }}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <IconRotateCcw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Sub-tab switcher: Logins vs Comparisons */}
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  setLogsSubTab("logins");
                  loadLoginLogs();
                }}
                className={`py-1.5 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${logsSubTab === "logins"
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
                className={`py-1.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${logsSubTab === "comparisons"
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
              ) : compareLogsError ? (
                <div className="text-center py-10 border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 rounded-2xl p-4">
                  <span className="text-2xl">⚠️</span>
                  <p className="font-bold text-xs text-rose-700 dark:text-rose-300 mt-2">Error loading comparison logs</p>
                  <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-0.5">{compareLogsError}</p>
                  <button
                    type="button"
                    onClick={() => loadComparisonLogs()}
                    className="mt-3 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : !comparisonLogsData || comparisonLogsData.recent_logs.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <span className="text-2xl">🔍</span>
                  <p className="font-bold text-xs text-slate-700 dark:text-slate-300 mt-2">No comparisons recorded yet</p>
                  <p className="text-[11px] text-slate-400">
                    Whenever students compare themselves or peers, the exact who-compared-whom record appears here for the admin.
                  </p>
                </div>
              ) : (
                <>
                  {/* Metrics Cards */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-center sm:text-left">
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                        Comparisons
                      </span>
                      <p className="text-lg sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-0.5 sm:mt-1">
                        {comparisonLogsData.total_comparisons}
                      </p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-center sm:text-left">
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                        Most Compared Peer
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                        {comparisonLogsData.top_targets[0]
                          ? `${comparisonLogsData.top_targets[0].name.split(" ")[0]} (${comparisonLogsData.top_targets[0].count}x)`
                          : "None"}
                      </p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-center sm:text-left">
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                        Active Viewer
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                        {comparisonLogsData.active_viewers[0]
                          ? `${comparisonLogsData.active_viewers[0].name || comparisonLogsData.active_viewers[0].usn}`
                          : "Anonymous"}
                      </p>
                    </div>
                  </div>

                  {/* Top Targeted Students Leaderboard */}
                  {comparisonLogsData.top_targets.length > 0 && (
                    <div className="space-y-2.5">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Most Compared-Against Students (Peers Being Checked)
                      </h3>
                      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 max-h-48 overflow-y-auto">
                        {comparisonLogsData.top_targets.map((target) => (
                          <div
                            key={target.usn}
                            className="p-2.5 sm:p-3 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">{target.usn}</span>
                              <span className="text-slate-700 dark:text-slate-300 truncate">{target.name}</span>
                              <span className="text-[10px] text-slate-400 uppercase shrink-0">({target.branch})</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-[10px] font-bold shrink-0">
                              {target.count} peer compares
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Real-time Who Compared Whom Live Stream */}
                  <div className="space-y-2.5">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Live Stream: Who Compared Themselves To Whom
                    </h3>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto">
                      {comparisonLogsData.recent_logs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-slate-500 dark:text-slate-400">Student:</span>
                              <span className="font-semibold text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                                {log.viewer_name ? `${log.viewer_name} (${log.viewer_usn})` : log.viewer_usn}
                              </span>
                              <span className="text-slate-400 font-medium text-[11px]">compared</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 flex-wrap text-xs">
                              <span className="font-semibold text-slate-900 dark:text-white bg-slate-100/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700 font-mono">
                                {log.student1_name ? `${log.student1_name} (${log.student1_usn})` : log.student1_usn}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-0.5">
                                vs
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-white bg-slate-100/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700 font-mono">
                                {log.student2_name ? `${log.student2_name} (${log.student2_usn})` : log.student2_usn}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                            {log.compared_at && (
                              <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                                <span>{formatDateTime(log.compared_at).date}</span>
                                <span className="text-slate-300 dark:text-slate-600">·</span>
                                <span>{formatDateTime(log.compared_at).time}</span>
                              </div>
                            )}
                            {log.ip_address && (
                              <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 hidden sm:inline-block">
                                IP: {log.ip_address}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteCompareLog(log.id)}
                              title="Delete this comparison log entry"
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition-colors cursor-pointer"
                            >
                              <IconTrash className="w-3.5 h-3.5" />
                            </button>
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
                  <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-center sm:text-left">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                      Total Logins
                    </span>
                    <p className="text-lg sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-0.5 sm:mt-1">
                      {loginLogsData.total_logins}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-center sm:text-left">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                      Unique Students
                    </span>
                    <p className="text-lg sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 sm:mt-1">
                      {loginLogsData.unique_students}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-center sm:text-left">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                      Top User
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                      {loginLogsData.frequency[0]
                        ? `${loginLogsData.frequency[0].name.split(" ")[0]} (${loginLogsData.frequency[0].login_count}x)`
                        : "None"}
                    </p>
                  </div>
                </div>

                {/* Most Active Frequency Table */}
                <div className="space-y-2.5">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Student Login Frequency
                  </h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 max-h-60 overflow-y-auto">
                    {loginLogsData.frequency.length === 0 ? (
                      <p className="text-xs text-slate-400 p-4 text-center">No student logins recorded yet.</p>
                    ) : (
                      loginLogsData.frequency.map((item) => (
                        <div
                          key={item.usn}
                          className="p-2.5 sm:p-3 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">{item.usn}</span>
                            <span className="text-slate-600 dark:text-slate-400 truncate">• {item.name}</span>
                            <span className="text-[10px] text-slate-400 uppercase shrink-0">({item.branch})</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold shrink-0">
                              {item.login_count}x
                            </span>
                            {item.last_login && (
                              <span className="text-[10px] text-slate-400 hidden sm:inline">
                                {formatDateTime(item.last_login).date}
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
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Recent Login Audit Stream
                  </h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 max-h-72 overflow-y-auto">
                    {loginLogsData.recent_logs.length === 0 ? (
                      <p className="text-xs text-slate-400 p-4 text-center">No logins recorded yet.</p>
                    ) : (
                      loginLogsData.recent_logs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">{log.usn}</span>
                            <span className="text-slate-700 dark:text-slate-300 truncate">{log.name}</span>
                            <span className="text-[10px] text-slate-400 uppercase shrink-0">({log.branch})</span>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                            {log.ip_address && (
                              <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                                IP: {log.ip_address}
                              </span>
                            )}
                            <span className="text-slate-400 font-mono text-[10px]">
                              {formatDateTime(log.login_at).time} • {formatDateTime(log.login_at).date}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteLoginLog(log.id)}
                              title="Delete this login record"
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition-colors cursor-pointer shrink-0"
                            >
                              <IconTrash className="w-3.5 h-3.5" />
                            </button>
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
      {/* TAB: FACULTY AUDITS (LOGINS & UNREDACTED COMPARISONS)         */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "faculty_audits" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white dark:bg-[#0c0e12] rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🏛️</span>
                  <span>{facultyAuditsSubTab === "logins" ? "Faculty Authentication Logs" : "Faculty Student Comparison Tracker"}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {facultyAuditsSubTab === "logins"
                    ? "Audit trail of verified faculty members logging in, with client IP and timestamps."
                    : "Security log of student profiles compared by faculty members with unredacted data access."}
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={loadFacultyAudits}
                  disabled={facultyAuditsLoading}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span className={facultyAuditsLoading ? "animate-spin" : ""}>🔄</span>
                  <span>{facultyAuditsLoading ? "Refreshing..." : "Refresh"}</span>
                </button>
              </div>
            </div>

            {/* Sub-tab pills */}
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  setFacultyAuditsSubTab("logins");
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  facultyAuditsSubTab === "logins"
                    ? "bg-cyan-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Faculty Logins ({facultyAuditsData?.login_logs.length || 0})
              </button>
              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  setFacultyAuditsSubTab("comparisons");
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  facultyAuditsSubTab === "comparisons"
                    ? "bg-cyan-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Faculty Comparisons ({facultyAuditsData?.comparison_logs.length || 0})
              </button>
            </div>

            {facultyAuditsError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                ⚠️ {facultyAuditsError}
              </div>
            )}

            {facultyAuditsSubTab === "logins" ? (
              /* ========================================================================= */
              /* FACULTY LOGINS TABLE                                                      */
              /* ========================================================================= */
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80">
                {!facultyAuditsData || facultyAuditsData.login_logs.length === 0 ? (
                  <p className="text-xs text-slate-400 p-8 text-center">No faculty logins recorded yet.</p>
                ) : (
                  facultyAuditsData.login_logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          @{log.faculty_username}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40 font-semibold uppercase">
                          Faculty Access
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px]">
                        {log.ip_address && (
                          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                            IP: {log.ip_address}
                          </span>
                        )}
                        <span className="font-mono text-[10px] opacity-75">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN") : "Recent"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* ========================================================================= */
              /* FACULTY COMPARISONS TABLE                                                 */
              /* ========================================================================= */
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80">
                {!facultyAuditsData || facultyAuditsData.comparison_logs.length === 0 ? (
                  <p className="text-xs text-slate-400 p-8 text-center">No faculty comparisons logged yet.</p>
                ) : (
                  facultyAuditsData.comparison_logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          @{log.faculty_username}
                        </span>
                        <span className="text-slate-400 text-[11px]">compared</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-200/60 dark:border-cyan-800/40">
                            {log.name_a ? (
                              <>
                                <span className="font-sans font-bold text-slate-800 dark:text-slate-100">{log.name_a}</span>
                                <span className="opacity-60 text-[10px]">({log.usn_a})</span>
                              </>
                            ) : (
                              <span className="font-bold">{log.usn_a}</span>
                            )}
                          </span>
                          <span className="text-slate-400 text-[10px] font-bold">vs</span>
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-200/60 dark:border-cyan-800/40">
                            {log.name_b ? (
                              <>
                                <span className="font-sans font-bold text-slate-800 dark:text-slate-100">{log.name_b}</span>
                                <span className="opacity-60 text-[10px]">({log.usn_b})</span>
                              </>
                            ) : (
                              <span className="font-bold">{log.usn_b}</span>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] shrink-0 self-start sm:self-auto pl-3.5 sm:pl-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 font-semibold shrink-0">
                          Bypassed Privacy
                        </span>
                        <span className="font-mono text-[10px] opacity-75 whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN") : "Recent"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: SYSTEM & PLAYWRIGHT DIAGNOSTICS                        */}
      {/* ------------------------------------------------------------- */}

      {activeTab === "system" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white dark:bg-[#0c0e12] rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Host &amp; Browser Engine Diagnostics</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verify Playwright Chromium installation status to prevent scraper launch errors.
              </p>
            </div>

            {browserMsg && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-800 dark:text-blue-300 text-xs rounded-xl font-medium">
                {browserMsg}
              </div>
            )}

            {/* Status Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Backend API Service
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`w-2 h-2 rounded-full ${backendOnline ? "bg-emerald-500" : "bg-rose-500"}`}
                  />
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {backendOnline ? "Online (Healthy)" : "Offline"}
                  </span>
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Playwright Chromium
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`w-2 h-2 rounded-full ${browserStatus?.status === "ready" ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                  />
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {browserStatus?.status === "ready" ? "Ready & Installed" : "Not Detected"}
                  </span>
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Operating Platform
                </span>
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1 capitalize font-mono">
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
                <div className="bg-slate-900 dark:bg-black text-slate-200 p-3 rounded-xl font-mono text-xs space-y-1 overflow-x-auto border border-slate-800">
                  {browserStatus.detected_paths.map((p, i) => (
                    <div key={i} className="truncate text-emerald-400">
                      ✓ {p}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl">
                  No default Chromium browser cache was detected in standard directories. Click below to verify or prewarm the browser.
                </p>
              )}
            </div>

            {/* Prewarm / Check Browser Button */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Playwright self-healing auto-installs Chromium if missing during scrape.
              </span>
              <button
                type="button"
                onClick={handleVerifyBrowser}
                disabled={verifyingBrowser}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 text-center cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0c0e12] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Profile Editor
                </span>
                <h3 className="font-bold text-slate-900 dark:text-white text-base mt-0.5">
                  Edit Socials for {editingStudent.name}
                </h3>
                <p className="font-mono text-xs text-slate-400">{editingStudent.usn}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  GitHub Profile URL or Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editGithub}
                    onChange={(e) => setEditGithub(e.target.value)}
                    placeholder="e.g. username or github.com/username"
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 font-mono"
                  />
                  <span className="absolute left-2.5 top-2.5 text-slate-400">
                    <IconGitHub className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  LinkedIn Profile URL or Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editLinkedin}
                    onChange={(e) => setEditLinkedin(e.target.value)}
                    placeholder="e.g. username or linkedin.com/in/username"
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 font-mono"
                  />
                  <span className="absolute left-2.5 top-2.5 text-blue-600 dark:text-blue-400">
                    <IconLinkedIn className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {saveSocialsMsg && (
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl text-center">
                  {saveSocialsMsg}
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSocials}
                disabled={savingSocials}
                className="px-5 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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
