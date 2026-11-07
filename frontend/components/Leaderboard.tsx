"use client";

import React from "react";
import { Student } from "../lib/api";
import { IconTrophy } from "./Icons";

interface LeaderboardProps {
  toppers: Student[];
  branch: string;
  onSelectStudent: (student: Student) => void;
}

export default function Leaderboard({ toppers, branch, onSelectStudent }: LeaderboardProps) {
  if (!toppers.length) return null;

  const topThree = toppers.slice(0, 3);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
            <IconTrophy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">
              {branch === "ALL" ? "Campus Top Performers" : `${branch} Branch Toppers`}
            </h2>
            <p className="text-[11px] text-slate-400">Ranked by total aggregate marks and percentage</p>
          </div>
        </div>
        <span className="hidden sm:inline-block text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          Top 3
        </span>
      </div>

      {/* Podium Cards for Top 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {topThree.map((s, idx) => {
          const rankMeta = [
            {
              label: "Rank 1",
              badgeBg: "bg-amber-100 text-amber-900 border-amber-200",
              cardBorder: "border-amber-200 hover:border-amber-300",
              glow: "bg-amber-50/40",
            },
            {
              label: "Rank 2",
              badgeBg: "bg-slate-100 text-slate-700 border-slate-200",
              cardBorder: "border-slate-200 hover:border-slate-300",
              glow: "bg-slate-50/40",
            },
            {
              label: "Rank 3",
              badgeBg: "bg-orange-100 text-orange-900 border-orange-200",
              cardBorder: "border-orange-200 hover:border-orange-300",
              glow: "bg-orange-50/40",
            },
          ];
          const meta = rankMeta[idx] || rankMeta[1];

          return (
            <div
              key={s.usn}
              onClick={() => onSelectStudent(s)}
              className={`p-4 rounded-2xl border ${meta.cardBorder} ${meta.glow} flex items-center justify-between gap-3 cursor-pointer transition-all hover:shadow-md active:scale-[0.99]`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${meta.badgeBg}`}>
                    {meta.label}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {s.branch}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm truncate">{s.name}</h3>
                <p className="font-mono text-[11px] text-slate-400 mt-0.5">{s.usn}</p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-base sm:text-lg font-black text-slate-900 block">
                  {s.percentage.toFixed(1)}%
                </span>
                <span className="text-[11px] text-slate-500 font-medium block">
                  {s.total_marks} pts
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
