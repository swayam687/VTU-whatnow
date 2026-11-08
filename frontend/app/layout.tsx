import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VTU WhatNow - Surveillance & Academic Topology Matrix",
  description: "Live results, branch leaderboards, interactive campus topology graph, and backlog mortality matrix for VTU engineering students.",
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
      <body className="bg-[#08090a] theme-obsidian min-h-screen text-slate-100 flex flex-col font-mono selection:bg-cyan-500 selection:text-slate-950">
        {/* Main Content Area */}
        <main className="flex-1 w-full flex flex-col">
          {children}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-slate-900 bg-[#060709] py-6 text-center text-xs text-slate-500 font-mono">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              <span>VTU WHATNOW · GOD::VIEW ACADEMIC SURVEILLANCE &amp; TOPOLOGY</span>
            </p>
            <p className="text-slate-600">Backlog Criteria: F (Fail), A (Absent), W (Withheld)</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
