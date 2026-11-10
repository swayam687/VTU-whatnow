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
      className={`rounded-2xl sm:rounded-3xl border p-4 sm:p-5 mb-5 transition-all ${
        isObsidian
          ? "bg-[#0c0e12] border-slate-800/90 text-white shadow-lg shadow-black/40"
          : "bg-white border-slate-200/80 text-slate-900 shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center border ${
              isObsidian
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "bg-amber-50 text-amber-600 border-amber-200"
            }`}
          >
            <IconTrophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div>
            <h2 className="font-bold text-xs sm:text-sm">
              {branch === "ALL" ? "Campus Top Performers" : `${branch} Branch Toppers`}
            </h2>
            <p className="text-[11px] opacity-60">
              Highest aggregate percentages
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
            isObsidian
              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          Top 3
        </span>
      </div>

      {/* Podium Cards for Top 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {topThree.map((s, idx) => {
          const rankMeta = [
            {
              border: isObsidian ? "border-amber-500/40 hover:border-amber-400" : "border-amber-200 hover:border-amber-300",
              bg: isObsidian ? "bg-amber-950/20" : "bg-amber-50/40",
              badge: isObsidian ? "bg-amber-500 text-slate-950" : "bg-amber-100 text-amber-800",
              glow: "shadow-amber-500/5",
            },
            {
              border: isObsidian ? "border-cyan-500/40 hover:border-cyan-400" : "border-slate-200 hover:border-slate-300",
              bg: isObsidian ? "bg-cyan-950/20" : "bg-slate-50/70",
              badge: isObsidian ? "bg-cyan-500 text-slate-950" : "bg-slate-100 text-slate-700",
              glow: "shadow-cyan-500/5",
            },
            {
              border: isObsidian ? "border-orange-500/40 hover:border-orange-400" : "border-orange-200 hover:border-orange-300",
              bg: isObsidian ? "bg-orange-950/20" : "bg-orange-50/40",
              badge: isObsidian ? "bg-orange-500 text-slate-950" : "bg-orange-100 text-orange-800",
              glow: "shadow-orange-500/5",
            },
          ];
          const meta = rankMeta[idx] || rankMeta[0];

          return (
            <div
              key={s.usn}
              onClick={() => {
                sfx.playSonarChime();
                onSelectStudent(s);
              }}
              className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border ${meta.border} ${meta.bg} flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 hover:scale-[1.01] shadow-sm`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Identicon
                  usn={s.usn}
                  percentage={s.percentage}
                  totalBacklogs={s.total_backlogs}
                  customPixelArt={s.avatar_pixel_art}
                  size={34}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${meta.badge}`}>
                      #{idx + 1}
                    </span>
                    <span className="text-[10px] font-bold opacity-60 uppercase">
                      {s.branch}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs truncate">
                    {s.name || "Anonymous"}
                  </h3>
                  <p className="font-mono text-[10px] opacity-60">{s.usn}</p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className={`text-sm sm:text-base font-black ${isObsidian ? "text-amber-400" : "text-slate-900"}`}>
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
