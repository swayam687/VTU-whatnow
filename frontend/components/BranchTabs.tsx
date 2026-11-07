"use client";

import React from "react";
import { BranchStat } from "../lib/api";

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
  return (
    <div className="flex sm:grid sm:grid-cols-4 md:grid-cols-7 gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
      {branches.map((b) => {
        const isActive = activeBranch === b;
        const count = branchStats[b]?.total_students;
        return (
          <button
            key={b}
            onClick={() => onSelect(b)}
            className={`flex-shrink-0 flex items-center justify-between sm:flex-col sm:justify-center px-4 py-2.5 sm:py-3 rounded-2xl border text-left sm:text-center transition-all ${
              isActive
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-white text-slate-700 border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80"
            }`}
          >
            <span className="font-bold text-xs sm:text-sm tracking-tight">{b}</span>
            <span
              className={`text-[11px] font-medium ml-2.5 sm:ml-0 sm:mt-0.5 px-2 py-0.2 rounded-full ${
                isActive ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-500"
              }`}
            >
              {count !== undefined ? count : "0"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
