"use client";

import React, { useState, useEffect, useMemo } from "react";
import BranchTabs from "../components/BranchTabs";
import StudentCard from "../components/StudentCard";
import Leaderboard from "../components/Leaderboard";
import CompareModal from "../components/CompareModal";
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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Backend Offline Banner */}
      {backendOnline === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-sm">
          <div>
            <p className="font-bold text-xs sm:text-sm">API Backend is Offline</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Start the FastAPI server on port 8000 to fetch results and manage students.
            </p>
          </div>
          <button
            onClick={() => {
              checkBackendHealth().then((isUp) => {
                setBackendOnline(isUp);
                if (isUp) window.location.reload();
              });
            }}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors whitespace-nowrap"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md">
              VTU Academic Portal
            </span>
            <h1 className="text-xl sm:text-3xl font-black mt-2.5 tracking-tight text-white">
              Campus Semester Results & Analytics
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-xl">
              Search by USN or name, group by branch, inspect subject marks, and compare performance head-to-head.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 sm:gap-6 bg-slate-800/80 rounded-2xl p-3 sm:p-4 border border-slate-700/60 self-start md:self-auto">
            <div className="text-center px-2">
              <p className="text-xl sm:text-2xl font-black text-white">{students.length}</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Students
              </p>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            <div className="text-center px-2">
              <p className="text-xl sm:text-2xl font-black text-emerald-400">
                {students.filter((s) => s.total_backlogs === 0).length}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                All Clear
              </p>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            <div className="text-center px-2">
              <p className="text-xl sm:text-2xl font-black text-rose-400">
                {students.reduce((sum, s) => sum + s.total_backlogs, 0)}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Backlogs
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Branch Tabs Selection */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
            Filter by Branch
          </h2>
          <span className="text-[11px] text-slate-400">Swipe or click to view</span>
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

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name or USN (e.g. 1RM25CS...)"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50/60"
          />
          <span className="absolute left-3 top-3 text-slate-400">
            <IconSearch className="w-4 h-4" />
          </span>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-1"
            >
              <IconClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Sort:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
          >
            <option value="percentage">Highest Percentage</option>
            <option value="backlogs">Fewest Backlogs</option>
            <option value="usn">USN (Ascending)</option>
          </select>
        </div>
      </div>

      {/* Student Cards Grid (Read-only + Compare) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900 text-base">
            {activeBranch === "ALL" ? "All Enrolled Students" : `${activeBranch} Students`}
            <span className="ml-2 text-xs font-semibold text-slate-400">
              ({filteredStudents.length})
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 bg-slate-100 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 text-center">
            <h3 className="font-bold text-slate-800 text-base">No student records found</h3>
            <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-sm mx-auto">
              {search
                ? `No student matching "${search}" was found in ${activeBranch}.`
                : `No results have been scraped yet for ${activeBranch}. Check back soon.`}
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

      {/* Floating Compare Dock */}
      {compareUsns.length > 0 && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-auto z-40 animate-in slide-in-from-bottom duration-200">
          <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between gap-3 border border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <IconCompare className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs">
                <span className="font-bold">{compareUsns.length} / 2 Selected</span>
                <p className="text-[10px] text-slate-400 hidden sm:block">
                  {compareUsns.length === 1
                    ? "Select another student card to compare"
                    : `${compareUsns[0]} vs ${compareUsns[1]}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {compareUsns.length === 2 && (
                <button
                  type="button"
                  onClick={handleOpenCompare}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  Compare Subject Marks →
                </button>
              )}
              <button
                type="button"
                onClick={() => setCompareUsns([])}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-1"
              >
                Clear
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

      {/* Detailed Student Marks Modal (Strictly Read-Only For Visitors) */}
      {selectedUsn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 p-4 sm:p-5 flex items-start justify-between z-10">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider">
                  {detailStudent?.branch || "BRANCH"}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                  {detailStudent?.name || selectedUsn}
                </h2>
                <p className="font-mono text-xs text-slate-400 mt-0.5">{selectedUsn}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleToggleCompare(selectedUsn)}
                  className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                    compareUsns.includes(selectedUsn)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                  title="Toggle student in comparison"
                >
                  <IconCompare className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {compareUsns.includes(selectedUsn) ? "In Comparison" : "Compare"}
                  </span>
                </button>
                <button
                  onClick={handleCloseDetail}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="space-y-3 py-8">
                  <div className="h-6 bg-slate-100 rounded animate-pulse" />
                  <div className="h-24 bg-slate-100 rounded animate-pulse" />
                  <div className="h-40 bg-slate-100 rounded animate-pulse" />
                </div>
              ) : !detailStudent ? (
                <p className="text-center text-slate-400 py-8 text-sm">Failed to load student details.</p>
              ) : (
                <>
                  {/* Summary Tiles */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                    <div className="bg-slate-50/80 border border-slate-100 p-3 rounded-2xl">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Total Score</p>
                      <p className="text-base sm:text-lg font-black text-slate-800 mt-0.5">
                        {detailStudent.total_marks}
                        <span className="text-[10px] font-normal text-slate-400 ml-0.5">
                          /{detailStudent.max_marks || 100}
                        </span>
                      </p>
                    </div>
                    <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-2xl">
                      <p className="text-[10px] uppercase font-bold text-blue-500">Percentage</p>
                      <p className="text-base sm:text-lg font-black text-blue-600 mt-0.5">
                        {detailStudent.percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div
                      className={`p-3 rounded-2xl border ${
                        detailStudent.total_backlogs > 0
                          ? "bg-rose-50/60 border-rose-100 text-rose-700"
                          : "bg-emerald-50/60 border-emerald-100 text-emerald-700"
                      }`}
                    >
                      <p className="text-[10px] uppercase font-bold opacity-80">Backlogs</p>
                      <p className="text-base sm:text-lg font-black mt-0.5">
                        {detailStudent.total_backlogs}
                      </p>
                    </div>
                  </div>

                  {/* Marks Breakdown Table */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm mb-2.5">
                      Subject Marks Breakdown ({detailStudent.marks?.length || 0})
                    </h3>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                            <th className="py-2.5 px-3 font-semibold">Code</th>
                            <th className="py-2.5 px-3 font-semibold">Subject</th>
                            <th className="py-2.5 px-2 font-semibold text-center">Int</th>
                            <th className="py-2.5 px-2 font-semibold text-center">Ext</th>
                            <th className="py-2.5 px-2 font-semibold text-center">Total</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detailStudent.marks && detailStudent.marks.length > 0 ? (
                            detailStudent.marks.map((m, i) => (
                              <tr key={i} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                                  {m.subject_code}
                                </td>
                                <td className="py-2.5 px-3 text-slate-800 font-medium max-w-[200px] truncate">
                                  {m.subject_name || m.subject_code}
                                </td>
                                <td className="py-2.5 px-2 text-center text-slate-500">
                                  {m.internal_marks}
                                </td>
                                <td className="py-2.5 px-2 text-center text-slate-500">
                                  {m.external_marks}
                                </td>
                                <td className="py-2.5 px-2 text-center font-bold font-mono text-slate-900">
                                  {m.total}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <span
                                    className={`inline-block font-bold px-2 py-0.5 rounded text-[10px] ${
                                      m.status === "P"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-rose-50 text-rose-700 border border-rose-200"
                                    }`}
                                  >
                                    {m.status === "P" ? "PASS" : m.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-400">
                                No subject breakdown available for this student.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Read-Only Social Profiles Display */}
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                      Social & Developer Profiles
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {detailStudent.github_url && (
                        <a
                          href={detailStudent.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:border-slate-300 shadow-sm"
                        >
                          <IconGitHub className="w-3.5 h-3.5" />
                          <span>GitHub Profile</span>
                          <IconExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                      )}

                      {detailStudent.linkedin_url && (
                        <a
                          href={detailStudent.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/50 text-xs font-semibold text-blue-800 hover:border-blue-300 shadow-sm"
                        >
                          <IconLinkedIn className="w-3.5 h-3.5 text-blue-600" />
                          <span>LinkedIn Profile</span>
                          <IconExternalLink className="w-3 h-3 text-blue-400" />
                        </a>
                      )}

                      {!detailStudent.github_url && !detailStudent.linkedin_url && (
                        <span className="text-xs text-slate-400 italic">No developer profiles linked.</span>
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
