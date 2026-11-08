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
} from "../lib/api";
import {
  IconSearch,
  IconClose,
  IconCompare,
  IconGitHub,
  IconLinkedIn,
  IconExternalLink,
} from "../components/Icons";
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

  // View state: 'dashboard' | 'topology' | 'backlogs'
  const [currentView, setCurrentView] = useState<"dashboard" | "topology" | "backlogs">("dashboard");

  // Art Direction: "God View" Obsidian Mode vs Clean White Paper Mode
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

  // Student Detail Modal state (strictly read-only for visitors)
  const [selectedUsn, setSelectedUsn] = useState<string | null>(null);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load initial branches & backend health
  const loadBranchData = () => {
    checkBackendHealth().then((isUp) => setBackendOnline(isUp));
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
  const loadStudentsData = () => {
    setLoading(true);
    Promise.all([
      fetchStudents({ branch: activeBranch, search: "", sort: sortBy }),
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
  }, [activeBranch, sortBy]);

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
    <div className="min-h-screen flex flex-col font-mono">
      {/* Dynamic Tactical Navigation */}
      <Navbar
        currentView={currentView}
        onSelectView={setCurrentView}
        isObsidian={isObsidian}
        onToggleTheme={handleToggleTheme}
      />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Backend Offline Banner */}
        {backendOnline === false && (
          <div className="bg-amber-950/40 border border-amber-600/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-300 shadow-sm">
            <div>
              <p className="font-bold text-xs sm:text-sm">⚠️ API Backend is Offline</p>
              <p className="text-[11px] opacity-80 mt-0.5">
                Ensure your FastAPI server is running to fetch real-time university results.
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
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl transition-colors whitespace-nowrap"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Command View Switcher (for Mobile & Tablet) */}
        <div className="flex lg:hidden items-center justify-between gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs font-mono">
          <button
            onClick={() => {
              sfx.playMechanicalClick();
              setCurrentView("dashboard");
            }}
            className={`flex-1 py-2 rounded-xl text-center font-bold text-[11px] transition-all ${
              currentView === "dashboard"
                ? "bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/40"
                : "text-slate-400"
            }`}
          >
            📊 Dossier
          </button>
          <button
            onClick={() => {
              sfx.playSonarChime();
              setCurrentView("topology");
            }}
            className={`flex-1 py-2 rounded-xl text-center font-bold text-[11px] transition-all ${
              currentView === "topology"
                ? "bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/40"
                : "text-slate-400"
            }`}
          >
            🕸️ Topology
          </button>
          <button
            onClick={() => {
              sfx.playMechanicalClick();
              setCurrentView("backlogs");
            }}
            className={`flex-1 py-2 rounded-xl text-center font-bold text-[11px] transition-all ${
              currentView === "backlogs"
                ? "bg-rose-500 text-white shadow-sm shadow-rose-500/40"
                : "text-slate-400"
            }`}
          >
            💀 Backlogs
          </button>
        </div>

        {/* =========================================================================
            VIEW 1: Interactive Campus Network Topology
        ========================================================================= */}
        {currentView === "topology" && (
          <CampusGraph
            students={students}
            onSelectStudent={handleOpenDetail}
            isObsidian={isObsidian}
          />
        )}

        {/* =========================================================================
            VIEW 2: Backlog Inspection Matrix & Graveyard
        ========================================================================= */}
        {currentView === "backlogs" && (
          <BacklogMatrix
            students={students}
            onSelectStudent={handleOpenDetail}
            isObsidian={isObsidian}
          />
        )}

        {/* =========================================================================
            VIEW 3: Standard Dossier Dashboard (Cards, Podium, Table)
        ========================================================================= */}
        {currentView === "dashboard" && (
          <>
            {/* Header Hero Banner */}
            <div
              className={`rounded-3xl p-5 sm:p-7 border transition-all duration-300 ${
                isObsidian
                  ? "bg-[#090b0e] border-slate-800 text-white shadow-xl shadow-cyan-950/10"
                  : "bg-slate-900 text-white shadow-sm"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-md border border-cyan-800/60">
                      VTU SURVEILLANCE &amp; ACADEMIC DOSSIER
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-3xl font-black mt-2.5 tracking-tight">
                    Campus Results &amp; Marks Analytics
                  </h1>
                  <p className="text-xs sm:text-sm mt-1 max-w-xl opacity-70">
                    Search by USN or name, group by branch, view procedural crypto identicons, and compare subject marks head-to-head.
                  </p>
                </div>

                {/* Quick Telemetry Bar */}
                <div className="flex items-center gap-3 sm:gap-6 bg-slate-950/60 rounded-2xl p-3 sm:p-4 border border-slate-800 self-start md:self-auto">
                  <div className="text-center px-2">
                    <p className="text-xl sm:text-2xl font-black text-white">{students.length}</p>
                    <p className="text-[9px] font-semibold opacity-60 uppercase tracking-wider mt-0.5">
                      Indexed
                    </p>
                  </div>
                  <div className="w-px h-8 bg-slate-800" />
                  <div className="text-center px-2">
                    <p className="text-xl sm:text-2xl font-black text-emerald-400">
                      {students.filter((s) => s.total_backlogs === 0).length}
                    </p>
                    <p className="text-[9px] font-semibold opacity-60 uppercase tracking-wider mt-0.5">
                      All Clear
                    </p>
                  </div>
                  <div className="w-px h-8 bg-slate-800" />
                  <div className="text-center px-2">
                    <p className="text-xl sm:text-2xl font-black text-rose-400">
                      {students.reduce((sum, s) => sum + s.total_backlogs, 0)}
                    </p>
                    <p className="text-[9px] font-semibold opacity-60 uppercase tracking-wider mt-0.5">
                      Backlogs
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Branch Tabs Selection */}
            <section>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="font-bold text-xs uppercase tracking-wider opacity-70">
                  Select Department Stream
                </h2>
                <span className="text-[11px] opacity-40">Filter student cards by branch</span>
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
              className={`flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between p-3 sm:p-4 rounded-2xl border transition-all ${
                isObsidian
                  ? "bg-[#0c0e12] border-slate-800 text-white"
                  : "bg-white border-slate-200/90 shadow-sm text-slate-900"
              }`}
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Query by student name or USN (e.g. 1RM25CS..., 1RM25CD...)"
                  className={`w-full pl-9 pr-8 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    isObsidian
                      ? "bg-slate-950/80 border-slate-800 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
                <span className="absolute left-3 top-3 opacity-40">
                  <IconSearch className="w-4 h-4" />
                </span>
                {search && (
                  <button
                    onClick={() => {
                      sfx.playMechanicalClick();
                      setSearch("");
                    }}
                    className="absolute right-3 top-3 opacity-40 hover:opacity-100"
                  >
                    <IconClose className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Sorting Filter */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <span className="text-[10px] uppercase font-bold opacity-50 whitespace-nowrap">
                  Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    sfx.playMechanicalClick();
                    setSortBy(e.target.value as any);
                  }}
                  className={`text-xs font-bold rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    isObsidian
                      ? "bg-slate-950 border-slate-800 text-cyan-400"
                      : "bg-white border-slate-200 text-slate-700"
                  }`}
                >
                  <option value="percentage">Highest Percentage</option>
                  <option value="backlogs">Least Backlogs</option>
                  <option value="usn">USN Sequence</option>
                </select>
              </div>
            </div>

            {/* Student Dossier Cards Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs opacity-70 px-1">
                <p>
                  Displaying{" "}
                  <span className="font-bold text-cyan-400">{filteredStudents.length}</span> students
                  {activeBranch !== "ALL" && (
                    <span> in <strong className="text-white">{activeBranch}</strong></span>
                  )}
                </p>
                {compareUsns.length > 0 && (
                  <p className="text-cyan-400">
                    {compareUsns.length} student{compareUsns.length > 1 ? "s" : ""} selected for compare
                  </p>
                )}
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-48 rounded-3xl animate-pulse ${
                        isObsidian ? "bg-slate-900/60" : "bg-slate-100"
                      }`}
                    />
                  ))}
                </div>
              ) : filteredStudents.length === 0 ? (
                <div
                  className={`text-center py-16 rounded-3xl border ${
                    isObsidian
                      ? "bg-[#090b0e] border-slate-800 text-slate-400"
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                >
                  <p className="text-3xl mb-2">🔍</p>
                  <p className="font-bold text-base text-white">No students located in dossier</p>
                  <p className="text-xs opacity-60 mt-1 max-w-sm mx-auto">
                    No results match &quot;{search}&quot;. Scrape students from the Admin Room to populate records.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {filteredStudents.map((s, idx) => (
                    <StudentCard
                      key={s.usn}
                      student={s}
                      rank={sortBy === "percentage" && !search ? idx + 1 : undefined}
                      isSelectedForCompare={compareUsns.includes(s.usn)}
                      onToggleCompare={() => handleToggleCompare(s.usn)}
                      onOpenDetail={() => handleOpenDetail(s.usn)}
                      isObsidian={isObsidian}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating Comparison Action Bar */}
      {compareUsns.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-md px-4 animate-in slide-in-from-bottom duration-200">
          <div className="bg-slate-950/95 backdrop-blur-md text-white border border-cyan-500/50 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 shadow-cyan-500/20 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <div className="text-xs">
                <span className="font-bold text-cyan-400">{compareUsns.length} / 2</span> Selected
                <p className="text-[10px] opacity-60 truncate max-w-[170px]">
                  {compareUsns.join(" vs ")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  sfx.playMechanicalClick();
                  setCompareUsns([]);
                }}
                className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Clear
              </button>
              <button
                disabled={compareUsns.length < 2}
                onClick={handleOpenCompare}
                className={`px-4 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all ${
                  compareUsns.length === 2
                    ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/30"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
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
          allStudents={students}
          onClose={() => setIsCompareOpen(false)}
        />
      )}

      {/* Student Detail Modal (Strictly Read-Only for Visitors) */}
      {selectedUsn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto font-mono">
          <div
            className={`rounded-3xl border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 ${
              isObsidian
                ? "bg-[#0b0d11] border-slate-800 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Modal Header with Cryptographic Dossier Avatar */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-3">
                <Identicon
                  usn={selectedUsn}
                  percentage={detailStudent?.percentage}
                  totalBacklogs={detailStudent?.total_backlogs}
                  size={44}
                  showFingerprint
                />
                <div>
                  <h2 className="font-bold text-sm sm:text-base leading-tight">
                    {detailStudent?.name || "Student Dossier"}
                  </h2>
                  <p className="text-xs opacity-60">{selectedUsn} • {detailStudent?.branch || "ENG"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playMechanicalClick();
                    handleToggleCompare(selectedUsn);
                  }}
                  className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                    compareUsns.includes(selectedUsn)
                      ? "bg-cyan-500 text-slate-950 border-cyan-400 font-bold"
                      : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                  }`}
                  title="Toggle student in comparison"
                >
                  <IconCompare className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[10px] uppercase">
                    {compareUsns.includes(selectedUsn) ? "Added" : "Compare"}
                  </span>
                </button>
                <button
                  onClick={() => {
                    sfx.playMechanicalClick();
                    handleCloseDetail();
                  }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="space-y-3 py-8">
                  <div className="h-6 bg-slate-900 rounded animate-pulse" />
                  <div className="h-20 bg-slate-900 rounded animate-pulse" />
                  <div className="h-40 bg-slate-900 rounded animate-pulse" />
                </div>
              ) : !detailStudent ? (
                <p className="text-center opacity-60 py-8 text-sm">Failed to decrypt student record.</p>
              ) : (
                <>
                  {/* Summary Metric Tiles */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                    <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
                      <p className="text-[9px] uppercase font-bold opacity-50">Total Marks</p>
                      <p className="text-base sm:text-lg font-black mt-0.5">
                        {detailStudent.total_marks}
                        <span className="text-[10px] font-normal opacity-50 ml-0.5">
                          /{detailStudent.max_marks || 100}
                        </span>
                      </p>
                    </div>
                    <div className="bg-cyan-950/20 border border-cyan-800/40 p-3 rounded-2xl">
                      <p className="text-[9px] uppercase font-bold text-cyan-400">Score</p>
                      <p className="text-base sm:text-lg font-black text-cyan-300 mt-0.5">
                        {detailStudent.percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div
                      className={`p-3 rounded-2xl border ${
                        detailStudent.total_backlogs > 0
                          ? "bg-rose-950/30 border-rose-800/60 text-rose-400"
                          : "bg-emerald-950/30 border-emerald-800/60 text-emerald-400"
                      }`}
                    >
                      <p className="text-[9px] uppercase font-bold opacity-70">Backlogs</p>
                      <p className="text-base sm:text-lg font-black mt-0.5">
                        {detailStudent.total_backlogs}
                      </p>
                    </div>
                  </div>

                  {/* Social Dossier Links */}
                  {(detailStudent.github_url || detailStudent.linkedin_url) && (
                    <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                      <span className="opacity-60 text-[11px]">Associated Profiles:</span>
                      <div className="flex items-center gap-2">
                        {detailStudent.github_url && (
                          <a
                            href={detailStudent.github_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
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
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-950 border border-blue-800 text-blue-300 hover:bg-blue-900 transition-colors"
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
                    <h3 className="font-bold text-xs uppercase tracking-wider text-cyan-400 mb-2.5">
                      Subject Marks Breakdown ({detailStudent.marks?.length || 0})
                    </h3>
                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-900/60 border-b border-slate-800 text-[10px] opacity-60 uppercase">
                            <th className="py-2.5 px-3">Code</th>
                            <th className="py-2.5 px-3">Subject Name</th>
                            <th className="py-2.5 px-2 text-center">Int</th>
                            <th className="py-2.5 px-2 text-center">Ext</th>
                            <th className="py-2.5 px-2 text-center">Total</th>
                            <th className="py-2.5 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {detailStudent.marks && detailStudent.marks.length > 0 ? (
                            detailStudent.marks.map((m, i) => (
                              <tr key={i} className="hover:bg-slate-900/40">
                                <td className="py-2.5 px-3 font-bold text-cyan-400">
                                  {m.subject_code}
                                </td>
                                <td className="py-2.5 px-3 opacity-90 max-w-[200px] truncate">
                                  {m.subject_name || m.subject_code}
                                </td>
                                <td className="py-2.5 px-2 text-center opacity-70">
                                  {m.internal_marks}
                                </td>
                                <td className="py-2.5 px-2 text-center opacity-70">
                                  {m.external_marks}
                                </td>
                                <td className="py-2.5 px-2 text-center font-bold text-white">
                                  {m.total}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <span
                                    className={`inline-block font-bold px-2 py-0.5 rounded text-[9px] ${
                                      m.status === "P"
                                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                        : "bg-rose-950 text-rose-400 border border-rose-800"
                                    }`}
                                  >
                                    {m.status === "P" ? "PASS" : m.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-6 text-center opacity-40">
                                No subject records indexed for this student.
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
    </div>
  );
}
