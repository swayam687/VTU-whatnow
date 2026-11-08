"use client";

import React, { useState } from "react";
import { Student, Mark } from "../lib/api";
import { IconClose, IconCompare, IconCheck } from "./Icons";
import CryptographicAvatar from "./CryptographicAvatar";
import { sfx } from "../lib/sfx";

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

  const handleClose = () => {
    sfx.playClick();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto font-mono">
      <div className="bg-[#0c1015] rounded-3xl border border-cyan-500/40 shadow-[0_0_40px_rgba(0,240,255,0.15)] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-500/60 text-cyan-400 flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.3)]">
              <IconCompare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-base sm:text-lg flex items-center gap-2">
                <span>HEAD-TO-HEAD DOSSIER COMPARISON</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  DIFF MATRIX
                </span>
              </h2>
              <p className="text-xs text-slate-400">Subject-by-subject telemetry and performance metrics</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded-xl transition-colors"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">

          {/* Student Selector / Cards Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Student 1 Card */}
            <div className="p-4 rounded-2xl border border-cyan-500/40 bg-cyan-950/20 shadow-[0_0_15px_rgba(0,240,255,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <CryptographicAvatar usn={s1.usn} size={48} />
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800">
                    TARGET A
                  </span>
                  {allStudents.length > 0 ? (
                    <select
                      value={s1Usn}
                      onChange={(e) => {
                        sfx.playClick();
                        setS1Usn(e.target.value);
                      }}
                      className="mt-2 block w-full text-xs font-bold text-slate-100 bg-slate-900 border border-slate-700 rounded-xl p-2 focus:ring-2 focus:ring-cyan-400"
                    >
                      {allStudents.map((s) => (
                        <option key={s.usn} value={s.usn}>
                          {s.name} ({s.usn})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <h3 className="font-bold text-slate-100 text-base mt-1 truncate">{s1.name}</h3>
                  )}
                  <p className="font-mono text-xs text-slate-400 mt-1">{s1.usn} • {s1.branch}</p>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]">
                    {s1.percentage.toFixed(1)}%
                  </span>
                  <p className="text-[10px] text-slate-400">{s1.total_marks} PTS</p>
                </div>
              </div>
            </div>

            {/* Student 2 Card */}
            <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <CryptographicAvatar usn={s2.usn} size={48} />
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800">
                    TARGET B
                  </span>
                  {allStudents.length > 0 ? (
                    <select
                      value={s2Usn}
                      onChange={(e) => {
                        sfx.playClick();
                        setS2Usn(e.target.value);
                      }}
                      className="mt-2 block w-full text-xs font-bold text-slate-100 bg-slate-900 border border-slate-700 rounded-xl p-2 focus:ring-2 focus:ring-amber-400"
                    >
                      {allStudents.map((s) => (
                        <option key={s.usn} value={s.usn}>
                          {s.name} ({s.usn})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <h3 className="font-bold text-slate-100 text-base mt-1 truncate">{s2.name}</h3>
                  )}
                  <p className="font-mono text-xs text-slate-400 mt-1">{s2.usn} • {s2.branch}</p>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                    {s2.percentage.toFixed(1)}%
                  </span>
                  <p className="text-[10px] text-slate-400">{s2.total_marks} PTS</p>
                </div>
              </div>
            </div>
          </div>

          {/* Aggregate Differential Metric Banner */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 uppercase font-bold tracking-widest">
              DIFFERENTIAL SUMMARY
            </p>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div>
                <p className="text-xs text-slate-500">Percentage Gap</p>
                <p
                  className={`text-lg font-black ${
                    pctDiff > 0 ? "text-cyan-400" : pctDiff < 0 ? "text-amber-400" : "text-slate-400"
                  }`}
                >
                  {pctDiff > 0 ? `+${pctDiff.toFixed(1)}% (A)` : pctDiff < 0 ? `+${Math.abs(pctDiff).toFixed(1)}% (B)` : "Tied"}
                </p>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div>
                <p className="text-xs text-slate-500">Score Margin</p>
                <p
                  className={`text-lg font-black ${
                    marksDiff > 0 ? "text-cyan-400" : marksDiff < 0 ? "text-amber-400" : "text-slate-400"
                  }`}
                >
                  {marksDiff > 0 ? `+${marksDiff} pts (A)` : marksDiff < 0 ? `+${Math.abs(marksDiff)} pts (B)` : "Tied"}
                </p>
              </div>
            </div>
          </div>

          {/* Subject Breakdown Table */}
          <div className="rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3 text-center text-cyan-400">{s1.name.split(" ")[0]} (A)</th>
                  <th className="py-2.5 px-3 text-center text-amber-400">{s2.name.split(" ")[0]} (B)</th>
                  <th className="py-2.5 px-3 text-right">Advantage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#08090a]">
                {allSubjectCodes.map((code) => {
                  const m1 = s1MarksMap.get(code);
                  const m2 = s2MarksMap.get(code);
                  const name = m1?.subject_name || m2?.subject_name || code;
                  const diff = (m1?.total || 0) - (m2?.total || 0);

                  return (
                    <tr key={code} className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-mono">
                        <span className="font-bold text-slate-200 block truncate max-w-[200px]">{name}</span>
                        <span className="text-[10px] text-slate-500">{code}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-black text-slate-200 block">{m1 ? m1.total : "-"}</span>
                        <span className="text-[10px] text-slate-500">
                          {m1 ? `${m1.internal_marks} int / ${m1.external_marks} ext` : "N/A"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-black text-slate-200 block">{m2 ? m2.total : "-"}</span>
                        <span className="text-[10px] text-slate-500">
                          {m2 ? `${m2.internal_marks} int / ${m2.external_marks} ext` : "N/A"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {diff > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                            +{diff} (A)
                          </span>
                        ) : diff < 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                            +{Math.abs(diff)} (B)
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-500">
                            EQUAL
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
