"use client";

import React, { useState, useEffect } from "react";
import { PrivacySettings, fetchStudentPrivacy, updateStudentPrivacy } from "../lib/api";
import { IconClose, IconShield, IconCheck, IconLock } from "./Icons";
import { sfx } from "../lib/sfx";

interface PrivacySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  usn: string;
  studentToken?: string;
  isObsidian?: boolean;
  onUpdated?: (settings: PrivacySettings) => void;
}

export default function PrivacySettingsModal({
  isOpen,
  onClose,
  usn,
  studentToken,
  isObsidian = true,
  onUpdated,
}: PrivacySettingsModalProps) {
  const [settings, setSettings] = useState<PrivacySettings>({
    show_my_name: true,
    show_my_marks: true,
    show_my_backlogs: false,
    allow_comparison: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !usn) return;
    setStatusMessage(null);
    setLoading(true);

    fetchStudentPrivacy(usn, studentToken)
      .then((data) => {
        setSettings({
          show_my_name: data.show_my_name ?? true,
          show_my_marks: data.show_my_marks ?? true,
          show_my_backlogs: data.show_my_backlogs ?? false,
          allow_comparison: data.allow_comparison ?? true,
        });
      })
      .catch((err) => {
        console.warn("Failed to load privacy settings:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, usn, studentToken]);

  if (!isOpen) return null;

  const handleToggle = (key: keyof PrivacySettings) => {
    sfx.playMechanicalClick();
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    sfx.playMechanicalClick();
    setSaving(true);
    setStatusMessage(null);

    try {
      const updated = await updateStudentPrivacy(usn, settings, studentToken);
      sfx.playSonarChime();
      setStatusMessage({ type: "success", text: "Privacy settings updated successfully." });
      if (onUpdated) onUpdated(updated);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.message || "Failed to update settings. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden transition-all flex flex-col max-h-[90vh] ${
          isObsidian
            ? "bg-[#0b0d11] border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between ${
            isObsidian ? "border-slate-800 bg-[#0f1117]" : "border-slate-100 bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                isObsidian
                  ? "bg-cyan-950/40 border-cyan-800/40 text-cyan-400"
                  : "bg-blue-50 border-blue-200 text-blue-600"
              }`}
            >
              <IconShield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base tracking-tight">
                Student Privacy &amp; Consent Controls
              </h3>
              <p className="text-[11px] opacity-60 font-mono">USN: {usn}</p>
            </div>
          </div>
          <button
            onClick={() => {
              sfx.playMechanicalClick();
              onClose();
            }}
            className="p-1.5 rounded-xl opacity-60 hover:opacity-100 transition-opacity"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-10 text-center space-y-2 opacity-60 text-xs">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading your privacy preferences...</p>
            </div>
          ) : (
            <>
              <p className="text-xs opacity-75 leading-relaxed">
                Configure your public visibility on VTU WhatNow. Changes take effect across public
                search, departmental leaderboards, and marksheet views.
              </p>

              {/* Toggles Container */}
              <div className="space-y-3 pt-1">
                {/* 1. Show My Name */}
                <div
                  onClick={() => handleToggle("show_my_name")}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isObsidian
                      ? "bg-white/[0.02] border-white/10 hover:border-white/20"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs tracking-tight">Public Name Display</span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          settings.show_my_name
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-500/20 text-slate-400"
                        }`}
                      >
                        {settings.show_my_name ? "Visible" : "Anonymous"}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-60 mt-0.5 leading-snug">
                      When OFF, your name appears publicly as &ldquo;Anonymous Student&rdquo;.
                    </p>
                  </div>
                  {/* Switch */}
                  <div
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                      settings.show_my_name
                        ? "bg-cyan-500"
                        : isObsidian
                        ? "bg-slate-800"
                        : "bg-slate-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        settings.show_my_name ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>

                {/* 2. Show My Marks */}
                <div
                  onClick={() => handleToggle("show_my_marks")}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isObsidian
                      ? "bg-white/[0.02] border-white/10 hover:border-white/20"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs tracking-tight">Marks &amp; Percentage</span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          settings.show_my_marks
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-500/20 text-slate-400"
                        }`}
                      >
                        {settings.show_my_marks ? "Visible" : "Protected"}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-60 mt-0.5 leading-snug">
                      When OFF, subject breakdowns and percentages are masked from public view.
                    </p>
                  </div>
                  {/* Switch */}
                  <div
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                      settings.show_my_marks
                        ? "bg-cyan-500"
                        : isObsidian
                        ? "bg-slate-800"
                        : "bg-slate-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        settings.show_my_marks ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>

                {/* 3. Show My Backlogs (Default OFF) */}
                <div
                  onClick={() => handleToggle("show_my_backlogs")}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isObsidian
                      ? "bg-white/[0.02] border-white/10 hover:border-white/20"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs tracking-tight">Pending Subjects (Re-attempts)</span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          settings.show_my_backlogs
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        {settings.show_my_backlogs ? "Opted In (Yes/No)" : "Hidden (Default)"}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-60 mt-0.5 leading-snug">
                      Default is <strong>OFF</strong>. Individual failed subjects are NEVER published.
                      If opted in, public view only shows &ldquo;Has pending subjects: Yes/No&rdquo;.
                    </p>
                  </div>
                  {/* Switch */}
                  <div
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                      settings.show_my_backlogs
                        ? "bg-cyan-500"
                        : isObsidian
                        ? "bg-slate-800"
                        : "bg-slate-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        settings.show_my_backlogs ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>

                {/* 4. Allow Comparison */}
                <div
                  onClick={() => handleToggle("allow_comparison")}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isObsidian
                      ? "bg-white/[0.02] border-white/10 hover:border-white/20"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs tracking-tight">Peer Head-to-Head Comparison</span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          settings.allow_comparison
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-500/20 text-slate-400"
                        }`}
                      >
                        {settings.allow_comparison ? "Allowed" : "Blocked"}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-60 mt-0.5 leading-snug">
                      Allow classmates to select your record in head-to-head comparison cards.
                    </p>
                  </div>
                  {/* Switch */}
                  <div
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                      settings.allow_comparison
                        ? "bg-cyan-500"
                        : isObsidian
                        ? "bg-slate-800"
                        : "bg-slate-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        settings.allow_comparison ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Status Message */}
              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                    statusMessage.type === "success"
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                  }`}
                >
                  <IconCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>{statusMessage.text}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className={`p-4 sm:p-5 border-t flex items-center justify-between gap-3 ${
            isObsidian ? "border-slate-800 bg-[#0f1117]" : "border-slate-100 bg-slate-50"
          }`}
        >
          <a
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-cyan-400 hover:underline opacity-80"
          >
            Read Full Transparency Policy →
          </a>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sfx.playMechanicalClick();
                onClose();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors ${
                isObsidian
                  ? "border-slate-800 hover:bg-white/5 text-slate-300"
                  : "border-slate-200 hover:bg-slate-100 text-slate-700"
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || saving}
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 transition-all shadow-xs inline-flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Preferences</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
