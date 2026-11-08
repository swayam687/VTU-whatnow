"use client";

import React from "react";
import { Student } from "../lib/api";
import { IconGitHub, IconLinkedIn, IconCompare } from "./Icons";
import CryptographicAvatar from "./CryptographicAvatar";
import { sfx } from "../lib/sfx";

interface StudentCardProps {
  student: Student;
  rank?: number;
  isSelectedForCompare?: boolean;
  onToggleCompare?: () => void;
  onOpenDetail: () => void;
}

export default function StudentCard({
  student,
  rank,
  isSelectedForCompare = false,
  onToggleCompare,
  onOpenDetail,
}: StudentCardProps) {
  const hasBacklogs = student.total_backlogs > 0;
  const isTopper = (student.percentage || 0) >= 80;

  const handleCardClick = () => {
    if (isTopper) {
      sfx.playSonar();
    } else {
      sfx.playClick();
    }
    onOpenDetail();
  };

  return (
    <div
      className={`group relative bg-[#0c1015]/90 backdrop-blur-sm rounded-3xl border transition-all duration-300 flex flex-col justify-between p-4 sm:p-5 shadow-sm hover:shadow-[0_0_25px_rgba(0,240,255,0.12)] ${
        isSelectedForCompare
          ? "border-cyan-400 ring-2 ring-cyan-500/30 bg-cyan-950/20 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
          : "border-slate-800/90 hover:border-cyan-500/50"
      }`}
    >
      {/* Top Header with Cryptographic Identicon */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer"
            onClick={handleCardClick}
          >
            {/* Algorithmic Procedural Avatar */}
            <CryptographicAvatar usn={student.usn} size={42} showSignature={false} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-900 text-cyan-400 border border-cyan-900/60 uppercase tracking-wider">
                  {student.branch || "ENG"}
                </span>
                {rank !== undefined && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    #{rank}
                  </span>
                )}
                {isTopper && (
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50 animate-pulse">
                    TOPPER
                  </span>
                )}
              </div>

              <h3 className="font-bold text-slate-100 text-sm sm:text-base leading-snug truncate group-hover:text-cyan-400 transition-colors">
                {student.name || "Classified Student"}
              </h3>
              <p className="font-mono text-xs text-slate-400 mt-0.5 tracking-wider">
                {student.usn}
              </p>
            </div>
          </div>

          {/* Compare Checkbox / Toggle with SFX */}
          {onToggleCompare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                sfx.playClick();
                onToggleCompare();
              }}
              title={isSelectedForCompare ? "Remove from compare" : "Add to compare"}
              className={`p-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all border ${
                isSelectedForCompare
                  ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                  : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-cyan-300 hover:border-slate-700"
              }`}
            >
              <IconCompare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isSelectedForCompare ? "ADDED" : "COMPARE"}</span>
            </button>
          )}
        </div>

        {/* Stats Row */}
        <div
          onClick={handleCardClick}
          className="grid grid-cols-2 gap-2 my-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 cursor-pointer text-center font-mono"
        >
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">AGGREGATE</p>
            <p className="text-sm font-bold text-slate-200 mt-0.5">
              {student.total_marks}
              <span className="text-[10px] text-slate-400 font-normal ml-0.5">/{student.max_marks || 100}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">SCORE</p>
            <p className="text-sm font-black text-cyan-400 mt-0.5 drop-shadow-[0_0_8px_rgba(0,240,255,0.3)]">
              {student.percentage.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Footer / Social Badges & Detail hint */}
      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs font-mono">
        <span
          className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            hasBacklogs
              ? "bg-rose-950/40 text-rose-400 border-rose-800/60"
              : "bg-emerald-950/40 text-emerald-400 border-emerald-800/60"
          }`}
        >
          {hasBacklogs ? `${student.total_backlogs} BACKLOG${student.total_backlogs > 1 ? "S" : ""}` : "STATUS: CLEAR"}
        </span>

        {/* Read-only Social Links for Visitors */}
        <div className="flex items-center gap-1.5">
          {student.github_url && (
            <a
              href={student.github_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                sfx.playClick();
              }}
              title="View GitHub Profile"
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
            >
              <IconGitHub className="w-3.5 h-3.5" />
            </a>
          )}
          {student.linkedin_url && (
            <a
              href={student.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                sfx.playClick();
              }}
              title="View LinkedIn Profile"
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
            >
              <IconLinkedIn className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={handleCardClick}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold ml-1 flex items-center gap-1"
          >
            DOSSIER →
          </button>
        </div>
      </div>
    </div>
  );
}
