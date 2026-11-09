"use client";

import React, { useState, useEffect, useMemo } from "react";
import BranchTabs from "../components/BranchTabs";
import StudentCard from "../components/StudentCard";
import Leaderboard from "../components/Leaderboard";
import CompareModal from "../components/CompareModal";
import CampusGraph from "../components/CampusGraph";
import BacklogMatrix from "../components/BacklogMatrix";
import Identicon from "../components/Identicon";
import Navbar from "../components/Navbar";
import {
  Student,
  BranchStat,
  fetchStudents,
  fetchStudent,
  fetchBranches,
  fetchLeaderboard,
  checkBackendHealth,
  AuthSession,
} from "../lib/api";
import {
  IconSearch,
  IconClose,
  IconCompare,
  IconGitHub,
  IconLinkedIn,
  IconInstallApp,
} from "../components/Icons";
import InstallAppModal from "../components/InstallAppModal";
import StudentAuthModal from "../components/StudentAuthModal";
import { sfx } from "../lib/sfx";

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

  // View state: 'dashboard' | 'topology' | 'backlogs'
  const [currentView, setCurrentView] = useState<"dashboard" | "topology" | "backlogs">("dashboard");

  // Art Direction: Obsidian Dark Mode vs Clean Light Mode
  const [isObsidian, setIsObsidian] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("vtu_theme");
    const obsidian = savedTheme !== "paper";
    setIsObsidian(obsidian);
    if (typeof document !== "undefined") {
      document.body.className = obsidian ? "theme-obsidian" : "theme-paper";
    }
  }, []);

  const handleToggleTheme = () => {
    setIsObsidian((prev) => {
      const next = !prev;
      localStorage.setItem("vtu_theme", next ? "obsidian" : "paper");
      if (typeof document !== "undefined") {
        document.body.className = next ? "theme-obsidian" : "theme-paper";
      }
      return next;
    });
  };

  // Compare state
  const [compareUsns, setCompareUsns] = useState<string[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareStudent1, setCompareStudent1] = useState<Student | null>(null);
  const [compareStudent2, setCompareStudent2] = useState<Student | null>(null);
  const [allCollegeStudents, setAllCollegeStudents] = useState<Student[]>([]);

  // Student Detail Modal state
  const [selectedUsn, setSelectedUsn] = useState<string | null>(null);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // User Profile / "This is Me" state
  const [myUsn, setMyUsn] = useState<string>("");
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // Restore authenticated session from sessionStorage on mount (resets on tab/browser close)
  useEffect(() => {
    try {
      const storedSession = sessionStorage.getItem("vtu_student_session");
      if (storedSession) {
        const parsed = JSON.parse(storedSession) as AuthSession;
        setStudentSession(parsed);
        setMyUsn(parsed.usn);
      } else {
        const saved = localStorage.getItem("vtu_my_usn");
        if (saved) setMyUsn(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleAuthSuccess = (session: AuthSession) => {
    setStudentSession(session);
    setMyUsn(session.usn);
    // Reload student data with the new auth token
    loadStudentsData(session.token);
  };

  const handleSignOut = () => {
    sessionStorage.removeItem("vtu_student_token");
    sessionStorage.removeItem("vtu_student_session");
    sessionStorage.removeItem("vtu_student_usn");
    setStudentSession(null);
    loadStudentsData(null);
  };

  const handleSetMyUsn = (usn: string) => {
    const clean = usn.trim().toUpperCase();
    setMyUsn(clean);
    if (clean) {
      localStorage.setItem("vtu_my_usn", clean);
    } else {
      localStorage.removeItem("vtu_my_usn");
    }
  };

  const handleCompareWithMe = (targetStudent: Student) => {
    sfx.playMechanicalClick();
    const pool = allCollegeStudents.length > 0 ? allCollegeStudents : students;
    const myProfile = pool.find((s) => s.usn.toUpperCase() === myUsn.toUpperCase());
    if (myProfile) {
      setCompareStudent1(myProfile);
      setCompareStudent2(targetStudent);
      setSelectedUsn(null);
      setIsCompareOpen(true);
    } else {
      alert(`Could not find profile for ${myUsn}. Please ensure your marks have been scraped.`);
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

  // Load students & leaderboard on branch or sort change
  const loadStudentsData = (authToken?: string | null) => {
    setLoading(true);
    const effectiveToken = authToken !== undefined 
      ? (authToken || undefined) 
      : (studentSession?.token || (typeof window !== "undefined" ? sessionStorage.getItem("vtu_student_token") || undefined : undefined));

    Promise.all([
      fetchStudents({ branch: activeBranch, search: "", sort: sortBy, token: effectiveToken }),
      fetchLeaderboard({ branch: activeBranch, limit: 5 }),
    ])
      .then(([studentList, topperList]) => {
        setStudents(studentList);
        setToppers(topperList);
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

  // Open detail modal and fetch full marks
  const handleOpenDetail = async (usn: string) => {
    setSelectedUsn(usn);
    setDetailLoading(true);
    try {
      const data = await fetchStudent(usn);
      setDetailStudent(data);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedUsn(null);
    setDetailStudent(null);
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
    if (compareUsns.length < 2) return;
    sfx.playSonarChime();
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
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <Navbar
        currentView={currentView}
        onSelectView={setCurrentView}
        isObsidian={isObsidian}
        onToggleTheme={handleToggleTheme}
        studentSession={studentSession}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-20 lg:pb-8 space-y-5 sm:space-y-6">
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
              className={`rounded-2xl sm:rounded-3xl p-4.5 sm:p-7 border transition-all ${
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
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        isObsidian
                          ? "bg-cyan-950/40 text-cyan-400 border-cyan-800/40"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      Campus Performance
                    </span>
                  </div>
                  <h1 className="text-lg sm:text-2xl font-extrabold mt-1.5 tracking-tight">
                    VTU Semester Results
                  </h1>
                  <p className="text-xs sm:text-sm mt-0.5 max-w-xl opacity-70">
                    Search students by name or USN, inspect department leaderboards, and compare marks.
                  </p>
                </div>

                {/* Metrics Badges */}
                <div
                  className={`flex items-center gap-3 sm:gap-6 rounded-2xl p-3 sm:p-4 border self-start md:self-auto ${
                    isObsidian
                      ? "bg-slate-950/60 border-slate-800"
                      : "bg-slate-50 border-slate-200/80"
                  }`}
                >
                  <div className="text-center px-1 sm:px-2">
                    <p className="text-xl sm:text-2xl font-black font-mono">{students.length}</p>
                    <p className="text-[10px] font-semibold opacity-60 uppercase tracking-wider mt-0.5">
                      Students
                    </p>
                  </div>
                  <div className="w-px h-7 bg-slate-300 dark:bg-slate-800" />
                  <div className="text-center px-1 sm:px-2">
                    <p className="text-xl sm:text-2xl font-black font-mono text-emerald-500">
                      {students.filter((s) => s.total_backlogs === 0).length}
                    </p>
                    <p className="text-[10px] font-semibold opacity-60 uppercase tracking-wider mt-0.5">
                      All Clear
                    </p>
                  </div>
                  <div className="w-px h-7 bg-slate-300 dark:bg-slate-800" />
                  <div className="text-center px-1 sm:px-2">
                    <p className="text-xl sm:text-2xl font-black font-mono text-rose-500">
                      {students.reduce((sum, s) => sum + s.total_backlogs, 0)}
                    </p>
                    <p className="text-[10px] font-semibold opacity-60 uppercase tracking-wider mt-0.5">
                      Backlogs
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Auth / Public Mode Notice Banner */}
            {studentSession ? (
              <div
                className={`rounded-2xl p-4 border transition-all ${
                  isObsidian
                    ? "bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-transparent border-emerald-500/30 text-white"
                    : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xl shrink-0">
                      🎓
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          {studentSession.usn}
                        </span>
                        <span className="text-xs opacity-60">• {studentSession.branch}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                          Unlocked
                        </span>
                      </div>
                      <p className="font-bold text-sm sm:text-base mt-0.5">
                        Logged in as {studentSession.name}
                      </p>
                      <p className="text-xs opacity-70">
                        Full branch rankings &amp; marks unlocked for this session.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleOpenDetail(studentSession.usn)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all"
                    >
                      My Marksheet
                    </button>
                    <button
                      onClick={handleSignOut}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
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
                className={`rounded-2xl p-4 border transition-all ${
                  isObsidian
                    ? "bg-gradient-to-r from-cyan-950/30 via-slate-900/40 to-transparent border-cyan-500/30 text-white"
                    : "bg-blue-50/80 border-blue-200 text-blue-950"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xl shrink-0">
                      🔒
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Public Preview
                        </span>
                        <span className="text-xs opacity-75">
                          Viewing Top 3 per branch &amp; Top 5 campus
                        </span>
                      </div>
                      <p className="font-bold text-sm sm:text-base mt-0.5">
                        Want to see your ranking and full batch results?
                      </p>
                      <p className="text-xs opacity-70">
                        Log in with your USN to unlock your marks, rank in branch, and campus standings.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      sfx.playMechanicalClick();
                      setIsAuthModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all self-stretch sm:self-auto text-center"
                  >
                    🔑 Login / Claim Your USN
                  </button>
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
                branches={ALL_BRANCHES}
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
              onSelectStudent={(s) => handleOpenDetail(s.usn)}
              isObsidian={isObsidian}
            />

            {/* Search & Sort Controls */}
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
                  className={`w-full pl-9 pr-8 py-2 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isObsidian
                      ? "bg-slate-950 border-slate-800 text-white placeholder-slate-500"
                      : "bg-slate-50/70 border-slate-200 text-slate-900"
                  }`}
                />
                <span className="absolute left-3 top-2.5 opacity-40">
                  <IconSearch className="w-4 h-4" />
                </span>
                {search && (
                  <button
                    onClick={() => {
                      sfx.playMechanicalClick();
                      setSearch("");
                    }}
                    className="absolute right-3 top-2.5 opacity-40 hover:opacity-100"
                  >
                    <IconClose className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Sort Filter */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <span className="text-[11px] font-medium opacity-60">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    sfx.playMechanicalClick();
                    setSortBy(e.target.value as any);
                  }}
                  className={`text-xs font-semibold rounded-xl border px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-40 rounded-2xl animate-pulse ${
                        isObsidian ? "bg-slate-900/40" : "bg-slate-100"
                      }`}
                    />
                  ))}
                </div>
              ) : filteredStudents.length === 0 ? (
                <div
                  className={`text-center py-14 rounded-2xl border ${
                    isObsidian
                      ? "bg-[#090b0e] border-slate-800 text-slate-400"
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                >
                  <p className="text-2xl mb-1.5">🔍</p>
                  <p className="font-bold text-sm">No students found</p>
                  <p className="text-xs opacity-60 mt-0.5">
                    No results match &quot;{search}&quot;. Add or scrape students in the Admin Room.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5">
                  {filteredStudents.map((s, idx) => (
                    <StudentCard
                      key={s.usn}
                      student={s}
                      rank={sortBy === "percentage" && !search ? idx + 1 : undefined}
                      isSelectedForCompare={compareUsns.includes(s.usn)}
                      onToggleCompare={() => handleToggleCompare(s.usn)}
                      onOpenDetail={() => handleOpenDetail(s.usn)}
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
                      className={`col-span-1 sm:col-span-2 lg:col-span-3 p-5 sm:p-6 rounded-2xl border border-dashed cursor-pointer text-center space-y-2.5 transition-all hover:scale-[1.008] active:scale-[0.99] ${
                        isObsidian
                          ? "bg-slate-900/30 border-cyan-500/40 hover:bg-slate-900/60 text-white shadow-lg shadow-black/20"
                          : "bg-blue-50/50 border-blue-300 hover:bg-blue-50/80 text-slate-800 shadow-sm"
                      }`}
                    >
                      <div className="w-11 h-11 mx-auto rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xl">
                        🔐
                      </div>
                      <h3 className="font-bold text-sm sm:text-base">
                        Unlock Full Batch Results &amp; Ranking
                      </h3>
                      <p className="text-xs opacity-75 max-w-md mx-auto leading-relaxed">
                        In public mode, only the Top 3 students per department are visible. Enter your USN to unlock the full campus directory, see all scores, and view your personal marksheet.
                      </p>
                      <div className="pt-1">
                        <button
                          type="button"
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md shadow-emerald-500/20"
                        >
                          🔑 Login / Claim Your USN →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating Comparison Action Bar */}
      {compareUsns.length > 0 && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-md px-4">
          <div
            className={`rounded-2xl p-3 shadow-xl flex items-center justify-between gap-3 border transition-all ${
              isObsidian
                ? "bg-slate-950/95 border-cyan-500/50 text-white shadow-cyan-950/40"
                : "bg-white/95 border-blue-500/50 text-slate-900 shadow-blue-500/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <div className="text-xs">
                <span className="font-bold">{compareUsns.length} / 2</span> Selected
                <p className="text-[10px] opacity-70 truncate max-w-[210px] sm:max-w-xs font-mono">
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

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  sfx.playMechanicalClick();
                  setCompareUsns([]);
                }}
                className="px-2.5 py-1 text-xs opacity-60 hover:opacity-100 transition-opacity"
              >
                Clear
              </button>
              <button
                disabled={compareUsns.length < 2}
                onClick={handleOpenCompare}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all ${
                  compareUsns.length === 2
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                }`}
              >
                <IconCompare className="w-3.5 h-3.5" />
                <span>Compare</span>
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
          onClose={() => setIsCompareOpen(false)}
        />
      )}

      {/* Student Marksheet Detail Modal */}
      {selectedUsn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div
            className={`rounded-2xl sm:rounded-3xl border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 ${
              isObsidian
                ? "bg-[#0b0d11] border-slate-800 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Modal Header */}
            <div
              className={`px-4 sm:px-6 py-3.5 sm:py-4 border-b flex items-center justify-between ${
                isObsidian ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Identicon
                  usn={selectedUsn}
                  percentage={detailStudent?.percentage}
                  totalBacklogs={detailStudent?.total_backlogs}
                  size={40}
                  showFingerprint
                />
                <div>
                  <h2 className="font-bold text-sm sm:text-base leading-tight">
                    {detailStudent?.name || "Student Marksheet"}
                  </h2>
                  <p className="text-xs opacity-60 font-mono">{selectedUsn} • {detailStudent?.branch || "ENG"}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playMechanicalClick();
                    handleToggleCompare(selectedUsn);
                  }}
                  className={`p-1.5 sm:p-2 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all ${
                    compareUsns.includes(selectedUsn)
                      ? "bg-blue-600 text-white border-blue-600 font-bold"
                      : isObsidian
                      ? "bg-slate-900 text-slate-300 border-slate-800"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <IconCompare className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">
                    {compareUsns.includes(selectedUsn) ? "Added" : "Compare"}
                  </span>
                </button>
                <button
                  onClick={() => {
                    sfx.playMechanicalClick();
                    handleCloseDetail();
                  }}
                  className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl transition-colors"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="space-y-3 py-6">
                  <div className="h-6 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
                  <div className="h-16 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
                  <div className="h-32 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
                </div>
              ) : !detailStudent ? (
                <p className="text-center opacity-60 py-6 text-xs">Student record not found.</p>
              ) : (
                <>
                  {/* Summary Metric Tiles */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div
                      className={`p-2.5 sm:p-3 rounded-xl border ${
                        isObsidian ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-100"
                      }`}
                    >
                      <p className="text-[10px] uppercase font-semibold opacity-50">Score</p>
                      <p className="text-sm sm:text-base font-bold font-mono mt-0.5">
                        {detailStudent.total_marks}
                        <span className="text-[10px] font-normal opacity-50 ml-0.5">
                          /{detailStudent.max_marks || 100}
                        </span>
                      </p>
                    </div>
                    <div
                      className={`p-2.5 sm:p-3 rounded-xl border ${
                        isObsidian
                          ? "bg-cyan-950/20 border-cyan-800/40 text-cyan-300"
                          : "bg-blue-50/60 border-blue-100 text-blue-700"
                      }`}
                    >
                      <p className="text-[10px] uppercase font-semibold opacity-80">Percentage</p>
                      <p className="text-sm sm:text-base font-black font-mono mt-0.5">
                        {detailStudent.percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div
                      className={`p-2.5 sm:p-3 rounded-xl border ${
                        detailStudent.total_backlogs > 0
                          ? isObsidian
                            ? "bg-rose-950/30 border-rose-800/60 text-rose-400"
                            : "bg-rose-50 border-rose-200 text-rose-700"
                          : isObsidian
                          ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-400"
                          : "bg-emerald-50 border-emerald-200 text-emerald-700"
                      }`}
                    >
                      <p className="text-[10px] uppercase font-semibold opacity-80">Backlogs</p>
                      <p className="text-sm sm:text-base font-black font-mono mt-0.5">
                        {detailStudent.total_backlogs}
                      </p>
                    </div>
                  </div>

                  {/* Compare with Yourself or Pin Profile Action */}
                  <div
                    className={`p-3 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-2.5 ${
                      isObsidian
                        ? "bg-gradient-to-r from-cyan-950/30 to-blue-950/20 border-cyan-800/40"
                        : "bg-gradient-to-r from-blue-50 to-indigo-50/50 border-blue-200"
                    }`}
                  >
                    <div className="text-left w-full sm:w-auto">
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <span>⚡️ Head-to-Head</span>
                        {myUsn && myUsn.toUpperCase() !== selectedUsn.toUpperCase() && (
                          <span className="text-[10px] opacity-70 font-mono">vs You ({myUsn})</span>
                        )}
                      </div>
                      <p className="text-[11px] opacity-70">
                        {selectedUsn.toUpperCase() === myUsn.toUpperCase()
                          ? "This is your personal marksheet."
                          : myUsn
                          ? "Instantly evaluate subject marks and leads side-by-side."
                          : "Compare this student directly against your own marks."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      {selectedUsn.toUpperCase() === myUsn.toUpperCase() ? (
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                          <span>⭐️ Your Profile</span>
                          <button
                            onClick={() => {
                              sfx.playMechanicalClick();
                              handleSetMyUsn("");
                            }}
                            className="text-[10px] underline opacity-60 hover:opacity-100 ml-1"
                          >
                            (unpin)
                          </button>
                        </span>
                      ) : myUsn ? (
                        <button
                          onClick={() => handleCompareWithMe(detailStudent)}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5 transition-transform active:scale-95"
                        >
                          <IconCompare className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Compare with Me</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <button
                            onClick={() => {
                              sfx.playMechanicalClick();
                              handleSetMyUsn(selectedUsn);
                            }}
                            title="Pin this USN as your profile"
                            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                          >
                            ⭐️ Pin as My USN
                          </button>
                          <button
                            onClick={() => {
                              sfx.playMechanicalClick();
                              const inputUsn = prompt("Enter your USN to compare with:", "1RM25CS");
                              if (inputUsn) {
                                handleSetMyUsn(inputUsn);
                                const pool = allCollegeStudents.length > 0 ? allCollegeStudents : students;
                                const myProfile = pool.find((s) => s.usn.toUpperCase() === inputUsn.trim().toUpperCase());
                                if (myProfile) {
                                  setCompareStudent1(myProfile);
                                  setCompareStudent2(detailStudent);
                                  setSelectedUsn(null);
                                  setIsCompareOpen(true);
                                } else {
                                  alert(`Saved your USN as ${inputUsn.toUpperCase()}. Scrape your USN in Admin room to populate marks.`);
                                }
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors flex items-center gap-1"
                          >
                            <IconCompare className="w-3.5 h-3.5" />
                            <span>Compare with You</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Social Profile Badges */}
                  {(detailStudent.github_url || detailStudent.linkedin_url) && (
                    <div
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        isObsidian ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-100"
                      }`}
                    >
                      <span className="opacity-60 text-[11px]">Public Profiles:</span>
                      <div className="flex items-center gap-2">
                        {detailStudent.github_url && (
                          <a
                            href={detailStudent.github_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white transition-colors text-xs font-medium"
                          >
                            <IconGitHub className="w-3.5 h-3.5" />
                            <span>GitHub</span>
                          </a>
                        )}
                        {detailStudent.linkedin_url && (
                          <a
                            href={detailStudent.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 transition-colors text-xs font-medium"
                          >
                            <IconLinkedIn className="w-3.5 h-3.5" />
                            <span>LinkedIn</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Marks Breakdown Table */}
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider opacity-70 mb-2">
                      Subject Marks Breakdown ({detailStudent.marks?.length || 0})
                    </h3>
                    <div
                      className={`overflow-x-auto rounded-xl border ${
                        isObsidian ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white"
                      }`}
                    >
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr
                            className={`border-b text-[10px] opacity-60 uppercase ${
                              isObsidian ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <th className="py-2 px-3 font-semibold">Code</th>
                            <th className="py-2 px-3 font-semibold">Subject</th>
                            <th className="py-2 px-2 font-semibold text-center">Int</th>
                            <th className="py-2 px-2 font-semibold text-center">Ext</th>
                            <th className="py-2 px-2 font-semibold text-center">Total</th>
                            <th className="py-2 px-3 font-semibold text-right">Result</th>
                          </tr>
                        </thead>
                        <tbody
                          className={`divide-y ${
                            isObsidian ? "divide-slate-800/60" : "divide-slate-100"
                          }`}
                        >
                          {detailStudent.marks && detailStudent.marks.length > 0 ? (
                            detailStudent.marks.map((m, i) => (
                              <tr
                                key={i}
                                className={isObsidian ? "hover:bg-slate-900/40" : "hover:bg-slate-50/60"}
                              >
                                <td className="py-2 px-3 font-mono font-semibold opacity-80">
                                  {m.subject_code}
                                </td>
                                <td className="py-2 px-3 font-medium max-w-[180px] sm:max-w-[220px] truncate">
                                  {m.subject_name || m.subject_code}
                                </td>
                                <td className="py-2 px-2 text-center opacity-60 font-mono">
                                  {m.internal_marks}
                                </td>
                                <td className="py-2 px-2 text-center opacity-60 font-mono">
                                  {m.external_marks}
                                </td>
                                <td className="py-2 px-2 text-center font-bold font-mono">
                                  {m.total}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <span
                                    className={`inline-block font-semibold px-2 py-0.2 rounded text-[10px] border ${
                                      m.status === "P"
                                        ? isObsidian
                                          ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : isObsidian
                                        ? "bg-rose-950 text-rose-400 border-rose-800"
                                        : "bg-rose-50 text-rose-700 border-rose-200"
                                    }`}
                                  >
                                    {m.status === "P" ? "PASS" : m.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-6 text-center opacity-40 text-xs">
                                No subject records available for this student.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Thumb Zone) */}
      <nav
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 backdrop-blur-lg border-t px-2 py-1.5 flex items-center justify-around transition-colors ${
          isObsidian
            ? "bg-[#08090a]/95 border-slate-800/80 text-slate-400"
            : "bg-white/95 border-slate-200/80 text-slate-500 shadow-lg"
        }`}
      >
        <button
          onClick={() => {
            sfx.playMechanicalClick();
            setCurrentView("dashboard");
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            currentView === "dashboard"
              ? isObsidian
                ? "text-cyan-400 font-bold"
                : "text-blue-600 font-bold"
              : "opacity-70 hover:opacity-100"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <span className="text-[10px]">Results</span>
        </button>

        <button
          onClick={() => {
            sfx.playSonarChime();
            setCurrentView("topology");
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            currentView === "topology"
              ? isObsidian
                ? "text-cyan-400 font-bold"
                : "text-blue-600 font-bold"
              : "opacity-70 hover:opacity-100"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v6m0 6v6M3 12h6m6 0h6" />
          </svg>
          <span className="text-[10px]">Graph</span>
        </button>

        <button
          onClick={() => {
            sfx.playMechanicalClick();
            setCurrentView("backlogs");
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            currentView === "backlogs"
              ? isObsidian
                ? "text-cyan-400 font-bold"
                : "text-blue-600 font-bold"
              : "opacity-70 hover:opacity-100"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-[10px]">Backlogs</span>
        </button>

        <button
          onClick={() => {
            sfx.playMechanicalClick();
            setIsInstallModalOpen(true);
          }}
          className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl opacity-70 hover:opacity-100 transition-all text-cyan-400"
        >
          <IconInstallApp className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[10px]">Get App</span>
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
    </div>
  );
}
