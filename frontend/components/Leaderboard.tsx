"use client";

import React from "react";
import { Student } from "../lib/api";
import { IconTrophy } from "./Icons";
import CryptographicAvatar from "./CryptographicAvatar";
import { sfx } from "../lib/sfx";

interface LeaderboardProps {
  toppers: Student[];
  branch: string;
  onSelectStudent: (student: Student) => void;
}

export default function Leaderboard({ toppers, branch, onSelectStudent }: LeaderboardProps) {
  if (!toppers.length) return null;

  const topThree = toppers.slice(0, 3);

  const handleSelect = (s: Student) => {
    sfx.playSonar();
    onSelectStudent(s);
  };

  return (
    <div className="bg-[#0c1015]/90 backdrop-blur-sm rounded-3xl border border-amber-500/30 p-5 sm:p-6 shadow-[0_0_30px_rgba(245,158,11,0.06)] mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <IconTrophy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-mono font-bold text-slate-100 text-sm sm:text-base flex items-center gap-2">
              <span>{branch === "ALL" ? "CAMPUS APEX DOSSIERS" : `${branch} APEX TOPPERS`}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/60 uppercase">
                RANK 1-3
              </span>
            </h2>
            <p className="font-mono text-[11px] text-slate-400">
              Ranked by aggregate raw score &amp; precision percentage
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-block font-mono text-[11px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2.5 py-1 rounded-full animate-pulse">
          TOP FLIGHT
        </span>
      </div>

      {/* Podium Cards for Top 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {topThree.map((s, idx) => {
          const rankMeta = [
            {
              label: "RANK 1 // GOLD",
              badgeBg: "bg-amber-950/80 text-amber-300 border-amber-500/60",
              cardBorder: "border-amber-500/40 hover:border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]",
              glow: "bg-amber-950/20",
            },
            {
              label: "RANK 2 // SILVER",
              badgeBg: "bg-cyan-950/80 text-cyan-300 border-cyan-500/60",
              cardBorder: "border-cyan-500/30 hover:border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.1)]",
              glow: "bg-cyan-950/15",
            },
            {
              label: "RANK 3 // BRONZE",
              badgeBg: "bg-purple-950/80 text-purple-300 border-purple-500/60",
              cardBorder: "border-purple-500/30 hover:border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)]",
              glow: "bg-purple-950/15",
            },
          ];
          const meta = rankMeta[idx] || rankMeta[1];

          return (
            <div
              key={s.usn}
              onClick={() => handleSelect(s)}
              className={`p-4 rounded-2xl border ${meta.cardBorder} ${meta.glow} flex items-center justify-between gap-3 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.99] font-mono`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <CryptographicAvatar usn={s.usn} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${meta.badgeBg}`}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {s.branch}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm truncate">{s.name}</h3>
                  <p className="text-[10px] text-cyan-400/80 mt-0.5">{s.usn}</p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-base sm:text-lg font-black text-cyan-400 block drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]">
                  {s.percentage.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-400 font-medium block">
                  {s.total_marks} PTS
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
