"use client";

import React, { useState } from "react";
import { Student, Mark } from "../lib/api";
import { IconClose, IconCompare, IconCheck } from "./Icons";

interface CompareModalProps {
  student1: Student;
  student2: Student;
  allStudents?: Student[];
  onClose: () => void;
  onSelectStudent1?: (s: Student) => void;
  onSelectStudent2?: (s: Student) => void;
}

export default function CompareModal({
  student1: initialS1,
  student2: initialS2,
  allStudents = [],
  onClose,
}: CompareModalProps) {
  const [s1Usn, setS1Usn] = useState(initialS1.usn);
  const [s2Usn, setS2Usn] = useState(initialS2.usn);

  const s1 = allStudents.find((s) => s.usn === s1Usn) || initialS1;
  const s2 = allStudents.find((s) => s.usn === s2Usn) || initialS2;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <IconCompare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base sm:text-lg">Student Marks Comparison</h2>
              <p className="text-xs text-slate-500">Head-to-head subject breakdown and performance metrics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">

          {/* Student Selector / Cards Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Student 1 Card */}
            <div className="p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/30">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 px-2 py-0.5 rounded-full bg-blue-100">
                    Student A
                  </span>
                  {allStudents.length > 0 ? (
                    <select
                      value={s1Usn}
                      onChange={(e) => setS1Usn(e.target.value)}
                      className="mt-2 block w-full text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-2 focus:ring-2 focus:ring-blue-500"
                    >
                      {allStudents.map((s) => (
                        <option key={s.usn} value={s.usn}>
                          {s.name} ({s.usn})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <h3 className="font-bold text-slate-900 text-base mt-1 truncate">{s1.name}</h3>
                  )}
                  <p className="font-mono text-xs text-slate-500 mt-0.5">{s1.usn} • {s1.branch}</p>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-blue-600">
                    {s1.percentage.toFixed(1)}%
                  </span>
                  <p className="text-[11px] text-slate-500">{s1.total_marks}/{s1.max_marks || 100} pts</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-blue-100">
                <span className="text-slate-600 font-medium">Backlogs Status:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-full ${
                    s1.total_backlogs > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {s1.total_backlogs === 0 ? "0 Backlogs" : `${s1.total_backlogs} Backlog(s)`}
                </span>
              </div>
            </div>

            {/* Student 2 Card */}
            <div className="p-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/30">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 px-2 py-0.5 rounded-full bg-indigo-100">
                    Student B
                  </span>
                  {allStudents.length > 0 ? (
                    <select
                      value={s2Usn}
                      onChange={(e) => setS2Usn(e.target.value)}
                      className="mt-2 block w-full text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-2 focus:ring-2 focus:ring-indigo-500"
                    >
                      {allStudents.map((s) => (
                        <option key={s.usn} value={s.usn}>
                          {s.name} ({s.usn})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <h3 className="font-bold text-slate-900 text-base mt-1 truncate">{s2.name}</h3>
                  )}
                  <p className="font-mono text-xs text-slate-500 mt-0.5">{s2.usn} • {s2.branch}</p>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-indigo-600">
                    {s2.percentage.toFixed(1)}%
                  </span>
                  <p className="text-[11px] text-slate-500">{s2.total_marks}/{s2.max_marks || 100} pts</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-indigo-100">
                <span className="text-slate-600 font-medium">Backlogs Status:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-full ${
                    s2.total_backlogs > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {s2.total_backlogs === 0 ? "0 Backlogs" : `${s2.total_backlogs} Backlog(s)`}
                </span>
              </div>
            </div>
          </div>

          {/* Key Difference Overview Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-around gap-3 text-center text-xs">
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Percentage Delta</p>
              <p className="text-sm font-bold mt-0.5">
                {pctDiff > 0 ? (
                  <span className="text-blue-600 font-bold">{s1.name} ahead by +{pctDiff.toFixed(1)}%</span>
                ) : pctDiff < 0 ? (
                  <span className="text-indigo-600 font-bold">{s2.name} ahead by +{Math.abs(pctDiff).toFixed(1)}%</span>
                ) : (
                  <span className="text-slate-600">Identical Percentage</span>
                )}
              </p>
            </div>
            <div className="h-8 w-px bg-slate-200 hidden sm:block" />
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Total Marks Delta</p>
              <p className="text-sm font-bold mt-0.5">
                {marksDiff > 0 ? (
                  <span className="text-blue-600 font-bold">+{marksDiff} Marks (Student A)</span>
                ) : marksDiff < 0 ? (
                  <span className="text-indigo-600 font-bold">+{Math.abs(marksDiff)} Marks (Student B)</span>
                ) : (
                  <span className="text-slate-600">Equal Total Score</span>
                )}
              </p>
            </div>
          </div>

          {/* Subject-by-Subject Deep Dive */}
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-3">
              Subject-by-Subject Breakdown ({allSubjectCodes.length} Subjects)
            </h3>

            {allSubjectCodes.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm border rounded-2xl bg-slate-50">
                No subject marks records found for these students. Make sure both have results scraped.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {/* Desktop Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-2 p-3 bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <div className="col-span-5">Subject</div>
                  <div className="col-span-3 text-center text-blue-700">{s1.name} (A)</div>
                  <div className="col-span-3 text-center text-indigo-700">{s2.name} (B)</div>
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
                      className="p-3.5 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Subject Name & Code */}
                      <div className="col-span-5 mb-2 sm:mb-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-700">{code}</span>
                          {(m1?.semester || m2?.semester) && (
                            <span className="text-[10px] text-slate-400 px-1.5 py-0.2 rounded bg-slate-100">
                              Sem {m1?.semester || m2?.semester}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1">{subjectName}</p>
                      </div>

                      {/* Student 1 Marks */}
                      <div className="col-span-3 flex sm:flex-col items-center justify-between sm:justify-center bg-blue-50/50 sm:bg-transparent p-2 sm:p-0 rounded-xl mb-1.5 sm:mb-0">
                        <span className="text-[10px] font-bold text-blue-600 sm:hidden">Student A:</span>
                        {m1 ? (
                          <div className="text-center">
                            <span className="font-bold text-slate-900 text-sm">{m1.total}</span>
                            <span className="text-[10px] text-slate-400 ml-1">
                              (Int: {m1.internal_marks}, Ext: {m1.external_marks})
                            </span>
                            <span
                              className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                m1.status === "P" ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                              }`}
                            >
                              {m1.status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">—</span>
                        )}
                      </div>

                      {/* Student 2 Marks */}
                      <div className="col-span-3 flex sm:flex-col items-center justify-between sm:justify-center bg-indigo-50/50 sm:bg-transparent p-2 sm:p-0 rounded-xl mb-1.5 sm:mb-0">
                        <span className="text-[10px] font-bold text-indigo-600 sm:hidden">Student B:</span>
                        {m2 ? (
                          <div className="text-center">
                            <span className="font-bold text-slate-900 text-sm">{m2.total}</span>
                            <span className="text-[10px] text-slate-400 ml-1">
                              (Int: {m2.internal_marks}, Ext: {m2.external_marks})
                            </span>
                            <span
                              className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                m2.status === "P" ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                              }`}
                            >
                              {m2.status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">—</span>
                        )}
                      </div>

                      {/* Lead Badge */}
                      <div className="col-span-1 text-right flex items-center justify-end">
                        {lead !== null ? (
                          lead > 0 ? (
                            <span className="text-[11px] font-bold text-blue-600 bg-blue-100/70 px-2 py-0.5 rounded-full">
                              +{lead} A
                            </span>
                          ) : lead < 0 ? (
                            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                              +{Math.abs(lead)} B
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">Tie</span>
                          )
                        ) : (
                          <span className="text-slate-300">—</span>
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
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}

