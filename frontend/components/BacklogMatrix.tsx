"use client";

import React, { useState, useEffect } from "react";
import {
  fetchBacklogAnalytics,
  BacklogAnalytics,
  SubjectBacklogStat,
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

  const activeSubjectList: SubjectBacklogStat[] = React.useMemo(() => {
    if (!data) return [];
    if (selectedBranchTab === "ALL") {
      return data.overall_deadliest_subjects;
    }
    const branchData = data.branches.find((b) => b.branch === selectedBranchTab);
    return branchData ? branchData.top_failed_subjects : [];
  }, [data, selectedBranchTab]);

  const criticalStudents = React.useMemo(() => {
    return students
      .filter((s) => s.total_backlogs >= 3)
      .sort((a, b) => b.total_backlogs - a.total_backlogs);
  }, [students]);

  return (
    <div
      className={`rounded-2xl sm:rounded-3xl p-4 sm:p-6 border transition-all ${
        isObsidian
          ? "bg-[#0c0e12] border-slate-800/90 text-white"
          : "bg-white border-slate-200/90 text-slate-900 shadow-sm"
      }`}
    >
      {/* Header */}
      <div
        className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b ${
          isObsidian ? "border-slate-800" : "border-slate-100"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isObsidian
                  ? "bg-rose-950/40 text-rose-400 border-rose-800/40"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              Academic Overview
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-bold mt-1.5 tracking-tight">
            Subject Analytics &amp; Backlog Statistics
          </h2>
          <p className="text-xs opacity-60 mt-0.5 max-w-xl">
            Branch-wise backlog distributions and subjects with the highest fail rates across semester exams.
          </p>
        </div>

        {/* Counter Summary */}
        <div
          className={`flex items-center gap-4 p-3 rounded-2xl border self-start md:self-auto ${
            isObsidian ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="text-center px-2">
            <span className="block text-xl sm:text-2xl font-black text-rose-500">
              {data ? data.total_failed_papers : "..."}
            </span>
            <span className="text-[10px] uppercase font-semibold opacity-60">
              Backlog Papers
            </span>
          </div>
          <div className="w-px h-7 bg-slate-300 dark:bg-slate-800" />
          <div className="text-center px-2">
            <span className="block text-xl sm:text-2xl font-black text-amber-500">
              {criticalStudents.length}
            </span>
            <span className="text-[10px] uppercase font-semibold opacity-60">
              &ge;3 Backlogs
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs opacity-60 animate-pulse">
          Loading marks analytics...
        </div>
      ) : (
        <div className="space-y-7 mt-5">
          {/* SECTION 1: Branch Statistics Cards */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">
              Department Performance &amp; Pass Rates
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {data?.branches.map((b) => {
                const survivalRate =
                  b.total_students > 0
                    ? Math.round((b.clean_pass_students / b.total_students) * 100)
                    : 100;

                return (
                  <div
                    key={b.branch}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isObsidian
                        ? "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                        : "bg-slate-50/70 border-slate-200/90 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                          isObsidian
                            ? "bg-slate-800 text-slate-200 border-slate-700"
                            : "bg-white text-slate-800 border-slate-200"
                        }`}
                      >
                        {b.branch}
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          survivalRate >= 80
                            ? "text-emerald-500"
                            : survivalRate >= 50
                            ? "text-amber-500"
                            : "text-rose-500"
                        }`}
                      >
                        {survivalRate}% Pass Rate
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800/80">
                      <div>
                        <span className="block text-[9px] uppercase opacity-50">Backlogs</span>
                        <span className="text-base font-bold text-rose-500">
                          {b.total_backlogs}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase opacity-50">Avg / Student</span>
                        <span className="text-base font-bold text-amber-500">
                          {b.avg_backlogs_per_student}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5">
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${survivalRate}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] opacity-50 mt-1">
                        <span>{b.clean_pass_students} All Clear</span>
                        <span>{b.students_with_backlogs} With Fails</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Subject Backlog Rankings */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500">
                  Subject Failure Rankings
                </h3>
                <p className="text-[11px] opacity-60">
                  Subjects with the highest number of failed papers
                </p>
              </div>

              {/* Branch filter pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  onClick={() => {
                    sfx.playMechanicalClick();
                    setSelectedBranchTab("ALL");
                  }}
                  className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all ${
                    selectedBranchTab === "ALL"
                      ? isObsidian
                        ? "bg-rose-500 text-white"
                        : "bg-slate-900 text-white"
                      : isObsidian
                      ? "bg-slate-900 border border-slate-800 text-slate-400"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  All Branches
                </button>
                {data?.branches.map((b) => (
                  <button
                    key={b.branch}
                    onClick={() => {
                      sfx.playMechanicalClick();
                      setSelectedBranchTab(b.branch);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all ${
                      selectedBranchTab === b.branch
                        ? isObsidian
                          ? "bg-rose-500 text-white"
                          : "bg-slate-900 text-white"
                        : isObsidian
                        ? "bg-slate-900 border border-slate-800 text-slate-400"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {b.branch}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject Rankings Table */}
            <div
              className={`rounded-2xl border overflow-hidden ${
                isObsidian ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              {activeSubjectList.length === 0 ? (
                <div className="py-8 text-center text-xs opacity-50">
                  No failed papers recorded for this department.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {activeSubjectList.map((subj, idx) => (
                    <div
                      key={`${subj.subject_code}-${subj.branch}`}
                      className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            idx === 0
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs sm:text-sm">
                              {subj.subject_code}
                            </span>
                            {subj.branch && subj.branch !== "ALL" && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 opacity-70">
                                {subj.branch}
                              </span>
                            )}
                          </div>
                          <p className="text-xs opacity-70 truncate max-w-sm sm:max-w-md">
                            {subj.subject_name || subj.subject_code}
                          </p>
                        </div>
                      </div>

                      {/* Fail Rate Progress & Stats */}
                      <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto">
                        <div className="w-24 sm:w-36">
                          <div className="flex justify-between text-[9px] mb-1 font-semibold">
                            <span className="text-rose-500">{subj.fail_rate}% Fail</span>
                            <span className="opacity-50">{subj.fail_count} Fails</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                subj.fail_rate >= 30
                                  ? "bg-rose-500"
                                  : subj.fail_rate >= 15
                                  ? "bg-amber-500"
                                  : "bg-blue-500"
                              }`}
                              style={{ width: `${Math.min(subj.fail_rate, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-right min-w-[65px]">
                          <span className="block text-xs font-bold font-mono">
                            {subj.pass_count} / {subj.total_students}
                          </span>
                          <span className="text-[9px] opacity-50 uppercase">Passed</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: Students with Multiple Backlogs */}
          {criticalStudents.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-2.5">
                Students with &ge;3 Backlogs
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
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      isObsidian
                        ? "bg-slate-900/60 border-slate-800 hover:border-amber-500/50"
                        : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-xs truncate max-w-[150px]">
                        {s.name || s.usn}
                      </p>
                      <span className="font-mono text-[10px] opacity-60">{s.usn}</span>
                      <span className="ml-2 text-[9px] font-semibold text-blue-500">
                        {s.branch}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                        {s.total_backlogs} Backlogs
                      </span>
                      <span className="block text-[10px] font-mono opacity-60 mt-0.5">
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
