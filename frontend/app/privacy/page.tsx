"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { AuthSession } from "../../lib/api";
import { sfx } from "../../lib/sfx";
import StudentAuthModal from "../../components/StudentAuthModal";
import PrivacySettingsModal from "../../components/PrivacySettingsModal";
import { IconShield, IconKey, IconLock, IconCheck, IconClose } from "../../components/Icons";

export default function PrivacyPage() {
  const [isObsidian, setIsObsidian] = useState(true);
  const [studentSession, setStudentSession] = useState<AuthSession | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("vtu_theme");
      const obsidian = savedTheme !== "paper";
      setIsObsidian(obsidian);
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", obsidian);
        document.body.className = obsidian ? "theme-obsidian dark" : "theme-paper";
      }
      const rawSession = sessionStorage.getItem("vtu_student_session");
      if (rawSession) {
        setStudentSession(JSON.parse(rawSession));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggleTheme = () => {
    sfx.playMechanicalClick();
    const next = !isObsidian;
    setIsObsidian(next);
    try {
      localStorage.setItem("vtu_theme", next ? "obsidian" : "paper");
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next);
        document.body.className = next ? "theme-obsidian dark" : "theme-paper";
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
        isObsidian ? "bg-[#08090a] text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      <Navbar
        isObsidian={isObsidian}
        onToggleTheme={handleToggleTheme}
        studentSession={studentSession}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onSignOut={() => {
          sessionStorage.removeItem("vtu_student_token");
          sessionStorage.removeItem("vtu_student_session");
          sessionStorage.removeItem("vtu_student_usn");
          setStudentSession(null);
        }}
      />

      <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Breadcrumb & Header */}
        <div className="mb-8">
          <Link
            href="/"
            onClick={() => sfx.playMechanicalClick()}
            className={`inline-flex items-center gap-1.5 text-xs font-medium mb-4 transition-colors ${
              isObsidian ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>←</span>
            <span>Back to Results Intelligence</span>
          </Link>

          <div className="flex items-center gap-2.5 mb-2">
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isObsidian
                  ? "bg-cyan-950/30 text-cyan-400 border-cyan-800/40"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              Consent &amp; Transparency Policy
            </span>
            <span className="text-xs opacity-50 font-mono">Updated November 2026</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Data Privacy, Student Consent &amp; Transparency
          </h1>
          <p className="text-sm opacity-70 mt-2 max-w-2xl leading-relaxed">
            VTU WhatNow is an independent, student-run academic analytics project built to provide
            transparent departmental insights. Here is everything we store, why it is stored, and
            how you maintain 100% control over your public record.
          </p>
        </div>

        {/* Direct Action Callout */}
        <div
          className={`p-5 rounded-2xl border mb-10 transition-all ${
            isObsidian
              ? "bg-[#0d1117] border-white/10 text-white"
              : "bg-white border-slate-200 text-slate-900 shadow-sm"
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold tracking-tight flex items-center gap-2">
                <IconShield className="w-4 h-4 text-cyan-400" />
                <span>Self-Service Student Privacy Controls</span>
              </h2>
              <p className="text-xs opacity-70 mt-1 max-w-lg leading-relaxed">
                You do not need to email an administrator to hide your name or marks. Verified students
                can immediately toggle their public visibility directly from their dashboard.
              </p>
            </div>
            {studentSession ? (
              <button
                type="button"
                onClick={() => {
                  sfx.playMechanicalClick();
                  setIsPrivacyModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-xs shrink-0"
              >
                Manage My Privacy Settings ({studentSession.usn})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  sfx.playMechanicalClick();
                  setIsAuthModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 transition-all shadow-sm shrink-0 inline-flex items-center gap-1.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-cyan-400 active:scale-[0.98]"
              >
                <IconKey className="w-3.5 h-3.5" />
                <span>Log In With USN to Configure</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-8 text-xs sm:text-sm leading-relaxed">
          {/* Section 1 */}
          <section
            className={`p-5 rounded-2xl border ${
              isObsidian ? "bg-[#0c0e12] border-slate-800/90" : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            <h2 className="font-bold text-sm sm:text-base tracking-tight mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xs font-mono font-bold">
                1
              </span>
              <span>Project Provenance &amp; Academic Data Source</span>
            </h2>
            <p className="opacity-80 leading-relaxed mb-3">
              VTU WhatNow is a peer analytics software system maintained independently by engineering
              students. It is not owned, operated, or endorsed by Visvesvaraya Technological
              University (VTU).
            </p>
            <p className="opacity-80 leading-relaxed">
              All academic examination records displayed on this platform are collected strictly from
              VTU&apos;s publicly reachable university examination results portal (<code>results.vtu.ac.in</code>).
              Because the university publishes results indexed by University Seat Number (USN), our system
              synthesizes aggregate departmental distributions, class rankings, and subject pass percentages
              to assist students in understanding departmental benchmarks.
            </p>
          </section>

          {/* Section 2 */}
          <section
            className={`p-5 rounded-2xl border ${
              isObsidian ? "bg-[#0c0e12] border-slate-800/90" : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            <h2 className="font-bold text-sm sm:text-base tracking-tight mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xs font-mono font-bold">
                2
              </span>
              <span>What Data We Store vs What We Never Collect</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div
                className={`p-3.5 rounded-xl border ${
                  isObsidian ? "bg-white/[0.02] border-white/10" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs uppercase mb-2">
                  <IconCheck className="w-4 h-4" />
                  <span>Publicly Published Academic Data We Store</span>
                </div>
                <ul className="space-y-1.5 opacity-80 text-xs list-disc pl-4">
                  <li>University Seat Number (USN)</li>
                  <li>Student Name (as registered with VTU)</li>
                  <li>Branch Code (CSE, DS, AIML, CY, ISE, ECE)</li>
                  <li>Semester Breakdown &amp; Subject Codes</li>
                  <li>Internal, External, and Total Subject Marks</li>
                  <li>Calculated Semester Percentage &amp; Class Rank</li>
                  <li>Optional student-added social handles (GitHub, LinkedIn)</li>
                </ul>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  isObsidian ? "bg-white/[0.02] border-white/10" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-1.5 text-rose-500 font-bold text-xs uppercase mb-2">
                  <IconClose className="w-4 h-4" />
                  <span>Confidential Data We NEVER Collect</span>
                </div>
                <ul className="space-y-1.5 opacity-80 text-xs list-disc pl-4">
                  <li>No VTU login passwords or credentials</li>
                  <li>No personal phone numbers or SMS data</li>
                  <li>No personal email addresses</li>
                  <li>No residential addresses or government ID numbers</li>
                  <li>No payment or financial transaction details</li>
                  <li>No third-party tracking or behavioral advertising cookies</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section
            className={`p-5 rounded-2xl border ${
              isObsidian ? "bg-[#0c0e12] border-slate-800/90" : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            <h2 className="font-bold text-sm sm:text-base tracking-tight mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xs font-mono font-bold">
                3
              </span>
              <span>Examination Records &amp; Backlog Privacy Controls</span>
            </h2>
            <p className="opacity-80 leading-relaxed mb-4">
              All student names, USNs, examination marks, and departmental percentiles are transparent academic
              records sourced from VTU’s public results portal. To preserve individual dignity, students have
              direct control over whether pending subjects (re-attempts) are publicly flagged:
            </p>
            <div className="space-y-3">
              <div
                className={`p-3.5 rounded-xl border ${
                  isObsidian ? "bg-white/[0.02] border-white/5" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-xs">Public Examination Records (Name, Marks, Rank)</span>
                  <span className="text-[10px] uppercase font-bold text-emerald-500">Always Public</span>
                </div>
                <p className="text-xs opacity-70 mt-1">
                  University seat numbers, student names, semester marks, percentages, and batch ranks remain
                  authentic and transparent for unbiased college analytics. Peer comparison is active across
                  all records.
                </p>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  isObsidian ? "bg-white/[0.02] border-white/5" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-xs">show_my_backlogs (Pending Subjects / Re-attempts)</span>
                  <span className="text-[10px] uppercase font-bold text-emerald-500">Default: ON (Public)</span>
                </div>
                <p className="text-xs opacity-70 mt-1">
                  Default is <strong>ON</strong>. When ON, your public badge displays your pending re-attempts count,
                  and subjects pending re-attempt are marked with result &ldquo;F&rdquo; in your marks breakdown. If opted out
                  (OFF), your public badge displays &ldquo;All Clear&rdquo; and failed subjects are filtered from public view.
                  Verified account owners always see all their authentic scores regardless of toggle setting.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section
            className={`p-5 rounded-2xl border ${
              isObsidian ? "bg-[#0c0e12] border-slate-800/90" : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            <h2 className="font-bold text-sm sm:text-base tracking-tight mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xs font-mono font-bold">
                4
              </span>
              <span>Re-attempts &amp; Backlog Protection Standards</span>
            </h2>
            <p className="opacity-80 leading-relaxed mb-3">
              We strictly adhere to student-first dignity guidelines. Terminology throughout our UI
              uses &ldquo;Pending Subjects&rdquo; or &ldquo;Re-attempts&rdquo; rather than stigmatizing labels.
            </p>
            <p className="opacity-80 leading-relaxed">
              Institutional aggregations (such as departmental subject pass percentages or difficult subject
              curves) are computed strictly across anonymous statistics without ever exposing or linking
              individual student identities to subject backlogs.
            </p>
          </section>

          {/* Section 5 */}
          <section
            className={`p-5 rounded-2xl border ${
              isObsidian ? "bg-[#0c0e12] border-slate-800/90" : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            <h2 className="font-bold text-sm sm:text-base tracking-tight mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xs font-mono font-bold">
                5
              </span>
              <span>Complete Data Takedown &amp; Unlisting Requests</span>
            </h2>
            <p className="opacity-80 leading-relaxed mb-3">
              If you wish to have your USN permanently unlisted from VTU WhatNow without using the
              self-service dashboard, you can file a quick unlisting request:
            </p>
            <ol className="list-decimal pl-4 space-y-1.5 opacity-80">
              <li>Log in to your account and submit an unlisting request from the settings menu, OR</li>
              <li>Submit an ownership dispute / support ticket directly from the login dialog with proof of college ID.</li>
            </ol>
            <p className="opacity-80 leading-relaxed mt-3">
              Takedown requests submitted with valid college credentials are honored and processed
              within 48 hours.
            </p>
          </section>
        </div>

        {/* Footer info */}
        <div className="mt-12 pt-6 border-t border-inherit flex flex-col sm:flex-row items-center justify-between gap-4 text-xs opacity-60">
          <p>© {new Date().getFullYear()} VTU WhatNow • Student-run Open Analytics</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:underline">Dashboard</Link>
            <Link href="/admin" className="hover:underline">Admin Portal</Link>
          </div>
        </div>
      </div>

      {/* Modals */}
      <StudentAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        isObsidian={isObsidian}
        onSuccess={(session) => {
          setStudentSession(session);
          setIsPrivacyModalOpen(true);
        }}
      />

      {studentSession && (
        <PrivacySettingsModal
          isOpen={isPrivacyModalOpen}
          onClose={() => setIsPrivacyModalOpen(false)}
          usn={studentSession.usn}
          studentToken={studentSession.token}
          isObsidian={isObsidian}
        />
      )}
    </div>
  );
}
