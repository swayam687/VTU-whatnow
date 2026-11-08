import "./globals.css";
import type { Metadata } from "next";
import CyberNavbar from "../components/CyberNavbar";

export const metadata: Metadata = {
  title: "VTU WhatNow // GOD VIEW Terminal",
  description: "Cyberpunk intelligence dossier, live branch leaderboards, and network topology for VTU engineering students.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="cyber-grid-bg min-h-screen text-slate-100 flex flex-col font-mono selection:bg-cyan-500/30 selection:text-cyan-200">
        {/* Navigation Header with Cyber Controls */}
        <CyberNavbar />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>

        {/* Tactical Obsidian Footer */}
        <footer className="border-t border-cyan-500/10 bg-[#08090a]/90 py-6 text-center text-xs text-slate-500 font-mono">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>VTU WHATNOW // OBSIDIAN TERMINAL • ALL DOSSIERS SYNCED</span>
            </div>
            <p className="text-slate-500 text-[11px]">
              CRITERIA: F (FAIL) • A (ABSENT) • W (WITHHELD) // TOPOLOGY: 60FPS
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
