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
  isMyProfile?: boolean;
}

export default function StudentCard({
  student,
  rank,
  isSelectedForCompare = false,
  onToggleCompare,
  onOpenDetail,
  isObsidian = false,
  isMyProfile = false,
}: StudentCardProps) {
  const hasBacklogs = student.total_backlogs > 0;
  const isTopper = student.percentage >= 80 && !hasBacklogs;

  return (
    <>
      {/* ============================================================ */}
      {/* MOBILE COMPACT ROW LAYOUT (< sm screens)                     */}
      {/* High-density, touch-friendly list item                       */}
      {/* ============================================================ */}
      <div
        onClick={() => {
          if (isTopper) sfx.playSonarChime();
          else sfx.playMechanicalClick();
          onOpenDetail();
        }}
        className={`sm:hidden group relative rounded-2xl border transition-all p-3 flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99] ${
          isObsidian
            ? isSelectedForCompare
              ? "bg-[#0f1115] border-cyan-400 ring-2 ring-cyan-500/30 text-white shadow-md shadow-cyan-950/20"
              : isMyProfile
              ? "bg-amber-950/20 border-amber-500/50 text-white"
              : "bg-[#0c0e12] border-slate-800/90 text-white"
            : isSelectedForCompare
            ? "bg-blue-50/40 border-blue-600 ring-2 ring-blue-500/20 text-slate-900 shadow-sm"
            : isMyProfile
            ? "bg-amber-50/50 border-amber-300 text-slate-900"
            : "bg-white border-slate-200/90 text-slate-900 shadow-sm"
        }`}
      >
        {/* Left: Avatar + Identity */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Identicon
            usn={student.usn}
            name={student.name}
            percentage={student.percentage}
            totalBacklogs={student.total_backlogs}
            size={34}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                  isObsidian
                    ? "bg-slate-800 text-slate-300 border border-slate-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {student.branch || "ENG"}
              </span>
              {rank !== undefined && (
                <span
                  className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border font-mono ${
                    rank === 1
                      ? isObsidian
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        : "bg-amber-100 text-amber-800 border-amber-200"
                      : isObsidian
                      ? "bg-slate-800 text-slate-300 border-slate-700"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  #{rank}
                </span>
              )}
              {isMyProfile && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500 text-slate-950">
                  You
                </span>
              )}
            </div>
            <h3 className="font-bold text-xs leading-snug truncate mt-0.5">
              {student.name || "Anonymous Student"}
            </h3>
            <p className="font-mono text-[10px] opacity-60 tracking-wider">
              {student.usn}
            </p>
          </div>
        </div>

        {/* Right: Metrics + Compare Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div
              className={`text-sm font-black font-mono tabular-nums leading-none ${
                isTopper
                  ? isObsidian ? "text-amber-400" : "text-amber-600"
                  : student.percentage >= 60
                  ? isObsidian ? "text-cyan-400" : "text-blue-600"
                  : "text-rose-500"
              }`}
            >
              {student.percentage.toFixed(1)}%
            </div>
            <div className="mt-1">
              <span
                className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                  hasBacklogs
                    ? isObsidian
                      ? "bg-rose-950/30 text-rose-400 border-rose-800/40"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                    : isObsidian
                    ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/40"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {hasBacklogs ? `${student.total_backlogs} BL` : "Clear"}
              </span>
            </div>
          </div>

          {onToggleCompare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                sfx.playMechanicalClick();
                onToggleCompare();
              }}
              title={isSelectedForCompare ? "Remove from comparison" : "Add to comparison"}
              className={`p-2 rounded-xl text-xs transition-all ${
                isSelectedForCompare
                  ? isObsidian
                    ? "bg-cyan-500 text-slate-950 font-bold"
                    : "bg-blue-600 text-white font-bold"
                  : isObsidian
                  ? "bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <IconCompare className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* DESKTOP RICH CARD VIEW (>= sm screens)                       */}
      {/* Comprehensive multi-metric card with dual stats & socials    */}
      {/* ============================================================ */}
      <div
        className={`hidden sm:flex group relative rounded-3xl border transition-all flex-col justify-between p-4.5 ${
          isObsidian
            ? isSelectedForCompare
              ? "bg-[#0f1115] border-cyan-400 ring-2 ring-cyan-500/30 text-white shadow-md shadow-cyan-950/20"
              : isMyProfile
              ? "bg-amber-950/15 border-amber-500/50 text-white"
              : "bg-[#0c0e12] border-slate-800/90 hover:border-slate-700 text-white shadow-sm"
            : isSelectedForCompare
            ? "bg-blue-50/30 border-blue-600 ring-2 ring-blue-500/20 text-slate-900 shadow-sm"
            : isMyProfile
            ? "bg-amber-50/40 border-amber-300 text-slate-900"
            : "bg-white border-slate-200/90 hover:border-slate-300 text-slate-900 shadow-sm hover:shadow-md"
        }`}
      >
        {/* Top Header */}
        <div>
          <div className="flex items-start justify-between gap-2.5">
            <div
              className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer"
              onClick={() => {
                if (isTopper) sfx.playSonarChime();
                else sfx.playMechanicalClick();
                onOpenDetail();
              }}
            >
              {/* Procedural Identicon */}
              <Identicon
                usn={student.usn}
                name={student.name}
                percentage={student.percentage}
                totalBacklogs={student.total_backlogs}
                size={38}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.2 rounded-full uppercase tracking-wider ${
                      isObsidian
                        ? "bg-slate-800 text-slate-300 border border-slate-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {student.branch || "ENG"}
                  </span>
                  {rank !== undefined && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded border font-mono ${
                        rank === 1
                          ? isObsidian
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : "bg-amber-100 text-amber-800 border-amber-200"
                          : isObsidian
                          ? "bg-slate-800 text-slate-300 border-slate-700"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      #{rank}
                    </span>
                  )}
                  {isTopper && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                        isObsidian
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      Topper
                    </span>
                  )}
                  {isMyProfile && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500 text-slate-950">
                      You
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-sm leading-snug truncate group-hover:text-blue-500 transition-colors">
                  {student.name || "Anonymous Student"}
                </h3>
                <p className="font-mono text-[11px] opacity-50 mt-0.5 tracking-wider">
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
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                  isSelectedForCompare
                    ? isObsidian
                      ? "bg-cyan-500 text-slate-950 font-bold"
                      : "bg-blue-600 text-white font-bold"
                    : isObsidian
                    ? "bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <IconCompare className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-bold">
                  {isSelectedForCompare ? "Added" : "Compare"}
                </span>
              </button>
            )}
          </div>

          {/* Stats Row */}
          <div
            onClick={() => {
              sfx.playMechanicalClick();
              onOpenDetail();
            }}
            className={`grid grid-cols-2 gap-2 my-2.5 p-2.5 rounded-2xl cursor-pointer text-center border ${
              isObsidian
                ? "bg-slate-900/50 border-slate-800/70"
                : "bg-slate-50 border-slate-100"
            }`}
          >
            <div>
              <p className="text-[9px] uppercase font-semibold opacity-50 tracking-wider">Total Marks</p>
              <p className="text-sm font-bold mt-0.5 font-mono tabular-nums">
                {student.total_marks}
                <span className="text-[10px] opacity-40 font-normal ml-0.5">
                  /{student.max_marks || 100}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase font-semibold opacity-50 tracking-wider">Percentage</p>
              <p
                className={`text-sm font-black mt-0.5 font-mono tabular-nums ${
                  isTopper
                    ? isObsidian ? "text-amber-400" : "text-amber-600"
                    : student.percentage >= 60
                    ? isObsidian ? "text-cyan-400" : "text-blue-600"
                    : "text-rose-500"
                }`}
              >
                {student.percentage.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Footer / Status & Socials */}
        <div className="pt-2 border-t border-slate-800/30 flex items-center justify-between gap-2 text-xs">
          <span
            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              hasBacklogs
                ? isObsidian
                  ? "bg-rose-950/30 text-rose-400 border-rose-800/40"
                  : "bg-rose-50 text-rose-700 border-rose-200"
                : isObsidian
                ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/40"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            {hasBacklogs ? `${student.total_backlogs} Backlog${student.total_backlogs > 1 ? "s" : ""}` : "All Clear"}
          </span>

          {/* Social Links */}
          <div className="flex items-center gap-1 opacity-70">
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
                className="p-1 hover:text-blue-500 transition-colors"
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
                className="p-1 hover:text-blue-500 transition-colors"
              >
                <IconLinkedIn className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
