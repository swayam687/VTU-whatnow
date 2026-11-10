"use client";

import React, { useState, useMemo } from "react";
import { Student } from "../lib/api";
import { IconCompare, IconSortAsc, IconSortDesc, IconCheck } from "./Icons";
import Identicon from "./Identicon";
import { sfx } from "../lib/sfx";

type SortField = "rank" | "usn" | "name" | "branch" | "total_marks" | "percentage" | "total_backlogs";
type SortOrder = "asc" | "desc";

interface DenseStudentTableProps {
  students: Student[];
  compareUsns: string[];
  onToggleCompare: (usn: string) => void;
  onOpenDetail: (usn: string) => void;
  myUsn?: string;
  isObsidian?: boolean;
}

export default function DenseStudentTable({
  students,
  compareUsns,
  onToggleCompare,
  onOpenDetail,
  myUsn = "",
  isObsidian = false,
}: DenseStudentTableProps) {
  const [sortField, setSortField] = useState<SortField>("percentage");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    sfx.playMechanicalClick();
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "name" || field === "usn" || field === "branch" ? "asc" : "desc");
    }
  };

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;

      switch (sortField) {
        case "usn":
          valA = a.usn.toUpperCase();
          valB = b.usn.toUpperCase();
          break;
        case "name":
          valA = (a.name || "").toLowerCase();
          valB = (b.name || "").toLowerCase();
          break;
        case "branch":
          valA = a.branch.toUpperCase();
          valB = b.branch.toUpperCase();
          break;
        case "total_marks":
          valA = a.total_marks;
          valB = b.total_marks;
          break;
        case "total_backlogs":
          valA = a.total_backlogs;
          valB = b.total_backlogs;
          break;
        case "percentage":
        case "rank":
        default:
          valA = a.percentage;
          valB = b.percentage;
          break;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [students, sortField, sortOrder]);

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <IconSortAsc className="w-3 h-3 text-slate-900 dark:text-white shrink-0 inline ml-1" />
    ) : (
      <IconSortDesc className="w-3 h-3 text-slate-900 dark:text-white shrink-0 inline ml-1" />
    );
  };

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all shadow-xs ${
        isObsidian
          ? "bg-[#0d1117] border-white/10 text-slate-100"
          : "bg-white border-slate-200/90 text-slate-900"
      }`}
    >
      {/* Mobile Swipe Hint */}
      <div className="sm:hidden px-3.5 py-1.5 border-b border-inherit text-[11px] text-slate-400 flex items-center justify-between">
        <span>← Swipe horizontally to view full metrics →</span>
        <span className="font-mono">{sortedStudents.length} rows</span>
      </div>

      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr
              className={`border-b text-[11px] font-semibold select-none sticky top-0 z-10 transition-colors ${
                isObsidian
                  ? "bg-[#111622] border-white/10 text-slate-300"
                  : "bg-slate-50 border-slate-200 text-slate-600"
              }`}
            >
              <th
                onClick={() => handleSort("rank")}
                className="py-3 px-3 w-14 text-center cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center justify-center gap-0.5">
                  <span>#</span>
                  {renderSortIndicator("rank")}
                </div>
              </th>

              <th
                onClick={() => handleSort("usn")}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-0.5">
                  <span>USN</span>
                  {renderSortIndicator("usn")}
                </div>
              </th>

              <th
                onClick={() => handleSort("name")}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors min-w-[140px]"
              >
                <div className="flex items-center gap-0.5">
                  <span>Student Name</span>
                  {renderSortIndicator("name")}
                </div>
              </th>

              <th
                onClick={() => handleSort("branch")}
                className="py-3 px-2 text-center cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors w-20"
              >
                <div className="flex items-center justify-center gap-0.5">
                  <span>Branch</span>
                  {renderSortIndicator("branch")}
                </div>
              </th>

              <th
                onClick={() => handleSort("total_marks")}
                className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors hidden md:table-cell"
              >
                <div className="flex items-center justify-end gap-0.5">
                  <span>Score</span>
                  {renderSortIndicator("total_marks")}
                </div>
              </th>

              <th
                onClick={() => handleSort("percentage")}
                className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors w-24"
              >
                <div className="flex items-center justify-end gap-0.5">
                  <span>Score %</span>
                  {renderSortIndicator("percentage")}
                </div>
              </th>

              <th
                onClick={() => handleSort("total_backlogs")}
                className="py-3 px-3 text-center cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors w-24"
              >
                <div className="flex items-center justify-center gap-0.5">
                  <span>Backlogs</span>
                  {renderSortIndicator("total_backlogs")}
                </div>
              </th>

              <th className="py-3 px-3 text-center w-24">
                <span>Compare</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
            {sortedStudents.map((s, index) => {
              const isSelected = compareUsns.includes(s.usn);
              const isMyProfile = myUsn && s.usn.toUpperCase() === myUsn.toUpperCase();
              const hasBacklogs = s.total_backlogs > 0;
              const rankNumber = index + 1;

              return (
                <tr
                  key={s.usn}
                  onClick={() => onOpenDetail(s.usn)}
                  className={`cursor-pointer transition-colors group ${
                    isMyProfile
                      ? isObsidian
                        ? "bg-amber-950/20 hover:bg-amber-950/30"
                        : "bg-amber-50/50 hover:bg-amber-50/80"
                      : isSelected
                      ? isObsidian
                        ? "bg-blue-950/20 hover:bg-blue-950/30"
                        : "bg-blue-50/40 hover:bg-blue-50/70"
                      : isObsidian
                      ? "hover:bg-white/[0.03]"
                      : "hover:bg-slate-50/80"
                  }`}
                >
                  {/* Rank Column */}
                  <td className="py-2.5 px-3 text-center text-xs">
                    {rankNumber === 1 ? (
                      <span className="w-5 h-5 rounded-full inline-flex items-center justify-center font-bold bg-amber-500 text-slate-950 text-[10px]">
                        1
                      </span>
                    ) : rankNumber === 2 ? (
                      <span className="w-5 h-5 rounded-full inline-flex items-center justify-center font-bold bg-slate-300 dark:bg-slate-600 text-slate-900 dark:text-white text-[10px]">
                        2
                      </span>
                    ) : rankNumber === 3 ? (
                      <span className="w-5 h-5 rounded-full inline-flex items-center justify-center font-bold bg-amber-700/80 text-white text-[10px]">
                        3
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs font-semibold">
                        {rankNumber}
                      </span>
                    )}
                  </td>

                  {/* USN with Avatar */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <Identicon
                        usn={s.usn}
                        name={s.name}
                        percentage={s.percentage}
                        totalBacklogs={s.total_backlogs}
                        size={22}
                      />
                      <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:underline">
                        {s.usn}
                      </span>
                      {isMyProfile && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500 text-slate-950">
                          You
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Student Name */}
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px] sm:max-w-[240px]">
                    {s.name || "Anonymous Student"}
                  </td>

                  {/* Branch */}
                  <td className="py-2.5 px-2 text-center">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        isObsidian
                          ? "bg-white/5 border-white/10 text-slate-300"
                          : "bg-slate-100 border-slate-200 text-slate-700"
                      }`}
                    >
                      {s.branch || "ENG"}
                    </span>
                  </td>

                  {/* Total Marks */}
                  <td className="py-2.5 px-3 text-right text-slate-500 dark:text-slate-400 tabular-nums hidden md:table-cell">
                    {s.total_marks > 0 ? `${s.total_marks} / ${s.max_marks || 800}` : "—"}
                  </td>

                  {/* Percentage Score */}
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`font-bold tabular-nums text-sm ${
                        s.percentage >= 80
                          ? "text-emerald-600 dark:text-emerald-400"
                          : s.percentage >= 60
                          ? "text-slate-900 dark:text-slate-100"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {s.percentage.toFixed(1)}%
                    </span>
                  </td>

                  {/* Backlogs */}
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        hasBacklogs
                          ? isObsidian
                            ? "bg-rose-950/40 text-rose-300 border-rose-800/40"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                          : isObsidian
                          ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/40"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {hasBacklogs ? `${s.total_backlogs} BL` : "Pass"}
                    </span>
                  </td>

                  {/* Compare Action */}
                  <td
                    className="py-2.5 px-3 text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCompare(s.usn);
                    }}
                  >
                    <button
                      type="button"
                      title={isSelected ? "Remove from comparison" : "Add to comparison"}
                      className={`p-1.5 rounded-lg border transition-all ${
                        isSelected
                          ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900"
                          : isObsidian
                          ? "border-white/10 text-slate-400 hover:text-white hover:border-white/20"
                          : "border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300"
                      }`}
                    >
                      {isSelected ? (
                        <IconCheck className="w-3 h-3 stroke-[2.5]" />
                      ) : (
                        <IconCompare className="w-3 h-3" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
