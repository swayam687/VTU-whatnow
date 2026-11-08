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

  return (
    <div className="flex sm:grid sm:grid-cols-4 md:grid-cols-7 gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 font-mono">
      {branches.map((b) => {
        const isActive = activeBranch === b;
        const count = branchStats[b]?.total_students;
        return (
          <button
            key={b}
            onClick={() => handleTabClick(b)}
            className={`flex-shrink-0 flex items-center justify-between sm:flex-col sm:justify-center px-4 py-2.5 sm:py-3 rounded-2xl border text-left sm:text-center transition-all ${
              isActive
                ? "bg-cyan-950/80 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.25)] ring-1 ring-cyan-500/40"
                : "bg-[#0c1015]/80 text-slate-400 border-slate-800/80 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <span className="font-bold text-xs sm:text-sm tracking-tight">{b}</span>
            <span
              className={`text-[10px] font-bold ml-2.5 sm:ml-0 sm:mt-1 px-2 py-0.5 rounded-full border ${
                isActive
                  ? "bg-cyan-900/60 text-cyan-200 border-cyan-700/60"
                  : "bg-slate-900 text-slate-500 border-slate-800"
              }`}
            >
              {count !== undefined ? count : "0"} NODES
            </span>
          </button>
        );
      })}
    </div>
  );
}
