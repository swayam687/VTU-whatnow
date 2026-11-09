"use client";

import React, { useState, useMemo } from "react";
import { Student, Mark, fetchStudent } from "../lib/api";
import { IconClose, IconCompare } from "./Icons";
import Identicon from "./Identicon";
import { sfx } from "../lib/sfx";

interface CompareModalProps {
  student1: Student;
  student2: Student;
  allStudents?: Student[];
  onClose: () => void;
  isObsidian?: boolean;
}

export default function CompareModal({
  student1: initialS1,
  student2: initialS2,
  allStudents = [],
  onClose,
  isObsidian = true,
}: CompareModalProps) {
  // Direct student states guaranteed to preserve cross-branch selections
  const [s1, setS1] = useState<Student>(initialS1);
  const [s2, setS2] = useState<Student>(initialS2);

  // Guarantee that initialS1 and initialS2 are always included in the dropdown options
  const selectableStudents = useMemo(() => {
    const map = new Map<string, Student>();
    if (initialS1) map.set(initialS1.usn, initialS1);
    if (initialS2) map.set(initialS2.usn, initialS2);
    if (s1) map.set(s1.usn, s1);
    if (s2) map.set(s2.usn, s2);
    allStudents.forEach((st) => {
      if (!map.has(st.usn)) map.set(st.usn, st);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allStudents, initialS1, initialS2, s1.usn, s2.usn]);

  const handleSelectS1 = async (usn: string) => {
    sfx.playMechanicalClick();
    const found = selectableStudents.find((st) => st.usn === usn);
    if (found) {
      if (found.marks && found.marks.length > 0) {
        setS1(found);
      } else {
        try {
          const full = await fetchStudent(usn);
          setS1(full);
        } catch {
          setS1(found);
        }
      }
    }
  };

  const handleSelectS2 = async (usn: string) => {
    sfx.playMechanicalClick();
    const found = selectableStudents.find((st) => st.usn === usn);
    if (found) {
      if (found.marks && found.marks.length > 0) {
        setS2(found);
      } else {
        try {
          const full = await fetchStudent(usn);
          setS2(full);
        } catch {
          setS2(found);
        }
      }
    }
  };

  // Build combined subject map
  const s1MarksMap = new Map<string, Mark>();
  (s1.marks || []).forEach((m) => s1MarksMap.set(m.subject_code.toUpperCase(), m));

  const s2MarksMap = new Map<string, Mark>();
  (s2.marks || []).forEach((m) => s2MarksMap.set(m.subject_code.toUpperCase(), m));

  const allSubjectCodes = Array.from(
    new Set([...Array.from(s1MarksMap.keys()), ...Array.from(s2MarksMap.keys())])
  );

  const pctDiff = s1.percentage - s2.percentage;
  const marksDiff = s1.total_marks - s2.total_marks;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div
        className={`rounded-t-3xl sm:rounded-3xl border shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 ${
          isObsidian
            ? "bg-[#0b0d11] border-slate-800 text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div
          className={`px-4 sm:px-6 py-3.5 sm:py-4 border-b flex items-center justify-between ${
            isObsidian ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950 flex items-center justify-center shadow-sm font-bold">
              <IconCompare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base leading-tight">Student Comparison</h2>
              <p className="text-[11px] opacity-60">Head-to-head subject breakdown and performance metrics</p>
            </div>
          </div>
          <button
            onClick={() => {
              sfx.playMechanicalClick();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          {/* Student Selector / Cards Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Student 1 Card */}
            <div
              className={`p-3.5 sm:p-4 rounded-2xl border ${
                isObsidian
                  ? "bg-cyan-950/15 border-cyan-800/40"
                  : "bg-blue-50/40 border-blue-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <Identicon
                  usn={s1.usn}
                  percentage={s1.percentage}
                  totalBacklogs={s1.total_backlogs}
                  size={42}
                />
                <div className="min-w-0 flex-1">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isObsidian
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    Student A
                  </span>
                  {selectableStudents.length > 0 ? (
                    <select
                      value={s1.usn}
                      onChange={(e) => handleSelectS1(e.target.value)}
                      className={`mt-1.5 block w-full text-xs font-bold rounded-xl p-2 border font-mono transition-colors ${
                        isObsidian
                          ? "bg-slate-900 border-slate-700 text-white"
                          : "bg-white border-slate-200 text-slate-900"
                      }`}
                    >
                      {selectableStudents.map((st) => (
                        <option key={st.usn} value={st.usn}>
                          {st.name} ({st.branch} • {st.usn})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <h3 className="font-bold text-sm mt-1 truncate">{s1.name}</h3>
                  )}
                  <p className="font-mono text-[11px] opacity-60 mt-0.5">{s1.usn} • {s1.branch}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg sm:text-xl font-black font-mono tabular-nums text-cyan-400">
                    {s1.percentage.toFixed(1)}%
                  </span>
                  <p className="text-[10px] opacity-60 font-mono">{s1.total_marks}/{s1.max_marks || 100} pts</p>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-800/40">
                <span className="opacity-70 text-[11px]">Backlogs Status:</span>
                <span
                  className={`font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                    s1.total_backlogs > 0
                      ? isObsidian
                        ? "bg-rose-950/30 text-rose-400 border-rose-800/40"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                      : isObsidian
                      ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/40"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {s1.total_backlogs === 0 ? "0 Backlogs" : `${s1.total_backlogs} Backlog(s)`}
                </span>
              </div>
            </div>

            {/* Student 2 Card */}
            <div
              className={`p-3.5 sm:p-4 rounded-2xl border ${
                isObsidian
                  ? "bg-indigo-950/15 border-indigo-800/40"
                  : "bg-indigo-50/40 border-indigo-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <Identicon
                  usn={s2.usn}
                  percentage={s2.percentage}
                  totalBacklogs={s2.total_backlogs}
                  size={42}
                />
                <div className="min-w-0 flex-1">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isObsidian
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    Student B
                  </span>
                  {selectableStudents.length > 0 ? (
                    <select
                      value={s2.usn}
                      onChange={(e) => handleSelectS2(e.target.value)}
                      className={`mt-1.5 block w-full text-xs font-bold rounded-xl p-2 border font-mono transition-colors ${
                        isObsidian
                          ? "bg-slate-900 border-slate-700 text-white"
                          : "bg-white border-slate-200 text-slate-900"
                      }`}
                    >
                      {selectableStudents.map((st) => (
                        <option key={st.usn} value={st.usn}>
                          {st.name} ({st.branch} • {st.usn})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <h3 className="font-bold text-sm mt-1 truncate">{s2.name}</h3>
                  )}
                  <p className="font-mono text-[11px] opacity-60 mt-0.5">{s2.usn} • {s2.branch}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg sm:text-xl font-black font-mono tabular-nums text-indigo-400">
                    {s2.percentage.toFixed(1)}%
                  </span>
                  <p className="text-[10px] opacity-60 font-mono">{s2.total_marks}/{s2.max_marks || 100} pts</p>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-800/40">
                <span className="opacity-70 text-[11px]">Backlogs Status:</span>
                <span
                  className={`font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                    s2.total_backlogs > 0
                      ? isObsidian
                        ? "bg-rose-950/30 text-rose-400 border-rose-800/40"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                      : isObsidian
                      ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/40"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {s2.total_backlogs === 0 ? "0 Backlogs" : `${s2.total_backlogs} Backlog(s)`}
                </span>
              </div>
            </div>
          </div>

          {/* Key Difference Overview Banner */}
          <div
            className={`p-3 rounded-2xl border flex flex-wrap items-center justify-around gap-2 text-center text-xs ${
              isObsidian
                ? "bg-slate-900/60 border-slate-800/80"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div>
              <p className="opacity-50 font-semibold uppercase tracking-wider text-[9px]">Percentage Delta</p>
              <p className="text-xs sm:text-sm font-bold mt-0.5 font-mono tabular-nums">
                {pctDiff > 0 ? (
                  <span className="text-cyan-400 font-bold">{s1.name} ahead by +{pctDiff.toFixed(1)}%</span>
                ) : pctDiff < 0 ? (
                  <span className="text-indigo-400 font-bold">{s2.name} ahead by +{Math.abs(pctDiff).toFixed(1)}%</span>
                ) : (
                  <span className="opacity-60">Identical Percentage</span>
                )}
              </p>
            </div>
            <div className="h-7 w-px bg-slate-800 hidden sm:block" />
            <div>
              <p className="opacity-50 font-semibold uppercase tracking-wider text-[9px]">Total Marks Delta</p>
              <p className="text-xs sm:text-sm font-bold mt-0.5 font-mono tabular-nums">
                {marksDiff > 0 ? (
                  <span className="text-cyan-400 font-bold">+{marksDiff} Marks (Student A)</span>
                ) : marksDiff < 0 ? (
                  <span className="text-indigo-400 font-bold">+{Math.abs(marksDiff)} Marks (Student B)</span>
                ) : (
                  <span className="opacity-60">Equal Total Score</span>
                )}
              </p>
            </div>
          </div>

          {/* Subject-by-Subject Deep Dive */}
          <div>
            <h3 className="font-bold text-xs sm:text-sm mb-2.5">
              Subject-by-Subject Breakdown ({allSubjectCodes.length} Subjects)
            </h3>

            {allSubjectCodes.length === 0 ? (
              <div
                className={`p-6 text-center text-xs border rounded-2xl ${
                  isObsidian ? "bg-slate-900/40 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
              >
                No subject marks records found for these students. Make sure both have results scraped.
              </div>
            ) : (
              <div
                className={`border rounded-2xl overflow-hidden divide-y ${
                  isObsidian
                    ? "border-slate-800 divide-slate-800/80"
                    : "border-slate-200 divide-slate-100"
                }`}
              >
                {/* Desktop Table Header */}
                <div
                  className={`hidden sm:grid grid-cols-12 gap-2 p-2.5 text-[10px] font-bold uppercase tracking-wider ${
                    isObsidian
                      ? "bg-slate-900/80 text-slate-400"
                      : "bg-slate-100/70 text-slate-500"
                  }`}
                >
                  <div className="col-span-5">Subject</div>
                  <div className="col-span-3 text-center text-cyan-400">{s1.name} (A)</div>
                  <div className="col-span-3 text-center text-indigo-400">{s2.name} (B)</div>
                  <div className="col-span-1 text-right">Lead</div>
                </div>

                {allSubjectCodes.map((code) => {
                  const m1 = s1MarksMap.get(code);
                  const m2 = s2MarksMap.get(code);
                  const subjectName = m1?.subject_name || m2?.subject_name || code;
                  const score1 = m1 ? m1.total : null;
                  const score2 = m2 ? m2.total : null;
                  const lead = score1 !== null && score2 !== null ? score1 - score2 : null;

                  return (
                    <div
                      key={code}
                      className={`p-3 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center transition-colors ${
                        isObsidian ? "hover:bg-slate-900/40" : "hover:bg-slate-50/60"
                      }`}
                    >
                      {/* Subject Name & Code */}
                      <div className="col-span-5 mb-2 sm:mb-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold">{code}</span>
                          {(m1?.semester || m2?.semester) && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded border ${
                                isObsidian
                                  ? "bg-slate-800 text-slate-400 border-slate-700"
                                  : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}
                            >
                              Sem {m1?.semester || m2?.semester}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] opacity-70 line-clamp-1">{subjectName}</p>
                      </div>

                      {/* Student 1 Marks */}
                      <div
                        className={`col-span-3 flex sm:flex-col items-center justify-between sm:justify-center p-2 sm:p-0 rounded-xl mb-1 sm:mb-0 ${
                          isObsidian
                            ? "bg-cyan-950/20 sm:bg-transparent"
                            : "bg-blue-50/50 sm:bg-transparent"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-cyan-400 sm:hidden">Student A:</span>
                        {m1 ? (
                          <div className="text-center font-mono tabular-nums">
                            <span className="font-bold text-xs sm:text-sm">{m1.total}</span>
                            <span className="text-[10px] opacity-50 ml-1">
                              (Int: {m1.internal_marks}, Ext: {m1.external_marks})
                            </span>
                            <span
                              className={`ml-1 text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                m1.status === "P"
                                  ? isObsidian ? "text-emerald-400 bg-emerald-950/40" : "text-emerald-700 bg-emerald-50"
                                  : isObsidian ? "text-rose-400 bg-rose-950/40" : "text-rose-700 bg-rose-50"
                              }`}
                            >
                              {m1.status}
                            </span>
                          </div>
                        ) : (
                          <span className="opacity-40 text-xs italic">—</span>
                        )}
                      </div>

                      {/* Student 2 Marks */}
                      <div
                        className={`col-span-3 flex sm:flex-col items-center justify-between sm:justify-center p-2 sm:p-0 rounded-xl mb-1 sm:mb-0 ${
                          isObsidian
                            ? "bg-indigo-950/20 sm:bg-transparent"
                            : "bg-indigo-50/50 sm:bg-transparent"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-indigo-400 sm:hidden">Student B:</span>
                        {m2 ? (
                          <div className="text-center font-mono tabular-nums">
                            <span className="font-bold text-xs sm:text-sm">{m2.total}</span>
                            <span className="text-[10px] opacity-50 ml-1">
                              (Int: {m2.internal_marks}, Ext: {m2.external_marks})
                            </span>
                            <span
                              className={`ml-1 text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                m2.status === "P"
                                  ? isObsidian ? "text-emerald-400 bg-emerald-950/40" : "text-emerald-700 bg-emerald-50"
                                  : isObsidian ? "text-rose-400 bg-rose-950/40" : "text-rose-700 bg-rose-50"
                              }`}
                            >
                              {m2.status}
                            </span>
                          </div>
                        ) : (
                          <span className="opacity-40 text-xs italic">—</span>
                        )}
                      </div>

                      {/* Lead Badge */}
                      <div className="col-span-1 text-right flex items-center justify-end font-mono tabular-nums">
                        {lead !== null ? (
                          lead > 0 ? (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isObsidian
                                  ? "text-cyan-300 bg-cyan-950/40 border-cyan-800/40"
                                  : "text-blue-700 bg-blue-100 border-blue-200"
                              }`}
                            >
                              +{lead} A
                            </span>
                          ) : lead < 0 ? (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isObsidian
                                  ? "text-indigo-300 bg-indigo-950/40 border-indigo-800/40"
                                  : "text-indigo-700 bg-indigo-100 border-indigo-200"
                              }`}
                            >
                              +{Math.abs(lead)} B
                            </span>
                          ) : (
                            <span className="text-[10px] opacity-40 font-medium">Tie</span>
                          )
                        ) : (
                          <span className="opacity-30">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`px-4 sm:px-6 py-3 border-t flex justify-end ${
            isObsidian ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-100"
          }`}
        >
          <button
            onClick={() => {
              sfx.playMechanicalClick();
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-sm transition-all"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}
