"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import BranchTabs from "../components/BranchTabs";
import StudentCard from "../components/StudentCard";
import Leaderboard from "../components/Leaderboard";
import CompareModal from "../components/CompareModal";
import CampusGraph from "../components/CampusGraph";
import BacklogMatrix from "../components/BacklogMatrix";
import Identicon from "../components/Identicon";
import Navbar from "../components/Navbar";
import StudyBreakHub from "../components/StudyBreakHub";
import {
  Student,
  BranchStat,
  fetchStudents,
  fetchStudent,
  fetchBranches,
  fetchLeaderboard,
  checkBackendHealth,
  AuthSession,
  verifyStudentSession,
  getStoredStudentToken,
  getStoredStudentSession,
  clearStoredStudentSession,
} from "../lib/api";
import {
  IconSearch,
  IconClose,
  IconCompare,
  IconInstallApp,
  IconShield,
  IconKey,
  IconLock,
  IconBolt,
  IconArrowRight,
  IconFileText,
  IconGrid,
  IconTable,
  IconPencil,
} from "../components/Icons";
import {
  LayoutGridIcon,
  type LayoutGridIconHandle,
  NetworkIcon,
  type NetworkIconHandle,
  ChartColumnIcon,
  type ChartColumnIconHandle,
  ShieldCheckIcon,
  type ShieldCheckIconHandle,
  DownloadIcon,
  type DownloadIconHandle,
} from "@animateicons/react/lucide";
import DenseStudentTable from "../components/DenseStudentTable";
import {
  cacheStudent,
  getCachedStudent,
  cacheStudentsList,
  getCachedStudentsList,
  getCacheAgeString,
} from "../lib/cache";
import InstallAppModal from "../components/InstallAppModal";
import StudentAuthModal from "../components/StudentAuthModal";
import PixelAvatarModal from "../components/PixelAvatarModal";
import StudentDetailModal, { OriginRect } from "../components/StudentDetailModal";
import ConsentBanner from "../components/ConsentBanner";
import PrivacySettingsModal from "../components/PrivacySettingsModal";
import { sfx } from "../lib/sfx";
import CountUp from "../components/CountUp";
import BlurText from "../components/BlurText";
import FadeContent from "../components/FadeContent";
import DecryptedText from "../components/DecryptedText";
import CursorGrid from "../components/CursorGrid";

const ALL_BRANCHES = ["ALL", "CSE", "DS", "CY", "ISE", "AIML", "ECE"];

export default function Dashboard() {
  const [activeBranch, setActiveBranch] = useState("ALL");
  const [students, setStudents] = useState<Student[]>([]);
  const [branchStats, setBranchStats] = useState<Record<string, BranchStat>>({});
  const [toppers, setToppers] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"percentage" | "backlogs" | "usn">("percentage");
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  // Student Authentication state (Session-only, resets on browser close)
  const [studentSession, setStudentSession] = useState<AuthSession | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // View state: 'dashboard' | 'topology' | 'backlogs'
  const [currentView, setCurrentView] = useState<"dashboard" | "topology" | "backlogs">("dashboard");

  // AnimateIcons ref handles for tactile click micro-animations
  const resultsNavRef = React.useRef<LayoutGridIconHandle>(null);
  const graphNavRef = React.useRef<NetworkIconHandle>(null);
  const backlogsNavRef = React.useRef<ChartColumnIconHandle>(null);
  const adminNavRef = React.useRef<ShieldCheckIconHandle>(null);
  const appNavRef = React.useRef<DownloadIconHandle>(null);

  // Display mode: 'grid' (cards) vs 'table' (dense Linear/Notion style)
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    try {
      const savedView = localStorage.getItem("vtu_view_mode") as "grid" | "table" | null;
      if (savedView === "grid" || savedView === "table") {
        setViewMode(savedView);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSetViewMode = (mode: "grid" | "table") => {
    sfx.playMechanicalClick();
    setViewMode(mode);
    try {
      localStorage.setItem("vtu_view_mode", mode);
    } catch {
      // ignore
    }
  };

  // Offline / Cache tracking for Student Detail Modal
  const [isDetailCached, setIsDetailCached] = useState(false);
  const [cachedAge, setCachedAge] = useState("");

  // Art Direction: Obsidian Dark Mode vs Clean Light Mode
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

  // Compare state
  const [compareUsns, setCompareUsns] = useState<string[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isComparingLoading, setIsComparingLoading] = useState(false);
  const [compareStudent1, setCompareStudent1] = useState<Student | null>(null);
  const [compareStudent2, setCompareStudent2] = useState<Student | null>(null);
  const [allCollegeStudents, setAllCollegeStudents] = useState<Student[]>([]);

  // Student Detail Modal state
  const [selectedUsn, setSelectedUsn] = useState<string | null>(null);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalOriginRect, setModalOriginRect] = useState<OriginRect | null>(null);

  // User Profile / "This is Me" state
  const [myUsn, setMyUsn] = useState<string>("");
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isPixelModalOpen, setIsPixelModalOpen] = useState(false);

  // Authenticated student record
  const myStudent = useMemo(() => {
    const targetUsn = (studentSession?.usn || myUsn || "").toUpperCase();
    if (!targetUsn) return null;
    return students.find((s) => s.usn.toUpperCase() === targetUsn) || null;
  }, [students, studentSession, myUsn]);

  // Restore authenticated session from localStorage/sessionStorage on mount
  useEffect(() => {
    try {
      const storedSession = getStoredStudentSession();
      if (storedSession) {
        // Optimistically restore session immediately so mobile users never experience sudden logout
        setStudentSession(storedSession);
        setMyUsn(storedSession.usn);

        // Verify session validity with backend in the background
        verifyStudentSession(storedSession.token).then((res) => {
          if (res.revoked) {
            // Password was changed or USN deleted/hidden by admin
            clearStoredStudentSession();
            setStudentSession(null);
            setMyUsn("");
          } else if (res.valid && res.usn) {
            setMyUsn(res.usn);
          }
        });
      }
    } catch {
      // ignore
    }

    // Session state synchronization: clean up session if token is revoked
    const handleRevocation = () => {
      clearStoredStudentSession();
      setStudentSession(null);
      setMyUsn("");
      loadStudentsData(null);
    };

    window.addEventListener("vtu:session-revoked", handleRevocation);

    // Also re-verify on window focus (e.g. user returns to tab)
    const handleFocus = () => {
      const activeToken = getStoredStudentToken();
      if (activeToken) {
        verifyStudentSession(activeToken).then((res) => {
          // CRUCIAL: Only revoke if explicitly revoked (401), NOT on network lag or offline
          if (res.revoked) {
            handleRevocation();
          }
        });
      }
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("vtu:session-revoked", handleRevocation);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const handleAuthSuccess = (session: AuthSession) => {
    setStudentSession(session);
    setMyUsn(session.usn);
    // Reload student data with the new auth token
    loadStudentsData(session.token);
    // Pre-cache authenticated student's full marksheet for 0ms instant offline viewing
    fetchStudent(session.usn)
      .then((data) => cacheStudent(data))
      .catch(() => {});
  };

  const handleSignOut = () => {
    clearStoredStudentSession();
    setStudentSession(null);
    setMyUsn("");
    loadStudentsData(null);
  };

  const handleCompareWithMe = async (targetStudent: Student) => {
    if (isComparingLoading) return;
    sfx.playMechanicalClick();
    if (!studentSession?.usn && !myUsn) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsComparingLoading(true);
    try {
      const pool = allCollegeStudents.length > 0 ? allCollegeStudents : students;
      let myProfile = pool.find((s) => s.usn.toUpperCase() === myUsn.toUpperCase());
      if (!myProfile && myUsn) {
        try {
          myProfile = await fetchStudent(myUsn);
        } catch {
          // Fallback
        }
      }
      if (myProfile) {
        setCompareStudent1(myProfile);
        setCompareStudent2(targetStudent);
        setSelectedUsn(null);
        setIsCompareOpen(true);
      } else {
        alert(`Could not find profile for ${myUsn}. Please ensure your marks have been scraped.`);
      }
    } finally {
      setIsComparingLoading(false);
    }
  };

  // Load initial branches & backend health
  const loadBranchData = () => {
    checkBackendHealth().then((isUp) => setBackendOnline(isUp));
    fetchStudents()
      .then((all) => setAllCollegeStudents(all))
      .catch(() => {});
    fetchBranches()
      .then((stats) => {
        const map: Record<string, BranchStat> = {};
        stats.forEach((s) => {
          map[s.branch] = s;
        });
        setBranchStats(map);
      })
      .catch((err) => console.error("Error loading branches", err));
  };

  useEffect(() => {
    loadBranchData();
  }, []);

  // Auto-recovery polling when Render free tier backend is spinning up from cold sleep
  useEffect(() => {
    if (backendOnline !== false) return;
    const interval = setInterval(async () => {
      const isUp = await checkBackendHealth();
      if (isUp) {
        setBackendOnline(true);
        loadBranchData();
        loadStudentsData();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [backendOnline]);

  // Load students & leaderboard on branch or sort change (with 0ms local storage cache)
  const loadStudentsData = (authToken?: string | null) => {
    // 0ms Instant Cache Load: Render immediately if local cache exists
    if (students.length === 0) {
      const cached = getCachedStudentsList();
      if (cached && cached.students.length > 0) {
        setStudents(cached.students);
        setLoading(false); // Dashboard shows immediately without waiting for server wakeup!
      }
    } else {
      setLoading(true);
    }

    const effectiveToken = authToken !== undefined 
      ? (authToken || undefined) 
      : (studentSession?.token || getStoredStudentToken() || undefined);

    Promise.all([
      fetchStudents({ branch: activeBranch, search: "", sort: sortBy, token: effectiveToken }),
      fetchLeaderboard({ branch: activeBranch, limit: 5 }),
    ])
      .then(([studentList, topperList]) => {
        setStudents(studentList);
        setToppers(topperList);
        if (activeBranch === "ALL" && !sortBy && studentList.length > 0) {
          cacheStudentsList(studentList);
        }
      })
      .catch((err) => console.error("Error loading data", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStudentsData();
  }, [activeBranch, sortBy, studentSession?.token]);

  // Client-side search filtering
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase().trim();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.usn.toLowerCase().includes(q)
    );
  }, [students, search]);

  // Unauthenticated server-side search fallback: Allows visitors to search ANY crowdsourced student
  const [serverSearchResults, setServerSearchResults] = useState<Student[]>([]);
  useEffect(() => {
    if (studentSession || !search.trim() || search.trim().length < 3) {
      setServerSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchStudents({ search: search.trim(), branch: activeBranch })
        .then((res) => setServerSearchResults(res))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [search, studentSession, activeBranch]);

  const displayStudents = useMemo(() => {
    if (!search.trim()) return students;
    if (filteredStudents.length > 0) return filteredStudents;
    return serverSearchResults;
  }, [search, students, filteredStudents, serverSearchResults]);

  // Dynamic branch list combining core departments and any active scraped branches (e.g. MECH, CIVIL, AIML)
  const availableBranches = useMemo(() => {
    const defaultBranches = ["ALL", "CSE", "DS", "CY", "ISE", "AIML", "ECE"];
    const extraBranches = Object.keys(branchStats).filter(
      (b) => b && !defaultBranches.includes(b) && (branchStats[b]?.total_students || 0) > 0
    );
    return [...defaultBranches, ...extraBranches.sort()];
  }, [branchStats]);

  // Precompute academic merit & overall ranks across ALL students in current view (before search filtering)
  const { meritRankMap, overallRankMap } = useMemo(() => {
    const sorted = [...students].sort((a, b) => {
      const aClean = a.total_backlogs === 0;
      const bClean = b.total_backlogs === 0;
      if (aClean !== bClean) return aClean ? -1 : 1;
      if (a.percentage !== b.percentage) return b.percentage - a.percentage;
      if (a.total_marks !== b.total_marks) return b.total_marks - a.total_marks;
      return a.usn.localeCompare(b.usn);
    });

    let meritCounter = 0;
    const meritMap = new Map<string, number>();
    const overallMap = new Map<string, number>();

    sorted.forEach((s, idx) => {
      overallMap.set(s.usn, idx + 1);
      if (s.total_backlogs === 0) {
        meritCounter++;
        meritMap.set(s.usn, meritCounter);
      }
    });

    return { meritRankMap: meritMap, overallRankMap: overallMap };
  }, [students]);

  // Aggregate metrics for hero counter cards
  const heroStats = useMemo(() => {
    // Total students and average from branch stats
    const branchCount = activeBranch === "ALL"
      ? Object.values(branchStats).reduce((sum, b) => sum + b.total_students, 0)
      : (branchStats[activeBranch]?.total_students || 0);

    // If students list is fully populated (e.g. authenticated user with all records), calculate exact metrics
    if (students.length > 5 || (branchCount === 0 && students.length > 0)) {
      const count = students.length;
      const avg = count > 0 ? students.reduce((sum, s) => sum + s.percentage, 0) / count : 0;
      const max = count > 0 ? Math.max(...students.map((s) => s.percentage)) : 0;
      return {
        count,
        avg: Math.round(avg * 10) / 10,
        max: Math.round(max * 10) / 10,
      };
    }

    // Otherwise (public view before login or while loading), use aggregate data from /api/branches
    const count = branchCount > 0 ? branchCount : students.length;
    let avg = 0;
    if (activeBranch === "ALL" && branchCount > 0) {
      avg = Object.values(branchStats).reduce((sum, b) => sum + (b.avg_percentage * b.total_students), 0) / branchCount;
    } else if (branchStats[activeBranch]) {
      avg = branchStats[activeBranch].avg_percentage;
    } else if (students.length > 0) {
      avg = students.reduce((sum, s) => sum + s.percentage, 0) / students.length;
    }
    const max = students.length > 0 ? Math.max(...students.map((s) => s.percentage)) : 0;

    return {
      count,
      avg: Math.round(avg * 10) / 10,
      max: Math.round(max * 10) / 10,
    };
  }, [students, branchStats, activeBranch]);

  // Open detail modal and fetch full marks (with 0ms instant cached load & FLIP shared element transition)
  const handleOpenDetail = async (usn: string, e?: React.MouseEvent) => {
    if (e && e.currentTarget) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setModalOriginRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setModalOriginRect(null);
    }

    setSelectedUsn(usn);

    // Step 1: 0ms Local Cache Check
    const cached = getCachedStudent(usn);
    if (cached) {
      setDetailStudent(cached.student);
      setIsDetailCached(true);
      setCachedAge(getCacheAgeString(cached.timestamp));
      setDetailLoading(false); // Display instantly in 0ms!
    } else {
      setDetailLoading(true);
      setIsDetailCached(false);
      setCachedAge("");
    }

    // Step 2: Background network fetch (Stale-While-Revalidate)
    try {
      const freshData = await fetchStudent(usn);
      setDetailStudent(freshData);
      cacheStudent(freshData); // Update cache for next time
      setIsDetailCached(false);
    } catch (err) {
      console.warn("Could not fetch fresh student data, offline or server asleep", err);
      // If we already loaded from cache, user continues browsing seamlessly!
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedUsn(null);
    setDetailStudent(null);
    setIsDetailCached(false);
    setCachedAge("");
    setModalOriginRect(null);
  };

  // Compare toggle
  const handleToggleCompare = (usn: string) => {
    setCompareUsns((prev) => {
      if (prev.includes(usn)) {
        return prev.filter((u) => u !== usn);
      }
      if (prev.length >= 2) {
        return [prev[0], usn];
      }
      return [...prev, usn];
    });
  };

  // Launch compare modal
  const handleOpenCompare = async () => {
    if (isComparingLoading || compareUsns.length < 2) return;
    if (!studentSession?.usn && !myUsn) {
      sfx.playMechanicalClick();
      setIsAuthModalOpen(true);
      return;
    }
    sfx.playSonarChime();
    setIsComparingLoading(true);
    try {
      const [s1, s2] = await Promise.all([
        fetchStudent(compareUsns[0]),
        fetchStudent(compareUsns[1]),
      ]);
      setCompareStudent1(s1);
      setCompareStudent2(s2);
      setIsCompareOpen(true);
    } catch (err) {
      console.error("Failed to fetch students for comparison", err);
    } finally {
      setIsComparingLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Subtle Ambient Tech Grid (Obsidian Dark Mode Only) */}
      {isObsidian && (
        <div className="fixed inset-0 pointer-events-none z-0 opacity-40">
          <CursorGrid
            cellSize={36}
            gridStyle="lines"
            gridColor="#1e293b"
            color="#38bdf8"
            lineWidth={0.8}
            gridOpacity={0.25}
            maxOpacity={0.35}
            spotlight={180}
            ambient={0.08}
            edgeFade={0.2}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="relative z-10">
        <Navbar
          currentView={currentView}
          onSelectView={setCurrentView}
          isObsidian={isObsidian}
          onToggleTheme={handleToggleTheme}
          studentSession={studentSession}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onSignOut={handleSignOut}
        />
      </div>

      <div className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-20 lg:pb-8 space-y-5 sm:space-y-6">
        {/* Backend Offline Notice */}
        {backendOnline === false && (
          <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/60 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 text-xs shadow-sm">
            <div>
              <p className="font-bold text-xs sm:text-sm">Server Offline</p>
              <p className="opacity-80 mt-0.5">
                Connecting to backend API... check if your Render service is waking up.
              </p>
            </div>
            <button
              onClick={() => {
                sfx.playMechanicalClick();
                checkBackendHealth().then((isUp) => {
                  setBackendOnline(isUp);
                  if (isUp) window.location.reload();
                });
              }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl transition-colors whitespace-nowrap"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* =========================================================================
            VIEW 1: Interactive Campus Graph
        ========================================================================= */}
        {currentView === "topology" && (
          <CampusGraph
            students={students}
            onSelectStudent={handleOpenDetail}
            isObsidian={isObsidian}
          />
        )}

        {/* =========================================================================
            VIEW 2: Subject Analytics & Backlog Statistics
        ========================================================================= */}
        {currentView === "backlogs" && (
          <BacklogMatrix
            students={students}
            onSelectStudent={handleOpenDetail}
            isObsidian={isObsidian}
          />
        )}

        {/* =========================================================================
            VIEW 3: Standard Dashboard (Cards, Podium, Table)
        ========================================================================= */}
        {currentView === "dashboard" && (
          <>
            {/* Hero Summary Header */}
            <div
              className={`rounded-2xl sm:rounded-3xl p-4 sm:p-6 border transition-all ${
                isObsidian
                  ? "bg-[#0c0e12] border-slate-800/90 text-white shadow-xl shadow-black/20"
                  : "bg-white border-slate-200/90 text-slate-900 shadow-sm"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isObsidian ? "bg-cyan-400" : "bg-blue-600"
                      }`}
                    />
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        isObsidian
                          ? "bg-cyan-950/40 text-cyan-400 border-cyan-800/40"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      Campus Performance
                    </span>
                  </div>
                  <BlurText
                    text="VTU WhatNow • Departmental Results Intelligence"
                    delay={35}
                    animateBy="words"
                    direction="top"
                    className="text-base sm:text-xl md:text-2xl font-bold mt-1 tracking-tight"
                  />
                  <p className="text-xs sm:text-sm mt-1 max-w-xl opacity-70">
                    Search students by name or USN, inspect department leaderboards, and compare marks.
                  </p>
                </div>

                {/* Metrics Badges with Tabular Number Ticker */}
                <div
                  className={`grid grid-cols-3 divide-x rounded-2xl p-2.5 sm:p-4 border self-stretch md:self-auto ${
                    isObsidian
                      ? "bg-slate-950/60 border-slate-800 divide-slate-800"
                      : "bg-slate-50 border-slate-200/80 divide-slate-200"
                  }`}
                >
                  <div className="text-center px-1.5 sm:px-3">
                    <p className="text-base sm:text-2xl font-bold font-mono tabular-nums">
                      <CountUp
                        key={`students-${activeBranch}-${heroStats.count}`}
                        to={heroStats.count}
                        duration={1}
                        className="font-mono tabular-nums"
                      />
                    </p>
                    <p className="text-[9px] sm:text-[10px] font-semibold opacity-60 uppercase tracking-wider mt-0.5">
                      Students
                    </p>
                  </div>

                  <div className="text-center px-1.5 sm:px-3">
                    <p className="text-base sm:text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-cyan-400">
                      <CountUp
                        key={`avg-${activeBranch}-${heroStats.avg}`}
                        to={heroStats.avg}
                        decimals={1}
                        suffix="%"
                        duration={1.2}
                        className="font-mono tabular-nums text-blue-600 dark:text-cyan-400"
                      />
                    </p>
                    <p className="text-[9px] sm:text-[10px] font-semibold opacity-60 uppercase tracking-wider mt-0.5">
                      Class Average
                    </p>
                  </div>

                  <div className="text-center px-1.5 sm:px-3">
                    <p className="text-base sm:text-2xl font-bold font-mono tabular-nums text-emerald-500">
                      <CountUp
                        key={`max-${activeBranch}-${heroStats.max}`}
                        to={heroStats.max}
                        decimals={1}
                        suffix="%"
                        duration={1.2}
                        className="font-mono tabular-nums text-emerald-500"
                      />
                    </p>
                    <p className="text-[9px] sm:text-[10px] font-semibold opacity-60 uppercase tracking-wider mt-0.5">
                      Highest Score
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Auth / Public Mode Notice Banner */}
            {studentSession ? (
              <div
                className={`rounded-2xl p-4 sm:p-5 border transition-all ${
                  isObsidian
                    ? "bg-[#0d1117] border-white/10 text-slate-100"
                    : "bg-white border-slate-200/90 text-slate-900 shadow-xs"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      onClick={() => {
                        sfx.playMechanicalClick();
                        setIsPixelModalOpen(true);
                      }}
                      className="cursor-pointer group relative shrink-0 transition-transform hover:scale-105 active:scale-95"
                      title="Click to customize your 10x10 pixel art avatar"
                    >
                      <Identicon
                        usn={studentSession.usn}
                        name={studentSession.name}
                        percentage={myStudent?.percentage}
                        totalBacklogs={myStudent?.total_backlogs}
                        customPixelArt={myStudent?.avatar_pixel_art}
                        size={46}
                        isEditable={true}
                        onEditClick={() => setIsPixelModalOpen(true)}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold font-mono px-2 py-0.5 rounded-md border ${
                          isObsidian
                            ? "bg-white/5 border-white/10 text-emerald-400"
                            : "bg-slate-100 border-slate-200 text-slate-800"
                        }`}>
                          {studentSession.usn}
                        </span>
                        <span className="text-xs opacity-60 font-medium">• {studentSession.branch}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isObsidian
                            ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/40"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200/70"
                        }`}>
                          Verified Ownership
                        </span>
                      </div>
                      <h2 className="font-bold text-base sm:text-lg tracking-tight">
                        Welcome back, {studentSession.name}
                      </h2>
                      <p className="text-xs opacity-65">
                        Your complete marksheet, percentile, and branch standings are fully unlocked.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <button
                      onClick={(e) => handleOpenDetail(studentSession.usn, e)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400"
                    >
                      <IconFileText className="w-3.5 h-3.5" />
                      <span>View Marksheet</span>
                    </button>
                    <button
                      onClick={() => {
                        sfx.playMechanicalClick();
                        setIsPixelModalOpen(true);
                      }}
                      className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                        isObsidian
                          ? "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300"
                          : "border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800"
                      }`}
                      title="Draw your 10x10 custom pixel art avatar"
                    >
                      <IconPencil className="w-3.5 h-3.5" />
                      <span>Pixel Avatar</span>
                    </button>
                    <button
                      onClick={() => {
                        sfx.playMechanicalClick();
                        setIsPrivacyModalOpen(true);
                      }}
                      className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                        isObsidian
                          ? "border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300"
                          : "border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-cyan-800"
                      }`}
                      title="Manage your public visibility, name, marks, and comparison settings"
                    >
                      <IconShield className="w-3.5 h-3.5" />
                      <span>Privacy Settings</span>
                    </button>
                    {students.length > 0 && (
                      <button
                        onClick={() => {
                          const topperCandidate = (toppers && toppers.length > 0)
                            ? toppers[0]
                            : (students.find((s) => s.total_backlogs === 0) || students[0]);
                          if (topperCandidate && topperCandidate.usn.toUpperCase() !== studentSession.usn.toUpperCase()) {
                            handleCompareWithMe(topperCandidate);
                          }
                        }}
                        className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                          isObsidian
                            ? "border-white/10 hover:bg-white/5 text-slate-200"
                            : "border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <IconCompare className="w-3.5 h-3.5" />
                        <span>Compare Topper</span>
                      </button>
                    )}
                    <button
                      onClick={handleSignOut}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                        isObsidian
                          ? "bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300"
                          : "bg-white border-zinc-200 hover:bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`rounded-2xl p-4 sm:p-5 border transition-all ${
                  isObsidian
                    ? "bg-[#0d1117] border-white/10 text-slate-100"
                    : "bg-white border-slate-200/90 text-slate-900 shadow-xs"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shrink-0 border border-slate-200/80 dark:border-white/10 bg-black flex items-center justify-center shadow-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/preview-badge.jpg"
                        alt="Rankings Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isObsidian
                            ? "bg-white/5 border-white/10 text-slate-300"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
                          Public Preview
                        </span>
                        <span className="text-xs opacity-60">
                          Showing top branch standings
                        </span>
                      </div>
                      <h2 className="font-bold text-base sm:text-lg tracking-tight">
                        Check your branch ranking and scores
                      </h2>
                      <p className="text-xs opacity-65 max-w-xl leading-relaxed">
                        Sign in with your USN to unlock your campus rank, complete subject breakdown, and private peer comparisons.
                      </p>
                    </div>
                  </div>

                  <div className="self-stretch sm:self-auto shrink-0">
                    <button
                      onClick={() => {
                        sfx.playMechanicalClick();
                        setIsAuthModalOpen(true);
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 active:scale-[0.98] shadow-sm transition-all flex items-center justify-center gap-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400"
                    >
                      <IconKey className="w-3.5 h-3.5" />
                      <span>Sign In with USN</span>
                      <IconArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Department Stream Tabs */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-xs uppercase tracking-wider opacity-70">
                  Departments
                </h2>
                <span className="text-[11px] opacity-40">Filter by branch</span>
              </div>
              <BranchTabs
                branches={availableBranches}
                activeBranch={activeBranch}
                onSelect={setActiveBranch}
                branchStats={branchStats}
                isObsidian={isObsidian}
              />
            </section>

            {/* Top Performers Podium */}
            <Leaderboard
              toppers={toppers}
              branch={activeBranch}
              onSelectStudent={(s, e) => handleOpenDetail(s.usn, e)}
              isObsidian={isObsidian}
            />

            {/* Search & Sort Controls (Unified h-9 baseline alignment) */}
            <div
              className={`flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between p-3 rounded-2xl border transition-all ${
                isObsidian
                  ? "bg-[#0c0e12] border-slate-800/90 text-white"
                  : "bg-white border-slate-200/90 shadow-sm text-slate-900"
              }`}
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student name or USN (e.g. 1RM25CS..., 1RM25CD...)"
                  className={`w-full h-9 pl-9 pr-24 sm:pr-28 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isObsidian
                      ? "bg-slate-950 border-slate-800 text-white placeholder-slate-500"
                      : "bg-slate-50/70 border-slate-200 text-slate-900"
                  }`}
                />
                <span className="absolute left-3 top-2.5 opacity-40">
                  <IconSearch className="w-4 h-4" />
                </span>
                {search ? (
                  <div className="absolute right-2.5 top-1.5 flex items-center gap-1.5">
                    <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-cyan-400 border border-blue-500/20">
                      <span className="opacity-60 text-[9px]">USN</span>
                      <DecryptedText
                        text={search.toUpperCase()}
                        speed={30}
                        maxIterations={6}
                        animateOn="view"
                        className="font-mono font-bold"
                      />
                    </span>
                    <button
                      onClick={() => {
                        sfx.playMechanicalClick();
                        setSearch("");
                      }}
                      className="opacity-40 hover:opacity-100 p-1"
                      title="Clear search"
                    >
                      <IconClose className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="absolute right-3 top-2 hidden sm:inline-flex items-center gap-1 text-[10px] font-mono opacity-40 pointer-events-none">
                    <span className="opacity-50">decode:</span>
                    <DecryptedText
                      text="1RM25CS..."
                      speed={50}
                      animateOn="hover"
                      className="font-mono font-medium"
                    />
                  </span>
                )}
              </div>

              {/* Sort Filter & View Mode Toggle (Matched h-9 height) */}
              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium opacity-60">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      sfx.playMechanicalClick();
                      setSortBy(e.target.value as any);
                    }}
                    className={`h-9 text-xs font-semibold rounded-xl border px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isObsidian
                        ? "bg-slate-950 border-slate-800 text-slate-200"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <option value="percentage">Highest Percentage</option>
                    <option value="backlogs">Least Backlogs</option>
                    <option value="usn">USN Sequence</option>
                  </select>
                </div>

                {/* Linear-style Grid vs Table View Mode Switcher */}
                <div className="h-9 flex items-center bg-slate-100 dark:bg-white/5 p-0.5 rounded-xl border border-slate-200 dark:border-white/10 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSetViewMode("grid")}
                    title="Card Grid View"
                    className={`h-full px-2.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      viewMode === "grid"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <IconGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetViewMode("table")}
                    title="Dense Spreadsheet Table View"
                    className={`h-full px-2.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      viewMode === "table"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <IconTable className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Table</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Student Cards Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs opacity-70 px-1">
                <p>
                  Showing <span className="font-bold">{filteredStudents.length}</span> students
                  {activeBranch !== "ALL" && (
                    <span> in <strong>{activeBranch}</strong></span>
                  )}
                </p>
                {compareUsns.length > 0 && (
                  <p className="text-blue-500 font-medium">
                    {compareUsns.length} selected for comparison
                  </p>
                )}
              </div>

              {loading ? (
                <div className="space-y-4 py-2">
                  {/* Clean Server Warmup Card */}
                  <div
                    className={`p-6 sm:p-8 rounded-2xl border text-center transition-all ${
                      isObsidian
                        ? "bg-[#0d1117] border-white/10 text-slate-100"
                        : "bg-white border-slate-200/90 text-slate-900 shadow-xs"
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                        isObsidian ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>
                        <IconBolt className="w-5 h-5 animate-pulse" />
                      </div>

                      <div>
                        <h3 className="text-sm sm:text-base font-bold tracking-tight">
                          Connecting to server and compiling ranks
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          Initial cloud spin-up can take up to 20 seconds. Standings will appear immediately once connected.
                        </p>
                      </div>

                      {/* Hairline Progress Indicator */}
                      <div className="w-36 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative">
                        <div className="h-full bg-slate-900 dark:bg-white w-1/2 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" />
                      </div>
                    </div>
                  </div>

                  {/* Shimmering Skeleton Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-40 rounded-2xl p-4 border animate-pulse flex flex-col justify-between ${
                          isObsidian ? "bg-white/[0.02] border-white/5" : "bg-white border-slate-200/70"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${isObsidian ? "bg-white/5" : "bg-slate-100"}`} />
                          <div className="space-y-1.5 flex-1">
                            <div className={`h-3.5 w-28 rounded-md ${isObsidian ? "bg-white/5" : "bg-slate-100"}`} />
                            <div className={`h-2.5 w-16 rounded-md ${isObsidian ? "bg-white/5" : "bg-slate-100"}`} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className={`h-3 w-full rounded-md ${isObsidian ? "bg-white/5" : "bg-slate-100"}`} />
                          <div className={`h-2 w-20 rounded-md ${isObsidian ? "bg-white/5" : "bg-slate-100"}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : displayStudents.length === 0 ? (
                <div
                  className={`text-center py-14 rounded-2xl border ${
                    isObsidian
                      ? "bg-[#0d1117] border-white/10 text-slate-400"
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                >
                  <IconSearch className="w-6 h-6 mx-auto text-slate-400 mb-2" />
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">No students found</p>
                  <p className="text-xs opacity-60 mt-0.5">
                    No results match &quot;{search}&quot;. Verify your query or scrape USNs in the Admin portal.
                  </p>
                </div>
              ) : viewMode === "grid" ? (
                <FadeContent
                  key={`grid-${activeBranch}-${sortBy}`}
                  trigger="mount"
                  duration={0.35}
                  blur={false}
                  className="w-full"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5 w-full">
                    {displayStudents.map((s) => (
                      <StudentCard
                        key={s.usn}
                        student={s}
                        rank={meritRankMap.get(s.usn) ?? overallRankMap.get(s.usn)}
                        isSelectedForCompare={compareUsns.includes(s.usn)}
                        onToggleCompare={() => handleToggleCompare(s.usn)}
                        onOpenDetail={(e) => { handleOpenDetail(s.usn, e); }}
                        isObsidian={isObsidian}
                        isMyProfile={s.usn.toUpperCase() === myUsn.toUpperCase()}
                      />
                    ))}

                    {/* Public Locked Teaser Card */}
                    {!studentSession && (
                      <div
                        onClick={() => {
                          sfx.playMechanicalClick();
                          setIsAuthModalOpen(true);
                        }}
                        className={`col-span-1 sm:col-span-2 lg:col-span-3 p-6 sm:p-7 rounded-2xl sm:rounded-3xl border border-dashed cursor-pointer text-center space-y-3 transition-all hover:border-solid active:scale-[0.99] group ${
                          isObsidian
                            ? "bg-white/[0.02] border-white/15 hover:bg-white/[0.04] text-white"
                            : "bg-slate-50/70 border-slate-300 hover:bg-slate-100/70 text-slate-800"
                        }`}
                      >
                        <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center border transition-transform group-hover:scale-105 ${
                          isObsidian ? "bg-white/5 border-white/10 text-cyan-400" : "bg-white border-slate-200 text-blue-600 shadow-xs"
                        }`}>
                          <IconLock className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-bold text-base sm:text-lg tracking-tight">
                            Unlock your academic profile
                          </h3>
                          <p className={`text-xs sm:text-sm max-w-md mx-auto leading-relaxed ${isObsidian ? "text-slate-400" : "text-slate-600"}`}>
                            Sign in with your USN to see your rank, detailed marks, and compare with peers.
                          </p>
                        </div>
                        <div className="pt-1.5">
                          <button
                            type="button"
                            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 shadow-sm inline-flex items-center gap-2 transition-transform active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400"
                          >
                            <IconKey className="w-3.5 h-3.5" />
                            <span>Sign In with USN</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </FadeContent>
              ) : (
                <FadeContent
                  key={`table-${activeBranch}-${sortBy}`}
                  trigger="mount"
                  duration={0.35}
                  blur={false}
                  className="space-y-3"
                >
                  <DenseStudentTable
                    students={displayStudents}
                    compareUsns={compareUsns}
                    onToggleCompare={handleToggleCompare}
                    onOpenDetail={handleOpenDetail}
                    myUsn={myUsn}
                    isObsidian={isObsidian}
                    externalMeritRankMap={meritRankMap}
                    externalOverallRankMap={overallRankMap}
                  />

                  {/* Public Locked Teaser Card */}
                  {!studentSession && (
                    <div
                      onClick={() => {
                        sfx.playMechanicalClick();
                        setIsAuthModalOpen(true);
                      }}
                      className={`p-6 sm:p-7 rounded-2xl sm:rounded-3xl border border-dashed cursor-pointer text-center space-y-3 transition-all hover:border-solid active:scale-[0.99] group ${
                        isObsidian
                          ? "bg-white/[0.02] border-white/15 hover:bg-white/[0.04] text-white"
                          : "bg-slate-50/70 border-slate-300 hover:bg-slate-100/70 text-slate-800"
                      }`}
                    >
                      <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center border transition-transform group-hover:scale-105 ${
                        isObsidian ? "bg-white/5 border-white/10 text-cyan-400" : "bg-white border-slate-200 text-blue-600 shadow-xs"
                      }`}>
                        <IconLock className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-base sm:text-lg tracking-tight">
                          Unlock your academic profile
                        </h3>
                        <p className={`text-xs sm:text-sm max-w-md mx-auto leading-relaxed ${isObsidian ? "text-slate-400" : "text-slate-600"}`}>
                          Sign in with your USN to see your rank, detailed marks, and compare with peers.
                        </p>
                      </div>
                      <div className="pt-1.5">
                        <button
                          type="button"
                          className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 shadow-sm inline-flex items-center gap-2 transition-transform active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400"
                        >
                          <IconKey className="w-3.5 h-3.5" />
                          <span>Sign In with USN</span>
                        </button>
                      </div>
                    </div>
                  )}
                </FadeContent>
              )}
            </div>
          </>
        )}

        {/* Study Break Hub: Student-Built Tools & Break Zone */}
        <StudyBreakHub isObsidian={isObsidian} />

        {/* Global Footer */}
        <footer className="pt-8 pb-12 border-t border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs opacity-60">
          <p>© {new Date().getFullYear()} VTU WhatNow • Open Student Results Intelligence</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:underline flex items-center gap-1 text-cyan-400">
              <IconShield className="w-3.5 h-3.5" />
              <span>Privacy Policy &amp; Opt-Out</span>
            </Link>
            <Link href="/admin" className="hover:underline">Admin Portal</Link>
          </div>
        </footer>
      </div>

      {/* Floating Comparison Action Bar */}
      {compareUsns.length > 0 && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md mx-auto pointer-events-auto">
          <div
            className={`rounded-2xl p-3 shadow-xl flex items-center justify-between gap-2.5 border transition-all ${
              isObsidian
                ? "bg-slate-950/95 border-cyan-500/50 text-white shadow-cyan-950/40"
                : "bg-white/95 border-blue-500/50 text-slate-900 shadow-blue-500/10"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping shrink-0" />
              <div className="text-xs min-w-0">
                <span className="font-bold">{compareUsns.length} / 2</span> Selected
                <p className="text-[10px] opacity-70 truncate font-mono">
                  {compareUsns
                    .map((u) => {
                      const found = (allCollegeStudents.length > 0 ? allCollegeStudents : students).find(
                        (s) => s.usn === u
                      );
                      return found ? `${found.name} (${found.branch})` : u;
                    })
                    .join(" vs ")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  sfx.playMechanicalClick();
                  setCompareUsns([]);
                }}
                className="px-2 py-1 text-xs opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              >
                Clear
              </button>
              <button
                disabled={compareUsns.length < 2 || isComparingLoading}
                onClick={handleOpenCompare}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
                  isComparingLoading
                    ? "bg-blue-600/80 text-white cursor-wait pointer-events-none opacity-90 shadow-sm"
                    : compareUsns.length === 2
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer active:scale-95"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                }`}
              >
                {isComparingLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <IconCompare className="w-3.5 h-3.5" />
                    <span>Compare</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {isCompareOpen && compareStudent1 && compareStudent2 && (
        <CompareModal
          student1={compareStudent1}
          student2={compareStudent2}
          allStudents={allCollegeStudents.length > 0 ? allCollegeStudents : students}
          viewer={studentSession ? { usn: studentSession.usn, name: studentSession.name } : myUsn ? { usn: myUsn } : null}
          onClose={() => setIsCompareOpen(false)}
        />
      )}

      {/* Student Marksheet Detail Modal with Smooth Shared Element Transition & Prev/Next Navigation */}
      {(() => {
        const currentIndex =
          selectedUsn && students.length > 0
            ? students.findIndex((s) => s.usn.toUpperCase() === selectedUsn.toUpperCase())
            : -1;
        const prevUsn = currentIndex > 0 ? students[currentIndex - 1]?.usn : null;
        const nextUsn =
          currentIndex >= 0 && currentIndex < students.length - 1
            ? students[currentIndex + 1]?.usn
            : null;

        return (
          <StudentDetailModal
            isOpen={Boolean(selectedUsn)}
            usn={selectedUsn}
            student={detailStudent}
            isLoading={detailLoading}
            isCached={isDetailCached}
            cachedAge={cachedAge}
            myUsn={myUsn}
            studentSession={studentSession}
            originRect={modalOriginRect}
            compareUsns={compareUsns}
            isObsidian={isObsidian}
            isComparingLoading={isComparingLoading}
            onClose={handleCloseDetail}
            onToggleCompare={handleToggleCompare}
            onCompareWithMe={handleCompareWithMe}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenPixelModal={() => setIsPixelModalOpen(true)}
            onRetry={(u) => handleOpenDetail(u)}
            onNavigatePrev={prevUsn ? () => handleOpenDetail(prevUsn) : undefined}
            onNavigateNext={nextUsn ? () => handleOpenDetail(nextUsn) : undefined}
            hasPrev={Boolean(prevUsn)}
            hasNext={Boolean(nextUsn)}
            currentIndex={currentIndex >= 0 ? currentIndex + 1 : undefined}
            totalStudents={students.length > 0 ? students.length : undefined}
            rank={selectedUsn ? meritRankMap.get(selectedUsn) : undefined}
            overallRank={selectedUsn ? overallRankMap.get(selectedUsn) : undefined}
          />
        );
      })()}

      {/* Mobile Bottom Navigation Bar (Thumb Zone) */}
      <nav
        aria-label="Mobile Navigation"
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 backdrop-blur-lg border-t px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around transition-colors touch-manipulation min-h-[3.5rem] ${
          isObsidian
            ? "bg-[#08090a]/95 border-slate-800/80 text-slate-400"
            : "bg-white/95 border-slate-200/80 text-slate-500 shadow-sm"
        }`}
      >
        <button
          onClick={() => {
            resultsNavRef.current?.startAnimation();
            sfx.playMechanicalClick();
            setCurrentView("dashboard");
          }}
          className={`group flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-all duration-150 cursor-pointer select-none touch-manipulation active:scale-[0.92] ${
            currentView === "dashboard"
              ? isObsidian
                ? "text-cyan-400 font-semibold"
                : "text-blue-600 font-semibold"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          <div className="relative flex items-center justify-center transition-transform duration-150 group-active:scale-95">
            <LayoutGridIcon ref={resultsNavRef} size={20} />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-1 leading-tight">Results</span>
        </button>

        <button
          onClick={() => {
            graphNavRef.current?.startAnimation();
            sfx.playSonarChime();
            setCurrentView("topology");
          }}
          className={`group flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-all duration-150 cursor-pointer select-none touch-manipulation active:scale-[0.92] ${
            currentView === "topology"
              ? isObsidian
                ? "text-cyan-400 font-semibold"
                : "text-blue-600 font-semibold"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          <div className="relative flex items-center justify-center transition-transform duration-150 group-active:scale-95">
            <NetworkIcon ref={graphNavRef} size={20} />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-1 leading-tight">Graph</span>
        </button>

        <button
          onClick={() => {
            backlogsNavRef.current?.startAnimation();
            sfx.playMechanicalClick();
            setCurrentView("backlogs");
          }}
          className={`group flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-all duration-150 cursor-pointer select-none touch-manipulation active:scale-[0.92] ${
            currentView === "backlogs"
              ? isObsidian
                ? "text-cyan-400 font-semibold"
                : "text-blue-600 font-semibold"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          <div className="relative flex items-center justify-center transition-transform duration-150 group-active:scale-95">
            <ChartColumnIcon ref={backlogsNavRef} size={20} />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-1 leading-tight">Backlogs</span>
        </button>

        <Link
          href="/admin"
          onClick={() => {
            adminNavRef.current?.startAnimation();
            sfx.playMechanicalClick();
          }}
          className="group flex flex-col items-center justify-center py-1 px-3 rounded-lg opacity-60 hover:opacity-100 transition-all duration-150 text-slate-400 hover:text-white select-none touch-manipulation active:scale-[0.92]"
        >
          <div className="relative flex items-center justify-center transition-transform duration-150 group-active:scale-95">
            <ShieldCheckIcon ref={adminNavRef} size={20} />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-1 leading-tight">Admin</span>
        </Link>

        <button
          onClick={() => {
            appNavRef.current?.startAnimation();
            sfx.playMechanicalClick();
            setIsInstallModalOpen(true);
          }}
          className="group flex flex-col items-center justify-center py-1 px-3 rounded-lg opacity-60 hover:opacity-100 transition-all duration-150 text-cyan-400 cursor-pointer select-none touch-manipulation active:scale-[0.92]"
        >
          <div className="relative flex items-center justify-center transition-transform duration-150 group-active:scale-95">
            <DownloadIcon ref={appNavRef} size={20} />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-1 leading-tight">Get App</span>
        </button>
      </nav>

      {/* PWA Install Modal for Mobile */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        isObsidian={isObsidian}
      />

      {/* Student Authentication & USN Claim Modal */}
      <StudentAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        isObsidian={isObsidian}
        initialUsn={myUsn}
      />

      {/* 10x10 Custom Pixel Avatar Studio Modal */}
      {studentSession && (
        <PixelAvatarModal
          isOpen={isPixelModalOpen}
          onClose={() => setIsPixelModalOpen(false)}
          usn={studentSession.usn}
          name={studentSession.name}
          percentage={myStudent?.percentage ?? detailStudent?.percentage ?? 75}
          totalBacklogs={myStudent?.total_backlogs ?? detailStudent?.total_backlogs ?? 0}
          initialPixelArt={
            myStudent?.avatar_pixel_art ||
            (typeof window !== "undefined"
              ? localStorage.getItem(`vtu_avatar_${studentSession.usn.toUpperCase()}`) || ""
              : "")
          }
          isObsidian={isObsidian}
          onAvatarSaved={(savedArt) => {
            setStudents((prev) =>
              prev.map((s) =>
                s.usn.toUpperCase() === studentSession.usn.toUpperCase()
                  ? { ...s, avatar_pixel_art: savedArt }
                  : s
              )
            );
            if (detailStudent && detailStudent.usn.toUpperCase() === studentSession.usn.toUpperCase()) {
              setDetailStudent((prev) => (prev ? { ...prev, avatar_pixel_art: savedArt } : null));
            }
            try {
              localStorage.setItem(`vtu_avatar_${studentSession.usn.toUpperCase()}`, savedArt);
            } catch {}
          }}
        />
      )}

      {/* One-Time Disclaimer & Student Consent Banner */}
      <ConsentBanner
        isObsidian={isObsidian}
        isLoggedIn={Boolean(studentSession)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenPrivacySettings={() => setIsPrivacyModalOpen(true)}
      />

      {/* Student Privacy Settings Modal */}
      {studentSession && (
        <PrivacySettingsModal
          isOpen={isPrivacyModalOpen}
          onClose={() => setIsPrivacyModalOpen(false)}
          usn={studentSession.usn}
          studentToken={studentSession.token}
          isObsidian={isObsidian}
          onUpdated={() => {
            fetchStudents({ branch: activeBranch, search, sort: sortBy, token: studentSession.token }).then((res) => setStudents(res));
          }}
        />
      )}
    </div>
  );
}
