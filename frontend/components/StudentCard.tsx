"use client";

import React from "react";
import { Student } from "../lib/api";
import { IconGitHub, IconLinkedIn, IconCompare } from "./Icons";

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

  return (
    <div
      className={`group relative bg-white rounded-3xl border transition-all flex flex-col justify-between p-4 sm:p-5 shadow-sm hover:shadow-md ${
        isSelectedForCompare
          ? "border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/10"
          : "border-slate-200/90 hover:border-slate-300"
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpenDetail}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase tracking-wider">
                {student.branch || "ENG"}
              </span>
              {rank !== undefined && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200/60">
                  #{rank}
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug truncate group-hover:text-blue-600 transition-colors">
              {student.name || "Unknown Student"}
            </h3>
            <p className="font-mono text-xs text-slate-400 mt-0.5 tracking-wider">
              {student.usn}
            </p>
          </div>

          {/* Compare Checkbox / Toggle */}
          {onToggleCompare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCompare();
              }}
              title={isSelectedForCompare ? "Remove from comparison" : "Add to comparison"}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isSelectedForCompare
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              <IconCompare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isSelectedForCompare ? "Added" : "Compare"}</span>
            </button>
          )}
        </div>

        {/* Stats Row */}
        <div
          onClick={onOpenDetail}
          className="grid grid-cols-2 gap-2 my-3 p-3 rounded-2xl bg-slate-50/80 border border-slate-100 cursor-pointer text-center"
        >
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Score</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              {student.total_marks}
              <span className="text-[10px] text-slate-400 font-normal ml-0.5">/{student.max_marks || 100}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Percentage</p>
            <p className="text-sm font-black text-blue-600 mt-0.5">
              {student.percentage.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Footer / Social Badges & Detail hint */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
        <span
          className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ${
            hasBacklogs
              ? "bg-rose-50 text-rose-700 border border-rose-200/60"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
          }`}
        >
          {hasBacklogs ? `${student.total_backlogs} Backlog${student.total_backlogs > 1 ? "s" : ""}` : "Clear"}
        </span>

        {/* Read-only Social Links for Visitors */}
        <div className="flex items-center gap-1.5">
          {student.github_url && (
            <a
              href={student.github_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="View GitHub Profile"
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <IconGitHub className="w-3.5 h-3.5" />
            </a>
          )}
          {student.linkedin_url && (
            <a
              href={student.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="View LinkedIn Profile"
              className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
            >
              <IconLinkedIn className="w-3.5 h-3.5" />
            </a>
          )}
          <span
            onClick={onOpenDetail}
            className="text-[11px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer ml-1"
          >
            Marks →
          </span>
        </div>
      </div>
    </div>
  );
}
