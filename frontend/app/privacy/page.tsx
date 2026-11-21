"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { AuthSession, getStoredStudentSession, clearStoredStudentSession } from "../../lib/api";
import { sfx } from "../../lib/sfx";
import StudentAuthModal from "../../components/StudentAuthModal";
import PrivacySettingsModal from "../../components/PrivacySettingsModal";
import { IconShield, IconKey, IconCheck, IconClose } from "../../components/Icons";

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
      const rawSession = getStoredStudentSession();
      if (rawSession) {
        setStudentSession(rawSession);
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
          clearStoredStudentSession();
          setStudentSession(null);
        }}
      />

      <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Breadcrumb & Header */}
        <div className="mb-6">
          <Link
            href="/"
            onClick={() => sfx.playMechanicalClick()}
            className={`inline-flex items-center gap-1.5 text-xs font-medium mb-3 transition-colors ${
              isObsidian ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>←</span>
            <span>Back to Results Explorer</span>
          </Link>

          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isObsidian
                  ? "bg-cyan-950/30 text-cyan-400 border-cyan-800/40"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              Privacy &amp; Data Transparency
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Privacy Policy &amp; Data Deletion
          </h1>
          <p className="text-xs sm:text-sm opacity-75 mt-1.5 leading-relaxed">
            VTU WhatNow is a student-run academic analytics project. Data is sourced directly from VTU&apos;s public examination results portal.
          </p>
        </div>

        {/* 1. CRITICAL CALLOUT: HOW TO DELETE YOUR DATA */}
        <section
          className={`p-5 sm:p-6 rounded-2xl sm:rounded-3xl border mb-6 transition-all ${
            isObsidian
              ? "bg-rose-950/20 border-rose-800/50 text-rose-100 shadow-xl shadow-rose-950/10"
              : "bg-rose-50/70 border-rose-200 text-rose-950 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              🗑️
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-rose-600 dark:text-rose-300">
                How to delete your data:
              </h2>
              <p className="text-xs opacity-80">Simple self-service request to remove your profile.</p>
            </div>
          </div>

          <ol className="space-y-2 mt-3 text-xs sm:text-sm font-medium">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-500 dark:text-rose-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <span>Log in using your own USN.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-500 dark:text-rose-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <span>Click &ldquo;View Marksheet&rdquo; on your student card.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-500 dark:text-rose-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <span>Click &ldquo;Request Update&rdquo; at the top of your marksheet.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-500 dark:text-rose-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                4
              </span>
              <span>Find and select the &ldquo;Request Data Deletion&rdquo; option.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-500 dark:text-rose-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                5
              </span>
              <span>Click &ldquo;Submit&rdquo; &mdash; your request is sent to the admin, and your data will be permanently hidden within 24 hours.</span>
            </li>
          </ol>

          <div className="mt-4 pt-3 border-t border-rose-500/20 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] opacity-75">
              Want to manage privacy settings instead?
            </span>
            {studentSession ? (
              <button
                type="button"
                onClick={() => {
                  sfx.playMechanicalClick();
                  setIsPrivacyModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
              >
                Manage Privacy Controls ({studentSession.usn})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  sfx.playMechanicalClick();
                  setIsAuthModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <IconKey className="w-3.5 h-3.5" />
                <span>Sign In to Request Deletion</span>
              </button>
            )}
          </div>
        </section>

        {/* 2. WHAT WE STORE VS NEVER COLLECT */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div
            className={`p-4 rounded-2xl border ${
              isObsidian ? "bg-[#0c0e12] border-slate-800/90" : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs uppercase mb-2">
              <IconCheck className="w-4 h-4" />
              <span>Public Academic Data Stored</span>
            </div>
            <ul className="space-y-1 text-xs opacity-80 list-disc pl-4">
              <li>University Seat Number (USN)</li>
              <li>Student Name (from university records)</li>
              <li>Branch &amp; Semester Subject Marks</li>
              <li>Calculated Semester Percentage &amp; Rank</li>
            </ul>
          </div>

          <div
            className={`p-4 rounded-2xl border ${
              isObsidian ? "bg-[#0c0e12] border-slate-800/90" : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            <div className="flex items-center gap-1.5 text-rose-500 font-bold text-xs uppercase mb-2">
              <IconClose className="w-4 h-4" />
              <span>Never Collected</span>
            </div>
            <ul className="space-y-1 text-xs opacity-80 list-disc pl-4">
              <li>No phone numbers or email addresses</li>
              <li>No passwords or VTU portal credentials</li>
              <li>No financial or residential details</li>
              <li>No third-party ad tracking cookies</li>
            </ul>
          </div>
        </section>

        {/* 3. PENDING SUBJECTS PRIVACY (SHOW / HIDE) */}
        <section
          className={`p-5 rounded-2xl border mb-6 ${
            isObsidian ? "bg-[#0c0e12] border-slate-800/90" : "bg-white border-slate-200 shadow-xs"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <IconShield className="w-4 h-4 text-cyan-400" />
            <h2 className="font-bold text-sm sm:text-base tracking-tight">
              Pending Subjects Privacy Control
            </h2>
          </div>
          <p className="text-xs opacity-75 leading-relaxed mb-3">
            Students can toggle their pending subjects visibility from their privacy settings at any time:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div
              className={`p-3 rounded-xl border ${
                isObsidian ? "bg-white/[0.02] border-white/5" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between font-semibold mb-1">
                <span>Default: ON</span>
                <span className="text-[10px] uppercase font-bold text-emerald-500">Public</span>
              </div>
              <p className="opacity-70 text-[11px] leading-relaxed">
                Displays re-attempts count pill and pending subjects in marks breakdown.
              </p>
            </div>

            <div
              className={`p-3 rounded-xl border ${
                isObsidian ? "bg-white/[0.02] border-white/5" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between font-semibold mb-1">
                <span>Opted Out: OFF</span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Protected</span>
              </div>
              <p className="opacity-70 text-[11px] leading-relaxed">
                Public badge displays &ldquo;Hidden&rdquo; instead of &ldquo;All Clear&rdquo;, keeping status private.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="pt-6 border-t border-inherit flex flex-col sm:flex-row items-center justify-between gap-4 text-xs opacity-60">
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
