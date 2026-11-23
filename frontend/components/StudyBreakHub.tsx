import React from "react";
import { IconExternalLink } from "./Icons";
import { sfx } from "../lib/sfx";

interface StudyBreakHubProps {
  isObsidian?: boolean;
}

interface StudyBreakApp {
  id: string;
  category: string;
  title: string;
  description: string;
  buttonText: string;
  url: string;
  accent: "amber" | "indigo" | "emerald";
}

const APPS: StudyBreakApp[] = [
  {
    id: "uno-game",
    category: "The Productivity Killer",
    title: "⚠️ Do Not Click This",
    description:
      "A multiplayer UNO-inspired card game. Share the link with friends and ruin your productivity between lectures.",
    buttonText: "I Warned You",
    url: "https://example.com", // Replace with actual UNO game URL
    accent: "amber",
  },
  {
    id: "study-flow",
    category: "The Focus Hack",
    title: "🎵 Study Flow",
    description:
      "Free music with synced lyrics and offline download. The ultimate focus hack for late-night coding sessions.",
    buttonText: "Tune In",
    url: "https://example.com", // Replace with actual Music App URL
    accent: "indigo",
  },
  {
    id: "daily-jaw",
    category: "The Secret Vault",
    title: "🦷 The Daily Jaw",
    description:
      "A 3D animated journaling experience. Each tooth holds a daily question. Answer it privately. No one else can see it.",
    buttonText: "Unlock Vault",
    url: "https://example.com", // Replace with actual 3D Journal URL
    accent: "emerald",
  },
];

export default function StudyBreakHub({ isObsidian = true }: StudyBreakHubProps) {
  return (
    <section
      aria-label="Study Break Hub"
      className="mt-16 sm:mt-20 pt-10 sm:pt-14 border-t border-slate-200/80 dark:border-white/10"
    >
      {/* Header & Sub-header */}
      <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-8 sm:mb-10 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-mono font-semibold uppercase tracking-wider mb-3 border bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          <span>Study Break Hub</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Reset Your Focus
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          Take a quick break. Check out these tools built by students, for students.
        </p>
      </div>

      {/* 3-Column Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {APPS.map((app) => {
          // Accent-specific design tokens
          const accentStyles = {
            amber: {
              badge: isObsidian
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-amber-50 text-amber-800 border-amber-200",
              borderHover: isObsidian
                ? "group-hover:border-amber-500/40 group-hover:shadow-[0_0_25px_-5px_rgba(245,158,11,0.15)]"
                : "group-hover:border-amber-400 group-hover:shadow-lg group-hover:shadow-amber-500/10",
              button: isObsidian
                ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30"
                : "bg-amber-500 hover:bg-amber-600 text-white shadow-xs",
              glow: "from-amber-500/10 via-transparent to-transparent",
            },
            indigo: {
              badge: isObsidian
                ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                : "bg-indigo-50 text-indigo-800 border-indigo-200",
              borderHover: isObsidian
                ? "group-hover:border-indigo-500/40 group-hover:shadow-[0_0_25px_-5px_rgba(99,102,241,0.15)]"
                : "group-hover:border-indigo-400 group-hover:shadow-lg group-hover:shadow-indigo-500/10",
              button: isObsidian
                ? "bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs",
              glow: "from-indigo-500/10 via-transparent to-transparent",
            },
            emerald: {
              badge: isObsidian
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-emerald-50 text-emerald-800 border-emerald-200",
              borderHover: isObsidian
                ? "group-hover:border-emerald-500/40 group-hover:shadow-[0_0_25px_-5px_rgba(16,185,129,0.15)]"
                : "group-hover:border-emerald-400 group-hover:shadow-lg group-hover:shadow-emerald-500/10",
              button: isObsidian
                ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs",
              glow: "from-emerald-500/10 via-transparent to-transparent",
            },
          }[app.accent];

          return (
            <div
              key={app.id}
              className={`group relative rounded-2xl sm:rounded-3xl p-5 sm:p-6 border transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between overflow-hidden ${
                isObsidian
                  ? "bg-[#0b0d13]/80 backdrop-blur-md border-white/[0.08] text-white"
                  : "bg-white/90 backdrop-blur-md border-slate-200 text-slate-900 shadow-sm"
              } ${accentStyles.borderHover}`}
            >
              {/* Subtle ambient accent gradient on hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${accentStyles.glow} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
              />

              {/* Card Top: Category, Title, Description */}
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${accentStyles.badge}`}
                  >
                    {app.category}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                    <IconExternalLink className="w-3.5 h-3.5" />
                  </span>
                </div>

                <h3 className="font-bold text-base sm:text-lg tracking-tight leading-snug">
                  {app.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {app.description}
                </p>
              </div>

              {/* Card Bottom: Tactile External Action Button */}
              <div className="relative z-10 pt-6 mt-auto">
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => sfx.playMechanicalClick()}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${accentStyles.button}`}
                >
                  <span>{app.buttonText}</span>
                  <IconExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
