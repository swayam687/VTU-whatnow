"use client";

import React from "react";
import { BranchStat } from "../lib/api";
import { sfx } from "../lib/sfx";

interface BranchTabsProps {
  branches: string[];
  activeBranch: string;
  onSelect: (branch: string) => void;
  branchStats?: Record<string, BranchStat>;
  isObsidian?: boolean;
}

export default function BranchTabs({
  branches,
  activeBranch,
  onSelect,
  branchStats = {},
  isObsidian = false,
}: BranchTabsProps) {
  return (
    <div className="flex sm:grid sm:grid-cols-4 md:grid-cols-7 gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
      {branches.map((b) => {
        const isActive = activeBranch === b;
        const count = branchStats[b]?.total_students;
        return (
          <button
            key={b}
            onClick={() => {
              sfx.playMechanicalClick();
              onSelect(b);
            }}
            className={`flex-shrink-0 flex items-center justify-between sm:flex-col sm:justify-center px-3.5 py-2 sm:py-2.5 rounded-xl border text-left sm:text-center transition-all snap-start ${
              isObsidian
                ? isActive
                  ? "bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-sm shadow-cyan-500/20"
                  : "bg-[#0f1115] text-slate-300 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/60"
                : isActive
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-white text-slate-700 border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 shadow-sm"
            }`}
          >
            <span className="font-semibold text-xs tracking-tight">{b}</span>
            <span
              className={`text-[10px] font-mono ml-2.5 sm:ml-0 sm:mt-0.5 px-2 py-0.2 rounded-full font-medium ${
                isObsidian
                  ? isActive
                    ? "bg-slate-950 text-cyan-400"
                    : "bg-slate-800 text-slate-400"
                  : isActive
                  ? "bg-slate-800 text-slate-200"
                  : "bg-slate-100 text-slate-600"
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
