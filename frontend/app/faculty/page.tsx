"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  fetchFacultyAnalytics,
  fetchStudents,
  downloadFacultyCsv,
  compareStudents,
  getStoredFacultySession,
  clearStoredFacultySession,
  FacultySession,
  BacklogAnalytics,
  Student,
  Mark,
} from "../../lib/api";
import { sfx } from "../../lib/sfx";
import { getSubjectName } from "../../lib/subjects";
import Identicon from "../../components/Identicon";
import { IconSearch } from "../../components/Icons";

const BRANCH_LIST = ["ALL", "CSE", "DS", "CY", "ISE", "AIML", "ECE"];

export default function FacultyPortalPage() {
  const [session, setSession] = useState<FacultySession | null>(null);
  const [analytics, setAnalytics] = useState<BacklogAnalytics | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isObsidian, setIsObsidian] = useState<boolean>(true);

  // Filter & Search States
  const [activeBranch, setActiveBranch] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("percentage");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedRankBranch, setSelectedRankBranch] = useState<string>("ALL");

  // Comparison State
  const [compareUsns, setCompareUsns] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<{
    student1: Student;
    student2: Student;
  } | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const compareTableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check dark mode
    if (typeof window !== "undefined") {
      const isDark =
        document.documentElement.classList.contains("dark") ||
        !document.documentElement.classList.contains("light");
      setIsObsidian(isDark);
    }

    const current = getStoredFacultySession();
    if (!current) {
      setSession(null);
      setLoading(false);
      return;
    }
    setSession(current);

    // 1. Fetch faculty analytics (bypasses privacy filters)
    fetchFacultyAnalytics(current.token)
      .then((data) => setAnalytics(data))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load faculty analytics";
        setError(msg);
      })
      .finally(() => setLoading(false));

    // 2. Fetch ALL students (including hidden/deleted records) with faculty token
    setStudentsLoading(true);
    fetchStudents({ facultyToken: current.token })
      .then((data) => setStudents(data))
      .catch((err) => console.error("Failed to load students:", err))
      .finally(() => setStudentsLoading(false));
  }, []);

  const handleSignOut = () => {
    sfx.playMechanicalClick();
    clearStoredFacultySession();
    setSession(null);
    window.location.href = "/";
  };

  const handleDownloadCsv = async () => {
    if (!session) return;
    sfx.playMechanicalClick();
    setDownloadingCsv(true);
    setDownloadSuccess(false);
    setError(null);
    try {
      await downloadFacultyCsv(session.token);
      setDownloadSuccess(true);
      sfx.playSonar();
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "CSV download failed";
      setError(msg);
    } finally {
      setDownloadingCsv(false);
    }
  };

  // Toggle compare selection for a student
  const handleToggleCompare = async (usn: string) => {
    sfx.playMechanicalClick();
    const cleanUsn = usn.trim().toUpperCase();

    let nextCompare: string[];
    if (compareUsns.includes(cleanUsn)) {
      nextCompare = compareUsns.filter((u) => u !== cleanUsn);
      setCompareUsns(nextCompare);
      if (nextCompare.length < 2) {
        setCompareResult(null);
      }
      return;
    } else {
      if (compareUsns.length >= 2) {
        // Replace second student
        nextCompare = [compareUsns[0], cleanUsn];
      } else {
        nextCompare = [...compareUsns, cleanUsn];
      }
      setCompareUsns(nextCompare);
    }

    if (nextCompare.length === 2 && session) {
      setComparing(true);
      setCompareError(null);
      try {
        const res = await compareStudents(nextCompare[0], nextCompare[1]);
        if (res.student1 && res.student2) {
          setCompareResult({ student1: res.student1, student2: res.student2 });
          sfx.playSonar();
          setTimeout(() => {
            compareTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 100);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Comparison failed";
        setCompareError(msg);
      } finally {
        setComparing(false);
      }
    }
  };

  const handleClearCompare = () => {
    sfx.playMechanicalClick();
    setCompareUsns([]);
    setCompareResult(null);
    setCompareError(null);
  };

  const handleSwapCompare = async () => {
    if (compareUsns.length !== 2 || !compareResult) return;
    sfx.playMechanicalClick();
    const swappedUsns = [compareUsns[1], compareUsns[0]];
    setCompareUsns(swappedUsns);
    setCompareResult({
      student1: compareResult.student2,
      student2: compareResult.student1,
    });
  };

  // Filtered & Sorted Student List (Includes all hidden / deleted students)
  const filteredStudents = useMemo(() => {
    let result = [...students];

    // Branch filter
    if (activeBranch !== "ALL") {
      result = result.filter((s) => s.branch?.toUpperCase() === activeBranch.toUpperCase());
    }

    // Search filter (Name or USN)
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.usn && s.usn.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortBy === "usn") {
      result.sort((a, b) => a.usn.localeCompare(b.usn));
    } else if (sortBy === "total_marks") {
      result.sort((a, b) => (b.total_marks || 0) - (a.total_marks || 0));
    } else if (sortBy === "backlogs") {
      result.sort((a, b) => (a.total_backlogs || 0) - (b.total_backlogs || 0));
    } else {
      result.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    }

    return result;
  }, [students, activeBranch, search, sortBy]);

  // Branch student counts for tabs
  const branchCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: students.length };
    BRANCH_LIST.forEach((b) => {
      if (b !== "ALL") {
        counts[b] = students.filter((s) => s.branch?.toUpperCase() === b).length;
      }
    });
    return counts;
  }, [students]);

  // Unified Comparison Maps & Subjects
  const s1MarksMap = useMemo(() => {
    const map = new Map<string, Mark>();
    (compareResult?.student1?.marks || []).forEach((m) => map.set(m.subject_code, m));
    return map;
  }, [compareResult?.student1]);

  const s2MarksMap = useMemo(() => {
    const map = new Map<string, Mark>();
    (compareResult?.student2?.marks || []).forEach((m) => map.set(m.subject_code, m));
    return map;
  }, [compareResult?.student2]);

  // Sort subjects: Sem 1 at top, then Sem 2, then Sem 3... within same semester by subject code
  const allSubjectCodes = useMemo(() => {
    const s1Map = new Map<string, Mark>();
    (compareResult?.student1?.marks || []).forEach((m) => s1Map.set(m.subject_code.toUpperCase(), m));
    const s2Map = new Map<string, Mark>();
    (compareResult?.student2?.marks || []).forEach((m) => s2Map.set(m.subject_code.toUpperCase(), m));

    const set = new Set<string>();
    (compareResult?.student1?.marks || []).forEach((m) => set.add(m.subject_code.toUpperCase()));
    (compareResult?.student2?.marks || []).forEach((m) => set.add(m.subject_code.toUpperCase()));

    return Array.from(set).sort((codeA, codeB) => {
      const mA = s1Map.get(codeA) || s2Map.get(codeA);
      const mB = s1Map.get(codeB) || s2Map.get(codeB);
      const semA = parseInt(String(mA?.semester || "1").replace(/\D/g, ""), 10) || 1;
      const semB = parseInt(String(mB?.semester || "1").replace(/\D/g, ""), 10) || 1;
      if (semA !== semB) return semA - semB;
      return codeA.localeCompare(codeB);
    });
  }, [compareResult]);

  // Delta stats
  const pctDiff = compareResult
    ? compareResult.student1.percentage - compareResult.student2.percentage
    : 0;
  const marksDiff = compareResult
    ? (compareResult.student1.total_marks || 0) - (compareResult.student2.total_marks || 0)
    : 0;

  // Active deadliest subjects list for failure rankings
  const activeSubjectList = useMemo(() => {
    if (!analytics) return [];
    if (selectedRankBranch === "ALL") {
      return analytics.overall_deadliest_subjects;
    }
    const branchData = analytics.branches.find((b) => b.branch === selectedRankBranch);
    return branchData ? branchData.top_failed_subjects : [];
  }, [analytics, selectedRankBranch]);

  // If not authenticated as faculty, show clean redirect prompt
  if (!loading && !session) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-white font-sans">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/90 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mx-auto flex items-center justify-center text-xl font-bold">
            🔒
          </div>
          <h1 className="text-xl font-bold tracking-tight">Faculty Authentication Required</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            The Faculty Portal provides elevated access to unredacted academic records, cross-branch analytics, and CSV exports. Please sign in via the Faculty tab on the home portal.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors"
            >
              ← Return to Main Portal &amp; Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen font-sans transition-colors duration-200 ${
        isObsidian ? "bg-[#07090e] text-slate-100" : "bg-[#f8fafc] text-slate-900"
      }`}
    >
      {/* Sleek Faculty Header */}
      <header
        className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors ${
          isObsidian ? "bg-[#07090e]/85 border-slate-800/80" : "bg-white/85 border-slate-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Brand & Portal Badge */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <Link
              href="/"
              className="font-black text-sm sm:text-base tracking-tight hover:opacity-80 transition-opacity flex items-center gap-1 shrink-0"
            >
              <span className="hidden sm:inline">VTU WhatNow</span>
              <span className="sm:hidden font-extrabold">WhatNow</span>
            </Link>
            <span
              className={`hidden md:inline-flex text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border whitespace-nowrap ${
                isObsidian
                  ? "bg-cyan-950/40 text-cyan-300 border-cyan-800/50"
                  : "bg-cyan-50 text-cyan-700 border-cyan-200"
              }`}
            >
              Faculty Portal • 100% Unredacted
            </span>
            <span
              className={`md:hidden text-[10px] font-bold px-1.5 py-0.5 rounded-md border whitespace-nowrap shrink-0 ${
                isObsidian
                  ? "bg-cyan-950/40 text-cyan-300 border-cyan-800/50"
                  : "bg-cyan-50 text-cyan-700 border-cyan-200"
              }`}
            >
              Faculty
            </span>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Compact Native Download CSV Button */}
            <button
              onClick={handleDownloadCsv}
              disabled={downloadingCsv}
              title="Download unredacted student marksheet CSV"
              className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0 ${
                downloadSuccess
                  ? "bg-emerald-600 text-white"
                  : isObsidian
                  ? "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30"
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
              }`}
            >
              <span className="text-xs sm:text-sm">{downloadingCsv ? "⏳" : downloadSuccess ? "✓" : "📥"}</span>
              <span className="font-bold hidden sm:inline">
                {downloadingCsv ? "Exporting..." : downloadSuccess ? "Downloaded" : "Export CSV"}
              </span>
              <span className="font-bold sm:hidden">
                {downloadingCsv ? "..." : downloadSuccess ? "✓" : "CSV"}
              </span>
              <span className="text-[10px] opacity-70 font-mono hidden md:inline">
                ({students.length})
              </span>
            </button>

            {/* Dark / Light Toggle */}
            <button
              onClick={() => {
                const nextDark = !isObsidian;
                setIsObsidian(nextDark);
                if (typeof document !== "undefined") {
                  document.documentElement.classList.toggle("dark", nextDark);
                  document.documentElement.classList.toggle("light", !nextDark);
                }
              }}
              title="Toggle Theme"
              className={`p-2 rounded-xl border text-xs transition-all cursor-pointer ${
                isObsidian
                  ? "bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {isObsidian ? "🌙" : "☀️"}
            </button>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6 sm:space-y-8">
        {/* Error notification banner if any */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="opacity-70 hover:opacity-100 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ATTACHED SIDE-BY-SIDE COMPARISON TABLE (Unified Synchronous Scroll) */}
        {/* ========================================================================= */}
        {compareResult && (
          <section
            ref={compareTableRef}
            className={`rounded-3xl p-4 sm:p-6 border transition-all scroll-mt-20 ${
              isObsidian
                ? "bg-[#0b0e14] border-cyan-800/40 text-white shadow-xl shadow-cyan-950/20"
                : "bg-white border-cyan-200 text-slate-900 shadow-md"
            }`}
          >
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                    Side-by-Side Comparison Matrix
                  </span>
                </div>
                <h3 className="text-base sm:text-xl font-bold tracking-tight">
                  {compareResult.student1.name || compareResult.student1.usn} vs{" "}
                  {compareResult.student2.name || compareResult.student2.usn}
                </h3>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={handleSwapCompare}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    isObsidian
                      ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                      : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  ⇄ Swap
                </button>
                <button
                  onClick={handleClearCompare}
                  className="px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-all cursor-pointer"
                >
                  ✕ Clear Comparison
                </button>
              </div>
            </div>

            {/* Student Comparison Header Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 my-4">
              {/* Student A Card */}
              <div
                className={`p-3.5 sm:p-4 rounded-2xl border ${
                  isObsidian ? "bg-cyan-950/20 border-cyan-800/40" : "bg-cyan-50/60 border-cyan-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Identicon
                    usn={compareResult.student1.usn}
                    percentage={compareResult.student1.percentage}
                    totalBacklogs={compareResult.student1.total_backlogs}
                    customPixelArt={compareResult.student1.avatar_pixel_art}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                        Student A
                      </span>
                      {compareResult.student1.is_hidden && (
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          🔒 Hidden
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm sm:text-base mt-1 truncate">
                      {compareResult.student1.name || compareResult.student1.usn}
                    </h4>
                    <p className="font-mono text-[11px] opacity-70">
                      {compareResult.student1.usn} • {compareResult.student1.branch}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg sm:text-xl font-black font-mono text-cyan-400">
                      {compareResult.student1.percentage.toFixed(1)}%
                    </span>
                    <p className="text-[10px] opacity-60 font-mono">
                      {compareResult.student1.total_marks}/{compareResult.student1.max_marks} pts
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/40 flex items-center justify-between text-xs">
                  <span className="opacity-70 text-[11px]">Backlog Status:</span>
                  <span
                    className={`font-bold font-mono text-[11px] px-2 py-0.5 rounded-full ${
                      compareResult.student1.total_backlogs > 0
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {compareResult.student1.total_backlogs > 0
                      ? `${compareResult.student1.total_backlogs} Pending`
                      : "0 (All Clear)"}
                  </span>
                </div>
              </div>

              {/* Student B Card */}
              <div
                className={`p-3.5 sm:p-4 rounded-2xl border ${
                  isObsidian ? "bg-indigo-950/20 border-indigo-800/40" : "bg-indigo-50/60 border-indigo-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Identicon
                    usn={compareResult.student2.usn}
                    percentage={compareResult.student2.percentage}
                    totalBacklogs={compareResult.student2.total_backlogs}
                    customPixelArt={compareResult.student2.avatar_pixel_art}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                        Student B
                      </span>
                      {compareResult.student2.is_hidden && (
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          🔒 Hidden
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm sm:text-base mt-1 truncate">
                      {compareResult.student2.name || compareResult.student2.usn}
                    </h4>
                    <p className="font-mono text-[11px] opacity-70">
                      {compareResult.student2.usn} • {compareResult.student2.branch}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg sm:text-xl font-black font-mono text-indigo-400">
                      {compareResult.student2.percentage.toFixed(1)}%
                    </span>
                    <p className="text-[10px] opacity-60 font-mono">
                      {compareResult.student2.total_marks}/{compareResult.student2.max_marks} pts
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/40 flex items-center justify-between text-xs">
                  <span className="opacity-70 text-[11px]">Backlog Status:</span>
                  <span
                    className={`font-bold font-mono text-[11px] px-2 py-0.5 rounded-full ${
                      compareResult.student2.total_backlogs > 0
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {compareResult.student2.total_backlogs > 0
                      ? `${compareResult.student2.total_backlogs} Pending`
                      : "0 (All Clear)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Lead Strip */}
            <div
              className={`p-2.5 sm:p-3 rounded-xl border flex flex-wrap items-center justify-around gap-2 text-center text-xs mb-4 ${
                isObsidian ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div>
                <span className="opacity-50 text-[9px] font-bold uppercase tracking-wider block">
                  Percentage Lead
                </span>
                <span className="font-mono font-bold text-xs sm:text-sm">
                  {pctDiff > 0 ? (
                    <span className="text-cyan-400">
                      {compareResult.student1.name || "Student A"} ahead by +{pctDiff.toFixed(1)}%
                    </span>
                  ) : pctDiff < 0 ? (
                    <span className="text-indigo-400">
                      {compareResult.student2.name || "Student B"} ahead by +{Math.abs(pctDiff).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="opacity-60">Equal Percentage</span>
                  )}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-300 dark:bg-slate-800 hidden sm:block" />
              <div>
                <span className="opacity-50 text-[9px] font-bold uppercase tracking-wider block">
                  Total Marks Lead
                </span>
                <span className="font-mono font-bold text-xs sm:text-sm">
                  {marksDiff > 0 ? (
                    <span className="text-cyan-400">+{marksDiff} Marks (Student A)</span>
                  ) : marksDiff < 0 ? (
                    <span className="text-indigo-400">+{Math.abs(marksDiff)} Marks (Student B)</span>
                  ) : (
                    <span className="opacity-60">Equal Total Marks</span>
                  )}
                </span>
              </div>
            </div>

            {/* Unified Synchronized Table: Both Students Scroll Together */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs sm:text-sm">
                Subject-by-Subject Breakdown ({allSubjectCodes.length} Subjects)
              </h4>

              {allSubjectCodes.length === 0 ? (
                <div className="p-6 text-center text-xs opacity-60 border rounded-2xl">
                  No subject records found for these students.
                </div>
              ) : (
                <div
                  className={`border rounded-2xl overflow-hidden divide-y ${
                    isObsidian ? "border-slate-800 divide-slate-800/80" : "border-slate-200 divide-slate-100"
                  }`}
                >
                  {/* Table Header (Desktop) */}
                  <div
                    className={`hidden sm:grid grid-cols-12 gap-2 p-3 text-[10px] font-bold uppercase tracking-wider ${
                      isObsidian ? "bg-slate-900/80 text-slate-400" : "bg-slate-100/70 text-slate-500"
                    }`}
                  >
                    <div className="col-span-5">Subject</div>
                    <div className="col-span-3 text-center text-cyan-400">
                      {compareResult.student1.name || "Student A"} (A)
                    </div>
                    <div className="col-span-3 text-center text-indigo-400">
                      {compareResult.student2.name || "Student B"} (B)
                    </div>
                    <div className="col-span-1 text-right">Lead</div>
                  </div>

                  {/* Scrollable Synchronized Subject Rows */}
                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/70">
                    {allSubjectCodes.map((code) => {
                      const m1 = s1MarksMap.get(code);
                      const m2 = s2MarksMap.get(code);
                      const rawName = m1?.subject_name || m2?.subject_name;
                      const subjectName = getSubjectName(code, rawName);
                      const score1 = m1 ? m1.total : null;
                      const score2 = m2 ? m2.total : null;
                      const lead = score1 !== null && score2 !== null ? score1 - score2 : null;

                      return (
                        <div
                          key={code}
                          className={`p-3 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center transition-colors ${
                            isObsidian ? "hover:bg-slate-900/40" : "hover:bg-slate-50/60"
                          }`}
                        >
                          {/* Subject Code & Name */}
                          <div className="col-span-5 mb-2 sm:mb-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold">{code}</span>
                              {(m1?.semester || m2?.semester) && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded border ${
                                    isObsidian
                                      ? "bg-slate-800 text-slate-400 border-slate-700"
                                      : "bg-slate-100 text-slate-500 border-slate-200"
                                  }`}
                                >
                                  Sem {m1?.semester || m2?.semester}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] opacity-75 line-clamp-1 mt-0.5 font-medium">
                              {subjectName || `Course ${code}`}
                            </p>
                          </div>

                          {/* Student A Marks */}
                          <div
                            className={`col-span-3 flex sm:flex-col items-center justify-between sm:justify-center p-2 sm:p-0 rounded-xl mb-1 sm:mb-0 ${
                              isObsidian ? "bg-cyan-950/20 sm:bg-transparent" : "bg-cyan-50/50 sm:bg-transparent"
                            }`}
                          >
                            <span className="text-[10px] font-bold text-cyan-400 sm:hidden">Student A:</span>
                            {m1 ? (
                              <div className="text-center font-mono tabular-nums">
                                <span className="font-bold text-xs sm:text-sm">{m1.total}</span>
                                <span className="text-[10px] opacity-50 ml-1">
                                  (Int: {m1.internal_marks}, Ext: {m1.external_marks})
                                </span>
                                <span
                                  className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    m1.status === "P"
                                      ? isObsidian
                                        ? "text-emerald-400 bg-emerald-950/40"
                                        : "text-emerald-700 bg-emerald-50"
                                      : isObsidian
                                      ? "text-rose-400 bg-rose-950/40"
                                      : "text-rose-700 bg-rose-50"
                                  }`}
                                >
                                  {m1.status}
                                </span>
                              </div>
                            ) : (
                              <span className="opacity-40 text-xs italic">—</span>
                            )}
                          </div>

                          {/* Student B Marks */}
                          <div
                            className={`col-span-3 flex sm:flex-col items-center justify-between sm:justify-center p-2 sm:p-0 rounded-xl mb-1 sm:mb-0 ${
                              isObsidian
                                ? "bg-indigo-950/20 sm:bg-transparent"
                                : "bg-indigo-50/50 sm:bg-transparent"
                            }`}
                          >
                            <span className="text-[10px] font-bold text-indigo-400 sm:hidden">Student B:</span>
                            {m2 ? (
                              <div className="text-center font-mono tabular-nums">
                                <span className="font-bold text-xs sm:text-sm">{m2.total}</span>
                                <span className="text-[10px] opacity-50 ml-1">
                                  (Int: {m2.internal_marks}, Ext: {m2.external_marks})
                                </span>
                                <span
                                  className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    m2.status === "P"
                                      ? isObsidian
                                        ? "text-emerald-400 bg-emerald-950/40"
                                        : "text-emerald-700 bg-emerald-50"
                                      : isObsidian
                                      ? "text-rose-400 bg-rose-950/40"
                                      : "text-rose-700 bg-rose-50"
                                  }`}
                                >
                                  {m2.status}
                                </span>
                              </div>
                            ) : (
                              <span className="opacity-40 text-xs italic">—</span>
                            )}
                          </div>

                          {/* Lead Indicator */}
                          <div className="col-span-1 text-right flex items-center justify-end font-mono tabular-nums">
                            {lead !== null ? (
                              lead > 0 ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                                  +{lead} A
                                </span>
                              ) : lead < 0 ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                                  +{Math.abs(lead)} B
                                </span>
                              ) : (
                                <span className="text-[10px] opacity-40 font-bold">Tie</span>
                              )
                            ) : (
                              <span className="text-[10px] opacity-30">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* STUDENT EXPLORER & COMPARISON DIRECTORY (Includes All Hidden Records) */}
        {/* ========================================================================= */}
        <section
          className={`rounded-3xl p-4 sm:p-6 border transition-all ${
            isObsidian ? "bg-[#0b0e14] border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900 shadow-sm"
          }`}
        >
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  Campus Directory &amp; Comparison Selector
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold mt-1 tracking-tight">
                Search Students &amp; Compare Marksheets
              </h3>
              <p className="text-xs opacity-60 mt-0.5 max-w-xl">
                Faculty mode reveals 100% of student records including hidden/deleted profiles. Click &quot;Compare&quot; on any two students to compare unredacted marks.
              </p>
            </div>

            {/* Active Compare Pill / Status */}
            <div
              className={`flex items-center gap-3 px-3.5 py-2 rounded-2xl border text-xs self-start md:self-auto ${
                compareUsns.length > 0
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                  : isObsidian
                  ? "bg-slate-900/60 border-slate-800 text-slate-400"
                  : "bg-slate-100 border-slate-200 text-slate-600"
              }`}
            >
              <span className="font-bold">
                {compareUsns.length === 0
                  ? "Select any student below to compare"
                  : compareUsns.length === 1
                  ? `Selected 1/2 (${compareUsns[0]})`
                  : `Comparing ${compareUsns[0]} & ${compareUsns[1]}`}
              </span>
              {compareUsns.length > 0 && (
                <button
                  onClick={handleClearCompare}
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300 underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Department Tabs (Same like Student Portal) */}
          <div className="py-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 min-w-max">
              {BRANCH_LIST.map((branch) => {
                const count = branchCounts[branch] || 0;
                const isActive = activeBranch === branch;
                return (
                  <button
                    key={branch}
                    onClick={() => {
                      sfx.playMechanicalClick();
                      setActiveBranch(branch);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? "bg-cyan-500 text-slate-950 shadow-sm"
                        : isObsidian
                        ? "bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>{branch}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive ? "bg-slate-950/20 text-slate-950" : "bg-white/10 opacity-70"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search, Sort, and View Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4">
            {/* Search input */}
            <div className="relative flex-1 max-w-md">
              <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student name or USN (e.g. 1RM25CS..., 1RM25CD...)"
                className={`w-full pl-9 pr-4 py-2 text-xs font-mono rounded-xl border outline-none transition-colors ${
                  isObsidian
                    ? "bg-slate-900 border-slate-800 text-white placeholder-slate-500 focus:border-cyan-400"
                    : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500"
                }`}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort & View Toggle */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`px-3 py-2 text-xs font-bold rounded-xl border outline-none transition-colors ${
                  isObsidian
                    ? "bg-slate-900 border-slate-800 text-white"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                }`}
              >
                <option value="percentage">Highest Percentage</option>
                <option value="total_marks">Total Marks</option>
                <option value="backlogs">Lowest Backlogs</option>
                <option value="usn">USN Sequence</option>
              </select>

              <div
                className={`p-0.5 rounded-xl border flex items-center ${
                  isObsidian ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200"
                }`}
              >
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    viewMode === "grid"
                      ? "bg-cyan-500 text-slate-950"
                      : "opacity-60 hover:opacity-100 text-slate-400"
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    viewMode === "table"
                      ? "bg-cyan-500 text-slate-950"
                      : "opacity-60 hover:opacity-100 text-slate-400"
                  }`}
                >
                  Table
                </button>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between text-xs opacity-60 pb-3">
            <span>
              Showing <strong>{filteredStudents.length}</strong> students{" "}
              {activeBranch !== "ALL" && `in ${activeBranch}`}
              {students.some((s) => s.is_hidden) && (
                <span className="ml-1 text-purple-400">
                  ({students.filter((s) => s.is_hidden).length} hidden records visible to faculty)
                </span>
              )}
            </span>
          </div>

          {/* Student Grid / Table View */}
          {studentsLoading ? (
            <div className="py-12 text-center text-xs opacity-60">
              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Loading complete campus directory...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-xs opacity-60 border border-dashed rounded-2xl">
              No students match &quot;{search}&quot;.
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredStudents.map((st) => {
                const isSelected = compareUsns.includes(st.usn);
                return (
                  <div
                    key={st.usn}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? "border-cyan-400 bg-cyan-950/20 shadow-md shadow-cyan-950/30"
                        : isObsidian
                        ? "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                        : "bg-slate-50/70 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Identicon
                        usn={st.usn}
                        percentage={st.percentage}
                        totalBacklogs={st.total_backlogs}
                        customPixelArt={st.avatar_pixel_art}
                        size={38}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold opacity-60 font-mono">
                            {st.branch || "ENG"}
                          </span>
                          {st.is_hidden && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              🔒 Hidden
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-sm truncate mt-0.5">{st.name || st.usn}</h4>
                        <p className="font-mono text-[11px] opacity-60 truncate">{st.usn}</p>
                      </div>

                      {/* Compare Button */}
                      <button
                        onClick={() => handleToggleCompare(st.usn)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                          isSelected
                            ? "bg-cyan-500 text-slate-950 shadow-xs"
                            : isObsidian
                            ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                            : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs"
                        }`}
                      >
                        {isSelected ? "✓ Compare" : "+ Compare"}
                      </button>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] opacity-50 block uppercase">Marks</span>
                        <span className="font-mono font-bold text-cyan-400">
                          {st.percentage.toFixed(1)}%
                        </span>
                        <span className="text-[10px] opacity-50 ml-1 font-mono">
                          ({st.total_marks} pts)
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] opacity-50 block uppercase">Backlogs</span>
                        <span
                          className={`font-mono font-bold text-[11px] ${
                            st.total_backlogs > 0 ? "text-rose-400" : "text-emerald-400"
                          }`}
                        >
                          {st.total_backlogs > 0 ? `${st.total_backlogs} Pending` : "0 (Clear)"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div
              className={`border rounded-2xl overflow-hidden ${
                isObsidian ? "border-slate-800" : "border-slate-200"
              }`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead
                    className={`text-[10px] uppercase font-bold tracking-wider ${
                      isObsidian ? "bg-slate-900 text-slate-400" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <tr>
                      <th className="p-3">Student</th>
                      <th className="p-3">USN</th>
                      <th className="p-3">Branch</th>
                      <th className="p-3 text-right">Percentage</th>
                      <th className="p-3 text-right">Total Marks</th>
                      <th className="p-3 text-center">Backlogs</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                    {filteredStudents.map((st) => {
                      const isSelected = compareUsns.includes(st.usn);
                      return (
                        <tr
                          key={st.usn}
                          className={`hover:bg-slate-500/5 transition-colors ${
                            isSelected ? "bg-cyan-500/10" : ""
                          }`}
                        >
                          <td className="p-3 font-sans">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{st.name || st.usn}</span>
                              {st.is_hidden && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-sans">
                                  🔒 Hidden
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">{st.usn}</td>
                          <td className="p-3 font-sans">{st.branch}</td>
                          <td className="p-3 text-right font-bold text-cyan-400">
                            {st.percentage.toFixed(1)}%
                          </td>
                          <td className="p-3 text-right opacity-80">{st.total_marks}</td>
                          <td className="p-3 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                st.total_backlogs > 0
                                  ? "bg-rose-500/20 text-rose-300"
                                  : "bg-emerald-500/20 text-emerald-300"
                              }`}
                            >
                              {st.total_backlogs > 0 ? `${st.total_backlogs} Pending` : "Clear"}
                            </span>
                          </td>
                          <td className="p-3 text-center font-sans">
                            <button
                              onClick={() => handleToggleCompare(st.usn)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-cyan-500 text-slate-950"
                                  : isObsidian
                                  ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                              }`}
                            >
                              {isSelected ? "✓ Selected" : "Compare"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* SUBJECT ANALYTICS & BACKLOG STATISTICS (Branch Summary & Rankings) */}
        {/* ========================================================================= */}
        <section
          className={`rounded-3xl p-4 sm:p-6 border transition-all ${
            isObsidian ? "bg-[#0b0e14] border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900 shadow-sm"
          }`}
        >
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  Academic Performance Intelligence
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold mt-1 tracking-tight">
                Subject Analytics &amp; Backlog Statistics
              </h3>
              <p className="text-xs opacity-60 mt-0.5 max-w-xl">
                Branch-wise backlog distributions and subjects with the highest fail rates across semester exams (100% student coverage).
              </p>
            </div>

            {/* Quick Metrics */}
            <div
              className={`flex items-center gap-4 p-2.5 rounded-2xl border self-start md:self-auto ${
                isObsidian ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="text-center px-2">
                <span className="block text-lg sm:text-xl font-black text-rose-500 font-mono">
                  {analytics ? analytics.total_failed_papers : "..."}
                </span>
                <span className="text-[9px] uppercase font-semibold opacity-60">Pending Papers</span>
              </div>
              <div className="w-px h-6 bg-slate-300 dark:bg-slate-800" />
              <div className="text-center px-2">
                <span className="block text-lg sm:text-xl font-black text-emerald-500 font-mono">
                  {analytics && analytics.branches.length > 0
                    ? `${(
                        (analytics.branches.reduce((acc, b) => acc + b.clean_pass_students, 0) /
                          Math.max(
                            1,
                            analytics.branches.reduce((acc, b) => acc + b.total_students, 0)
                          )) *
                        100
                      ).toFixed(1)}%`
                    : "..."}
                </span>
                <span className="text-[9px] uppercase font-semibold opacity-60">Campus Pass Rate</span>
              </div>
            </div>
          </div>

          {/* Subject Failure Rankings with Branch Filters */}
          <div className="pt-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-rose-400">
                  Subject Failure Rankings
                </h4>
                <p className="text-xs opacity-60">Subjects with the highest number of failed papers</p>
              </div>

              {/* Branch Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {BRANCH_LIST.map((b) => (
                  <button
                    key={b}
                    onClick={() => {
                      sfx.playMechanicalClick();
                      setSelectedRankBranch(b);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedRankBranch === b
                        ? "bg-rose-500 text-white"
                        : isObsidian
                        ? "bg-slate-900 text-slate-400 hover:bg-slate-800"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Rankings List */}
            <div
              className={`border rounded-2xl overflow-hidden divide-y ${
                isObsidian ? "border-slate-800 divide-slate-800/80" : "border-slate-200 divide-slate-100"
              }`}
            >
              {activeSubjectList.length === 0 ? (
                <div className="p-6 text-center text-xs opacity-60">
                  No failed papers recorded for {selectedRankBranch}.
                </div>
              ) : (
                activeSubjectList.map((subj, idx) => (
                  <div
                    key={`${subj.subject_code}-${subj.branch}`}
                    className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-500/5 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          idx === 0
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : idx === 1
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs">{subj.subject_code}</span>
                          {subj.branch && subj.branch !== "ALL" && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-500/10 opacity-70">
                              {subj.branch}
                            </span>
                          )}
                        </div>
                        <p className="text-xs opacity-70 truncate max-w-sm sm:max-w-md">
                          {getSubjectName(subj.subject_code, subj.subject_name)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto shrink-0">
                      <div className="w-28 sm:w-36">
                        <div className="flex justify-between text-[9px] mb-1 font-semibold font-mono">
                          <span className="text-rose-400">{subj.fail_rate}% Fail</span>
                          <span className="opacity-50">{subj.fail_count} Fails</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              subj.fail_rate >= 40
                                ? "bg-rose-500"
                                : subj.fail_rate >= 20
                                ? "bg-amber-500"
                                : "bg-blue-500"
                            }`}
                            style={{ width: `${Math.min(subj.fail_rate, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-right min-w-[65px] font-mono">
                        <span className="block text-xs font-bold">
                          {subj.pass_count} / {subj.total_students}
                        </span>
                        <span className="text-[9px] opacity-50 uppercase tracking-wider font-sans">
                          Passed
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
