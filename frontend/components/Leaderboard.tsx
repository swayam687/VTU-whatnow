"use client";

import React from "react";
import { Student } from "../lib/api";
import { IconTrophy } from "./Icons";
import Identicon from "./Identicon";
import { sfx } from "../lib/sfx";

interface LeaderboardProps {
  toppers: Student[];
  branch: string;
  onSelectStudent: (student: Student) => void;
  isObsidian?: boolean;
}

export default function Leaderboard({
  toppers,
  branch,
  onSelectStudent,
  isObsidian = false,
}: LeaderboardProps) {
  if (!toppers.length) return null;

  const topThree = toppers.slice(0, 3);

  return (
    <div
      className={`rounded-3xl border p-5 sm:p-6 mb-6 font-mono transition-all duration-300 ${
        isObsidian
          ? "bg-[#090b0e] border-slate-800 text-white shadow-lg shadow-black/40"
          : "bg-white border-slate-200/90 text-slate-900 shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <IconTrophy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base">
              {branch === "ALL" ? "Campus Top Performers" : `${branch} Branch Toppers`}
            </h2>
            <p className="text-[11px] opacity-60">
              Ranked by aggregate marks &amp; percentage score
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Podium #1-3
        </span>
      </div>

      {/* Podium Cards for Top 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {topThree.map((s, idx) => {
          const rankColors = [
            {
              border: "border-amber-500/50 hover:border-amber-400",
              bg: isObsidian ? "bg-amber-950/20" : "bg-amber-50/50",
              badge: "bg-amber-500 text-slate-950 font-black",
              glow: "shadow-amber-500/10",
            },
            {
              border: "border-cyan-500/40 hover:border-cyan-400",
              bg: isObsidian ? "bg-cyan-950/20" : "bg-cyan-50/50",
              badge: "bg-cyan-500 text-slate-950 font-black",
              glow: "shadow-cyan-500/10",
            },
            {
              border: "border-orange-500/40 hover:border-orange-400",
              bg: isObsidian ? "bg-orange-950/20" : "bg-orange-50/50",
              badge: "bg-orange-500 text-slate-950 font-black",
              glow: "shadow-orange-500/10",
            },
          ];
          const meta = rankColors[idx] || rankColors[0];

          return (
            <div
              key={s.usn}
              onClick={() => {
                sfx.playSonarChime();
                onSelectStudent(s);
              }}
              className={`p-3.5 sm:p-4 rounded-2xl border ${meta.border} ${meta.bg} flex items-center justify-between gap-3 cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-lg ${meta.glow}`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Identicon
                  usn={s.usn}
                  percentage={s.percentage}
                  totalBacklogs={s.total_backlogs}
                  size={38}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded ${meta.badge}`}>
                      RANK #{idx + 1}
                    </span>
                    <span className="text-[10px] font-bold opacity-60 uppercase">
                      {s.branch}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm truncate">
                    {s.name || "Anonymous"}
                  </h3>
                  <p className="text-[10px] opacity-60 tracking-wider">{s.usn}</p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-sm sm:text-base font-black text-amber-400 block">
                  {s.percentage.toFixed(1)}%
                </span>
                <span className="text-[10px] opacity-60 block">
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
