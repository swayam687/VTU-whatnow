"use client";

import React from "react";
import { Student } from "../lib/api";
import { IconGitHub, IconLinkedIn, IconCompare } from "./Icons";
import Identicon from "./Identicon";
import { sfx } from "../lib/sfx";

interface StudentCardProps {
  student: Student;
  rank?: number;
  isSelectedForCompare?: boolean;
  onToggleCompare?: () => void;
  onOpenDetail: () => void;
  isObsidian?: boolean;
}

export default function StudentCard({
  student,
  rank,
  isSelectedForCompare = false,
  onToggleCompare,
  onOpenDetail,
  isObsidian = false,
}: StudentCardProps) {
  const hasBacklogs = student.total_backlogs > 0;
  const isTopper = student.percentage >= 80 && !hasBacklogs;

  return (
    <div
      className={`group relative rounded-3xl border transition-all flex flex-col justify-between p-4 sm:p-5 font-mono ${
        isObsidian
          ? isSelectedForCompare
            ? "bg-[#0f1115] border-cyan-400 ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-500/10 text-white"
            : "bg-[#0d0f12] border-slate-800 hover:border-slate-700 text-white shadow-sm hover:shadow-cyan-950/20"
          : isSelectedForCompare
          ? "bg-blue-50/20 border-blue-600 ring-2 ring-blue-500/20 text-slate-900 shadow-sm"
          : "bg-white border-slate-200/90 hover:border-slate-300 text-slate-900 shadow-sm hover:shadow-md"
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer"
            onClick={() => {
              if (isTopper) sfx.playSonarChime();
              else sfx.playMechanicalClick();
              onOpenDetail();
            }}
          >
            {/* Algorithmic Cryptographic Dossier Avatar */}
            <Identicon
              usn={student.usn}
              name={student.name}
              percentage={student.percentage}
              totalBacklogs={student.total_backlogs}
              size={42}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    isObsidian
                      ? "bg-slate-800 text-cyan-400 border border-slate-700"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {student.branch || "ENG"}
                </span>
                {rank !== undefined && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                      rank === 1
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : isObsidian
                        ? "bg-slate-800 text-amber-400 border-slate-700"
                        : "bg-amber-100 text-amber-900 border-amber-200"
                    }`}
                  >
                    #{rank}
                  </span>
                )}
                {isTopper && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    TOPPER
                  </span>
                )}
              </div>

              <h3 className="font-bold text-xs sm:text-sm leading-snug truncate group-hover:text-cyan-400 transition-colors">
                {student.name || "Anonymous Student"}
              </h3>
              <p className="font-mono text-[11px] opacity-60 mt-0.5 tracking-wider">
                {student.usn}
              </p>
            </div>
          </div>

          {/* Compare Toggle */}
          {onToggleCompare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                sfx.playMechanicalClick();
                onToggleCompare();
              }}
              title={isSelectedForCompare ? "Remove from comparison" : "Add to comparison"}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isSelectedForCompare
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/40"
                  : isObsidian
                  ? "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <IconCompare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[10px] uppercase tracking-wider">
                {isSelectedForCompare ? "Added" : "Compare"}
              </span>
            </button>
          )}
        </div>

        {/* Stats Matrix Row */}
        <div
          onClick={() => {
            sfx.playMechanicalClick();
            onOpenDetail();
          }}
          className={`grid grid-cols-2 gap-2 my-3 p-3 rounded-2xl cursor-pointer text-center border ${
            isObsidian
              ? "bg-slate-900/60 border-slate-800/80"
              : "bg-slate-50 border-slate-100"
          }`}
        >
          <div>
            <p className="text-[9px] uppercase font-bold opacity-50 tracking-wider">Marks Total</p>
            <p className="text-sm font-bold mt-0.5">
              {student.total_marks}
              <span className="text-[10px] opacity-50 font-normal ml-0.5">
                /{student.max_marks || 100}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold opacity-50 tracking-wider">Percentage</p>
            <p
              className={`text-sm font-black mt-0.5 ${
                isTopper
                  ? "text-amber-400"
                  : student.percentage >= 60
                  ? "text-cyan-400"
                  : "text-rose-400"
              }`}
            >
              {student.percentage.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Footer / Status & Socials */}
      <div className="pt-2.5 border-t border-slate-800/50 flex items-center justify-between gap-2 text-xs">
        <span
          className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
            hasBacklogs
              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          }`}
        >
          {hasBacklogs ? `${student.total_backlogs} Backlog${student.total_backlogs > 1 ? "s" : ""}` : "All Clear"}
        </span>

        {/* Social Links */}
        <div className="flex items-center gap-1 text-slate-400">
          {student.github_url && (
            <a
              href={student.github_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                sfx.playMechanicalClick();
              }}
              title="GitHub Profile"
              className="p-1 hover:text-cyan-400 transition-colors"
            >
              <IconGitHub className="w-3.5 h-3.5" />
            </a>
          )}
          {student.linkedin_url && (
            <a
              href={student.linkedin_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                sfx.playMechanicalClick();
              }}
              title="LinkedIn Profile"
              className="p-1 hover:text-cyan-400 transition-colors"
            >
              <IconLinkedIn className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
