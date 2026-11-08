"use client";

import React, { useState, useEffect } from "react";
import {
  fetchBacklogAnalytics,
  BacklogAnalytics,
  SubjectBacklogStat,
  BranchBacklogSummary,
  Student,
} from "../lib/api";
import { sfx } from "../lib/sfx";

interface BacklogMatrixProps {
  students: Student[];
  onSelectStudent?: (usn: string) => void;
  isObsidian?: boolean;
}

export default function BacklogMatrix({
  students,
  onSelectStudent,
  isObsidian = true,
}: BacklogMatrixProps) {
  const [data, setData] = useState<BacklogAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBranchTab, setSelectedBranchTab] = useState<string>("ALL");

  useEffect(() => {
    setLoading(true);
    fetchBacklogAnalytics()
      .then((res) => setData(res))
      .catch((err) => console.error("Failed to fetch backlog analytics", err))
      .finally(() => setLoading(false));
  }, []);

  // Filter subject mortality list by branch tab
  const activeSubjectList: SubjectBacklogStat[] = React.useMemo(() => {
    if (!data) return [];
    if (selectedBranchTab === "ALL") {
      return data.overall_deadliest_subjects;
    }
    const branchData = data.branches.find((b) => b.branch === selectedBranchTab);
    return branchData ? branchData.top_failed_subjects : [];
  }, [data, selectedBranchTab]);

  // Students with 3+ backlogs
  const criticalStudents = React.useMemo(() => {
    return students
      .filter((s) => s.total_backlogs >= 3)
      .sort((a, b) => b.total_backlogs - a.total_backlogs);
  }, [students]);

  return (
    <div
      className={`rounded-3xl p-5 sm:p-7 border transition-all duration-300 font-mono ${
        isObsidian
          ? "bg-[#08090a] border-slate-800 text-white"
          : "bg-white border-slate-200 text-slate-900 shadow-sm"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-sm shadow-rose-500/50" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-rose-400 bg-rose-950/60 px-2.5 py-0.5 rounded border border-rose-800/60">
              Academic Triage &amp; Mortality Analytics
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mt-2 tracking-tight">
            Backlog Inspection Matrix
          </h2>
          <p className="text-xs opacity-60 mt-0.5 max-w-xl">
            Branch-wise failed papers count, average backlogs per student, and ranking of the deadliest subjects across VTU.
          </p>
        </div>

        {/* Global Casualty Counter */}
        <div className="flex items-center gap-4 bg-slate-900/80 border border-slate-800 p-3 sm:p-4 rounded-2xl self-start md:self-auto">
          <div className="text-center px-2">
            <span className="block text-2xl sm:text-3xl font-black text-rose-400">
              {data ? data.total_failed_papers : "..."}
            </span>
            <span className="text-[9px] uppercase tracking-wider opacity-60">
              Total Failed Papers
            </span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="text-center px-2">
            <span className="block text-2xl sm:text-3xl font-black text-amber-400">
              {criticalStudents.length}
            </span>
            <span className="text-[9px] uppercase tracking-wider opacity-60">
              Critical (&ge;3 Backlogs)
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs opacity-60 animate-pulse">
          ⚡ Decrypting campus mark records &amp; compiling backlog statistics...
        </div>
      ) : (
        <div className="space-y-8 mt-6">
          {/* SECTION 1: Branch-wise Backlog Intensity Cards */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3 flex items-center gap-2">
              <span>Branch Casualty &amp; Survival Distribution</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {data?.branches.map((b) => {
                const survivalRate =
                  b.total_students > 0
                    ? Math.round((b.clean_pass_students / b.total_students) * 100)
                    : 100;

                return (
                  <div
                    key={b.branch}
                    className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                        {b.branch}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          survivalRate >= 80
                            ? "text-emerald-400"
                            : survivalRate >= 50
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {survivalRate}% Survival
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80">
                      <div>
                        <span className="block text-[9px] uppercase opacity-50">Total Fails</span>
                        <span className="text-lg font-black text-rose-400">
                          {b.total_backlogs}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase opacity-50">Avg / Student</span>
                        <span className="text-lg font-black text-amber-400">
                          {b.avg_backlogs_per_student}
                        </span>
                      </div>
                    </div>

                    {/* Survival Progress Bar */}
                    <div className="mt-3">
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full"
                          style={{ width: `${survivalRate}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] opacity-50 mt-1">
                        <span>{b.clean_pass_students} Clean Pass</span>
                        <span>{b.students_with_backlogs} With Fails</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: The Graveyard - Deadliest Subjects Ranking */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                  <span>The Graveyard: Highest Backlog Subject Rankings</span>
                </h3>
                <p className="text-[11px] opacity-60">
                  Subjects generating the highest student casualty counts and fail rates.
                </p>
              </div>

              {/* Branch filter pills for subject rankings */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  onClick={() => {
                    sfx.playMechanicalClick();
                    setSelectedBranchTab("ALL");
                  }}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all ${
                    selectedBranchTab === "ALL"
                      ? "bg-rose-500 text-white shadow-sm shadow-rose-500/40"
                      : "bg-slate-900 border border-slate-800 opacity-60 hover:opacity-100"
                  }`}
                >
                  ALL BRANCHES
                </button>
                {data?.branches.map((b) => (
                  <button
                    key={b.branch}
                    onClick={() => {
                      sfx.playMechanicalClick();
                      setSelectedBranchTab(b.branch);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                      selectedBranchTab === b.branch
                        ? "bg-rose-500 text-white shadow-sm shadow-rose-500/40"
                        : "bg-slate-900 border border-slate-800 opacity-60 hover:opacity-100"
                    }`}
                  >
                    {b.branch}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject Rankings Table */}
            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/40">
              {activeSubjectList.length === 0 ? (
                <div className="py-8 text-center text-xs opacity-50">
                  No subject casualties recorded for this branch! 100% clean passes.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {activeSubjectList.map((subj, idx) => {
                    const isTopThree = idx < 3;
                    return (
                      <div
                        key={`${subj.subject_code}-${subj.branch}`}
                        className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                              isTopThree
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            #{String(idx + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs sm:text-sm text-white">
                                {subj.subject_code}
                              </span>
                              {subj.branch && subj.branch !== "ALL" && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                  {subj.branch}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] opacity-70 truncate max-w-sm sm:max-w-md">
                              {subj.subject_name || "VTU CBCS Theory Paper"}
                            </p>
                          </div>
                        </div>

                        {/* Mortality Bar & Metrics */}
                        <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto">
                          <div className="w-24 sm:w-36">
                            <div className="flex justify-between text-[9px] mb-1">
                              <span className="text-rose-400 font-bold">{subj.fail_rate}% Fail</span>
                              <span className="opacity-50">{subj.fail_count} Fails</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  subj.fail_rate >= 30
                                    ? "bg-rose-500"
                                    : subj.fail_rate >= 15
                                    ? "bg-amber-400"
                                    : "bg-cyan-400"
                                }`}
                                style={{ width: `${Math.min(subj.fail_rate, 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="text-right min-w-[70px]">
                            <span className="block text-xs font-bold text-white">
                              {subj.pass_count} / {subj.total_students}
                            </span>
                            <span className="text-[9px] opacity-50 uppercase">Passed</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: Critical Backlog Students Triage Watchlist */}
          {criticalStudents.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5 flex items-center gap-2">
                <span>Critical Backlog Triage Watchlist (&ge;3 Backlogs)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {criticalStudents.map((s) => (
                  <div
                    key={s.usn}
                    onClick={() => {
                      if (onSelectStudent) {
                        sfx.playMechanicalClick();
                        onSelectStudent(s.usn);
                      }
                    }}
                    className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-xs text-white truncate max-w-[150px]">
                        {s.name || s.usn}
                      </p>
                      <span className="text-[10px] text-slate-400">{s.usn}</span>
                      <span className="ml-2 text-[9px] font-bold text-cyan-400">
                        {s.branch}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-950 text-rose-400 border border-rose-800">
                        {s.total_backlogs} BACKLOGS
                      </span>
                      <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                        {s.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
