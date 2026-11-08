"use client";

import React, { useState, useEffect, useMemo } from "react";
import BranchTabs from "../components/BranchTabs";
import StudentCard from "../components/StudentCard";
import Leaderboard from "../components/Leaderboard";
import CompareModal from "../components/CompareModal";
import CryptographicAvatar from "../components/CryptographicAvatar";
import NetworkTopology from "../components/NetworkTopology";
import { sfx } from "../lib/sfx";
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

  // View Mode: Grid Dossiers vs Interactive Radar Network Topology
  const [viewMode, setViewMode] = useState<"grid" | "topology">("grid");

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
      if (data && data.percentage >= 80) {
        sfx.playSonar();
      } else {
        sfx.playClick();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    sfx.playClick();
    setSelectedUsn(null);
    setDetailStudent(null);
  };

  // Compare toggle
  const handleToggleCompare = (usn: string) => {
    sfx.playClick();
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
    sfx.playSonar();
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
    <div className="space-y-6 max-w-6xl mx-auto font-mono">
      {/* Backend Offline Banner */}
      {backendOnline === false && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <div>
            <p className="font-bold text-xs sm:text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              API BACKEND OFFLINE
            </p>
            <p className="text-[11px] text-amber-400/80 mt-0.5">
              Verify your Render web service is live to stream real-time results and scrape data.
            </p>
          </div>
          <button
            onClick={() => {
              sfx.playClick();
              checkBackendHealth().then((isUp) => {
                setBackendOnline(isUp);
                if (isUp) window.location.reload();
              });
            }}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md whitespace-nowrap"
          >
            RETRY TELEMETRY
          </button>
        </div>
      )}

      {/* Cyber Obsidian Header Banner */}
      <div className="relative overflow-hidden bg-[#0c1015]/95 border border-cyan-500/30 rounded-3xl p-5 sm:p-7 shadow-[0_0_35px_rgba(0,240,255,0.06)]">
        {/* Subtle holographic line overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-amber-500/5 pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 bg-cyan-950/80 border border-cyan-800/80 px-2.5 py-0.5 rounded">
                OBSIDIAN SURVEILLANCE // TERMINAL
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-bold tracking-wider">FEED ACTIVE</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
              Campus Intelligence &amp; Performance Matrix
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-xl">
              Inspect student dossiers, cryptographically verified marks breakdowns, branch node graphs, and head-to-head performance differentials.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 sm:gap-6 bg-[#08090a]/90 rounded-2xl p-3 sm:p-4 border border-cyan-500/25 self-start md:self-auto shadow-inner">
            <div className="text-center px-2">
              <p className="text-xl sm:text-2xl font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]">
                {students.length}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                DOSSIERS
              </p>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="text-center px-2">
              <p className="text-xl sm:text-2xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                {students.filter((s) => s.total_backlogs === 0).length}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                ALL CLEAR
              </p>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="text-center px-2">
              <p className="text-xl sm:text-2xl font-black text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]">
                {students.reduce((sum, s) => sum + s.total_backlogs, 0)}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                BACKLOGS
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Branch Tabs Selection */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-bold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            BRANCH TELEMETRY CLUSTERS
          </h2>
          <span className="text-[11px] text-slate-500">SELECT CLUSTER TO FILTER</span>
        </div>
        <BranchTabs
          branches={ALL_BRANCHES}
          activeBranch={activeBranch}
          onSelect={setActiveBranch}
          branchStats={branchStats}
        />
      </section>

      {/* Top Performers Podium */}
      <Leaderboard
        toppers={toppers}
        branch={activeBranch}
        onSelectStudent={(s) => handleOpenDetail(s.usn)}
      />

      {/* View Switcher + Search & Sort Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#0c1015]/90 p-3 sm:p-4 rounded-2xl border border-slate-800/90 shadow-sm">
        {/* View Mode Switcher Button Group */}
        <div className="flex items-center gap-1.5 p-1 bg-[#08090a] rounded-xl border border-slate-800 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              sfx.playClick();
              setViewMode("grid");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === "grid"
                ? "bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🗂️</span>
            <span>GRID DOSSIERS</span>
          </button>
          <button
            type="button"
            onClick={() => {
              sfx.playSonar();
              setViewMode("topology");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === "topology"
                ? "bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🌐</span>
            <span>NETWORK RADAR</span>
          </button>
        </div>

        {/* Search input with sound feedback */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              sfx.playTick();
              setSearch(e.target.value);
            }}
            placeholder="Search USN or Name (e.g. 1RM25CD...)"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400 bg-slate-950/80 text-slate-200 placeholder:text-slate-600"
          />
          <span className="absolute left-3 top-2.5 text-slate-500">
            <IconSearch className="w-4 h-4" />
          </span>
          {search && (
            <button
              onClick={() => {
                sfx.playClick();
                setSearch("");
              }}
              className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 p-1"
            >
              <IconClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort drop down */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            SORT:
          </span>
          <select
            value={sortBy}
            onChange={(e) => {
              sfx.playClick();
              setSortBy(e.target.value as any);
            }}
            className="bg-slate-950 border border-slate-800 text-xs font-bold rounded-xl px-3 py-2 text-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
          >
            <option value="percentage">Highest Score (%)</option>
            <option value="backlogs">Fewest Backlogs</option>
            <option value="usn">USN (Ascending)</option>
          </select>
        </div>
      </div>

      {/* Main View Area: Either Network Radar Topology or Grid Dossiers */}
      {viewMode === "topology" ? (
        <section className="animate-in fade-in zoom-in-95 duration-200">
          <NetworkTopology
            students={filteredStudents}
            activeBranch={activeBranch}
            onSelectStudent={(s) => handleOpenDetail(s.usn)}
          />
        </section>
      ) : (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <span>{activeBranch === "ALL" ? "ACTIVE STUDENT RECORDS" : `${activeBranch} DOSSIERS`}</span>
              <span className="text-xs text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                {filteredStudents.length} FOUND
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-44 bg-[#0c1015]/60 border border-slate-800 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="bg-[#0c1015]/90 rounded-3xl border border-slate-800 p-8 sm:p-12 text-center">
              <h3 className="font-bold text-slate-300 text-base">NO DOSSIER RECORDS FOUND</h3>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-sm mx-auto">
                {search
                  ? `No student matching query "${search}" exists in ${activeBranch}.`
                  : `No records scraped yet for ${activeBranch}. Launch the Admin Scraper to ingest results.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredStudents.map((student, idx) => (
                <StudentCard
                  key={student.usn}
                  student={student}
                  rank={sortBy === "percentage" ? idx + 1 : undefined}
                  isSelectedForCompare={compareUsns.includes(student.usn)}
                  onToggleCompare={() => handleToggleCompare(student.usn)}
                  onOpenDetail={() => handleOpenDetail(student.usn)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Floating Compare Dock */}
      {compareUsns.length > 0 && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-auto z-40 animate-in slide-in-from-bottom duration-200">
          <div className="bg-[#0c1015] text-white px-4 py-3 rounded-2xl shadow-[0_0_25px_rgba(0,240,255,0.25)] flex items-center justify-between gap-3 border border-cyan-500/40">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-400 text-cyan-300 flex items-center justify-center">
                <IconCompare className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-cyan-300">{compareUsns.length} / 2 SELECTED</span>
                <p className="text-[10px] text-slate-400 hidden sm:block">
                  {compareUsns.length === 1
                    ? "Choose second student card to compare"
                    : `${compareUsns[0]} VS ${compareUsns[1]}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {compareUsns.length === 2 && (
                <button
                  type="button"
                  onClick={handleOpenCompare}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-[0_0_12px_rgba(0,240,255,0.4)] transition-all"
                >
                  RUN COMPARISON →
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  setCompareUsns([]);
                }}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-1"
              >
                CLEAR
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

      {/* Detailed Student Marks Modal (Cyber Obsidian Dossier) */}
      {selectedUsn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0c1015] rounded-3xl border border-cyan-500/40 shadow-[0_0_40px_rgba(0,240,255,0.2)] w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#08090a]/95 border-b border-cyan-500/20 p-4 sm:p-5 flex items-start justify-between z-10">
              <div className="flex items-center gap-3">
                <CryptographicAvatar usn={selectedUsn} size={50} showSignature={true} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 uppercase">
                      {detailStudent?.branch || "BRANCH"}
                    </span>
                    <span className="text-[9px] text-slate-500">DOSSIER RECORD</span>
                  </div>
                  <h2 className="text-base sm:text-xl font-bold text-slate-100 mt-0.5">
                    {detailStudent?.name || selectedUsn}
                  </h2>
                  <p className="font-mono text-xs text-cyan-400/80">{selectedUsn}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleToggleCompare(selectedUsn)}
                  className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                    compareUsns.includes(selectedUsn)
                      ? "bg-cyan-500 text-slate-950 border-cyan-400"
                      : "bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-400"
                  }`}
                  title="Toggle student in comparison"
                >
                  <IconCompare className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {compareUsns.includes(selectedUsn) ? "COMPARING" : "COMPARE"}
                  </span>
                </button>
                <button
                  onClick={handleCloseDetail}
                  className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded-xl transition-colors"
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
                  <div className="h-24 bg-slate-900 rounded animate-pulse" />
                  <div className="h-40 bg-slate-900 rounded animate-pulse" />
                </div>
              ) : !detailStudent ? (
                <p className="text-center text-slate-400 py-8 text-sm">Failed to load student details.</p>
              ) : (
                <>
                  {/* Summary Tiles */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                    <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl">
                      <p className="text-[9px] uppercase font-bold text-slate-500">TOTAL SCORE</p>
                      <p className="text-base sm:text-lg font-black text-slate-200 mt-0.5">
                        {detailStudent.total_marks}
                        <span className="text-[10px] font-normal text-slate-500 ml-0.5">
                          /{detailStudent.max_marks || 100}
                        </span>
                      </p>
                    </div>
                    <div className="bg-cyan-950/30 border border-cyan-500/40 p-3 rounded-2xl shadow-[0_0_15px_rgba(0,240,255,0.08)]">
                      <p className="text-[9px] uppercase font-bold text-cyan-400">PERCENTAGE</p>
                      <p className="text-base sm:text-lg font-black text-cyan-300 mt-0.5 drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]">
                        {detailStudent.percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div
                      className={`p-3 rounded-2xl border ${
                        detailStudent.total_backlogs > 0
                          ? "bg-rose-950/30 border-rose-500/40 text-rose-300"
                          : "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                      }`}
                    >
                      <p className="text-[9px] uppercase font-bold opacity-80">BACKLOGS</p>
                      <p className="text-base sm:text-lg font-black mt-0.5">
                        {detailStudent.total_backlogs}
                      </p>
                    </div>
                  </div>

                  {/* Marks Breakdown Table */}
                  <div>
                    <h3 className="font-bold text-slate-300 text-xs sm:text-sm mb-2.5 flex items-center justify-between">
                      <span>SUBJECT BREAKDOWN MATRIX</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {detailStudent.marks?.length || 0} PAPERS
                      </span>
                    </h3>
                    <div className="overflow-x-auto rounded-2xl border border-slate-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                            <th className="py-2.5 px-3 font-semibold">Code</th>
                            <th className="py-2.5 px-3 font-semibold">Subject</th>
                            <th className="py-2.5 px-2 font-semibold text-center">Int</th>
                            <th className="py-2.5 px-2 font-semibold text-center">Ext</th>
                            <th className="py-2.5 px-2 font-semibold text-center">Total</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-[#08090a]">
                          {detailStudent.marks && detailStudent.marks.length > 0 ? (
                            detailStudent.marks.map((m, i) => (
                              <tr key={i} className="hover:bg-slate-900/50">
                                <td className="py-2.5 px-3 font-mono font-semibold text-cyan-400">
                                  {m.subject_code}
                                </td>
                                <td className="py-2.5 px-3 text-slate-300 font-medium max-w-[200px] truncate">
                                  {m.subject_name || m.subject_code}
                                </td>
                                <td className="py-2.5 px-2 text-center text-slate-400">
                                  {m.internal_marks}
                                </td>
                                <td className="py-2.5 px-2 text-center text-slate-400">
                                  {m.external_marks}
                                </td>
                                <td className="py-2.5 px-2 text-center font-bold font-mono text-slate-100">
                                  {m.total}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <span
                                    className={`inline-block font-bold px-2 py-0.5 rounded text-[10px] border ${
                                      m.status === "P"
                                        ? "bg-emerald-950/60 text-emerald-300 border-emerald-800"
                                        : "bg-rose-950/60 text-rose-300 border-rose-800"
                                    }`}
                                  >
                                    {m.status === "P" ? "PASS" : m.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-500">
                                No subject breakdown available for this student.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Read-Only Social Profiles Display */}
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                    <h4 className="font-bold text-slate-400 text-xs uppercase tracking-wider mb-2">
                      LINKED DEVELOPER DOSSIERS
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {detailStudent.github_url && (
                        <a
                          href={detailStudent.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => sfx.playClick()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200 hover:border-cyan-400 hover:text-cyan-300 shadow-sm"
                        >
                          <IconGitHub className="w-3.5 h-3.5" />
                          <span>GITHUB</span>
                          <IconExternalLink className="w-3 h-3 text-slate-500" />
                        </a>
                      )}

                      {detailStudent.linkedin_url && (
                        <a
                          href={detailStudent.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => sfx.playClick()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-900/60 bg-blue-950/30 text-xs font-semibold text-blue-300 hover:border-blue-400 shadow-sm"
                        >
                          <IconLinkedIn className="w-3.5 h-3.5 text-blue-400" />
                          <span>LINKEDIN</span>
                          <IconExternalLink className="w-3 h-3 text-blue-500" />
                        </a>
                      )}

                      {!detailStudent.github_url && !detailStudent.linkedin_url && (
                        <span className="text-xs text-slate-600 italic">No external developer profiles linked yet.</span>
                      )}
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
