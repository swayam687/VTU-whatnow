"use client";

import React from "react";
import { BranchStat } from "../lib/api";
import { sfx } from "../lib/sfx";

interface BranchTabsProps {
  branches: string[];
  activeBranch: string;
  onSelect: (branch: string) => void;
  branchStats?: Record<string, BranchStat>;
}

export default function BranchTabs({
  branches,
  activeBranch,
  onSelect,
  branchStats = {},
}: BranchTabsProps) {
  const handleTabClick = (b: string) => {
    sfx.playClick();
    onSelect(b);
  };

  // Compute aggregate numbers for "ALL"
  const allTotalStudents = Object.values(branchStats).reduce((acc, s) => acc + s.total_students, 0);
  const allTotalBacklogPapers = Object.values(branchStats).reduce((acc, s) => acc + s.total_backlogs, 0);
  const allStudentsWithBacklogs = Object.values(branchStats).reduce((acc, s) => {
    const withBacklog = s.students_with_backlogs !== undefined ? s.students_with_backlogs : (s.total_students - s.pass_count);
    return acc + Math.max(0, withBacklog);
  }, 0);

  return (
    <div className="space-y-2.5 font-mono">
      {/* Scrollable Branch Selector Tabs */}
      <div className="flex sm:grid sm:grid-cols-4 md:grid-cols-7 gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
        {branches.map((b) => {
          const isActive = activeBranch === b;
          const stat = branchStats[b];

          const totalCount = b === "ALL" ? allTotalStudents : (stat?.total_students ?? 0);
          const backlogPapers = b === "ALL" ? allTotalBacklogPapers : (stat?.total_backlogs ?? 0);
          const studentsWithBacklogs = b === "ALL"
            ? allStudentsWithBacklogs
            : (stat?.students_with_backlogs !== undefined ? stat.students_with_backlogs : Math.max(0, (stat?.total_students ?? 0) - (stat?.pass_count ?? 0)));

          return (
            <button
              key={b}
              onClick={() => handleTabClick(b)}
              className={`flex-shrink-0 flex flex-col justify-between p-2.5 sm:p-3 rounded-2xl border text-left sm:text-center transition-all ${
                isActive
                  ? "bg-cyan-950/80 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.25)] ring-1 ring-cyan-500/40"
                  : "bg-[#0c1015]/80 text-slate-400 border-slate-800/80 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between sm:justify-center gap-2">
                <span className="font-bold text-xs sm:text-sm tracking-tight">{b}</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md border ${
                    isActive
                      ? "bg-cyan-900/60 text-cyan-200 border-cyan-700/60"
                      : "bg-slate-900 text-slate-500 border-slate-800"
                  }`}
                >
                  {totalCount}
                </span>
              </div>

              {/* Sub-badge showing backlogs breakdown */}
              <div className="mt-1 text-[9px] leading-tight">
                {studentsWithBacklogs > 0 ? (
                  <span className="text-amber-400 font-semibold block truncate">
                    ⚠️ {studentsWithBacklogs} std ({backlogPapers} bk)
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold block truncate">
                    ✅ All Clear
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Branch Distinct Backlog Metric Callout */}
      {(() => {
        const stat = branchStats[activeBranch];
        const isAll = activeBranch === "ALL";
        const enrolled = isAll ? allTotalStudents : (stat?.total_students ?? 0);
        const clearCount = isAll
          ? (allTotalStudents - allStudentsWithBacklogs)
          : (stat?.pass_count ?? (enrolled - (stat?.students_with_backlogs ?? 0)));
        const stdWithBacklogs = isAll
          ? allStudentsWithBacklogs
          : (stat?.students_with_backlogs !== undefined ? stat.students_with_backlogs : Math.max(0, enrolled - (stat?.pass_count ?? 0)));
        const totalPapers = isAll ? allTotalBacklogPapers : (stat?.total_backlogs ?? 0);

        return (
          <div className="bg-[#0c1015]/90 border border-slate-800 rounded-2xl p-2.5 sm:p-3 text-xs flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 uppercase">
                {activeBranch} METRICS
              </span>
              <span className="text-slate-400 text-[11px]">
                Enrolled: <strong className="text-slate-200">{enrolled}</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 text-[11px]">
                Passed: <strong>{clearCount}</strong>
              </span>
            </div>

            {/* Clearly Separated Backlog Stats */}
            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300">
                <span className="text-amber-400 font-bold">👥 Students with Backlog:</span>
                <strong className="text-amber-200 text-xs">{stdWithBacklogs}</strong>
              </div>

              <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300">
                <span className="text-rose-400 font-bold">📄 Total Backlog Papers:</span>
                <strong className="text-rose-200 text-xs">{totalPapers}</strong>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
