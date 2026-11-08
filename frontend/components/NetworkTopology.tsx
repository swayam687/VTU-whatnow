"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { Student } from "../lib/api";
import CryptographicAvatar from "./CryptographicAvatar";
import { sfx } from "../lib/sfx";

interface NetworkTopologyProps {
  students: Student[];
  activeBranch: string;
  onSelectStudent: (student: Student) => void;
}

interface BranchCluster {
  code: string;
  name: string;
  color: string;
  glow: string;
  x: number;
  y: number;
  targetAngle: number;
  radius: number;
}

interface StudentParticle {
  student: Student;
  branch: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetRadius: number;
  angle: number;
  orbitSpeed: number;
  size: number;
  color: string;
}

const BRANCH_CONFIG: Record<string, { color: string; glow: string; label: string }> = {
  CSE: { color: "#00f0ff", glow: "rgba(0, 240, 255, 0.4)", label: "Comp Science" },
  DS: { color: "#38bdf8", glow: "rgba(56, 189, 248, 0.4)", label: "Data Science" },
  CY: { color: "#a855f7", glow: "rgba(168, 85, 247, 0.4)", label: "Cyber Security" },
  AIML: { color: "#f43f5e", glow: "rgba(244, 63, 94, 0.4)", label: "AI & Machine Learning" },
  ISE: { color: "#10b981", glow: "rgba(16, 185, 129, 0.4)", label: "Info Science" },
  ECE: { color: "#fbbf24", glow: "rgba(251, 191, 36, 0.4)", label: "Electronics" },
  OTHER: { color: "#94a3b8", glow: "rgba(148, 163, 184, 0.4)", label: "Engineering" },
};

export default function NetworkTopology({
  students,
  activeBranch,
  onSelectStudent,
}: NetworkTopologyProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoveredStudent, setHoveredStudent] = useState<Student | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Group unique branches present in the student pool
  const branches = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      const b = (s.branch || "OTHER").toUpperCase();
      set.add(b);
    });
    if (set.size === 0) set.add("CSE");
    return Array.from(set);
  }, [students]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 900);
    let height = (canvas.height = Math.max(520, window.innerHeight * 0.62));

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = Math.max(520, window.innerHeight * 0.62);
    };
    window.addEventListener("resize", handleResize);

    // Initialize Branch gravity hubs arranged radially around center
    const centerX = width / 2;
    const centerY = height / 2;
    const orbitRingRadius = Math.min(width, height) * 0.34 * zoomLevel;

    const clusters: Record<string, BranchCluster> = {};
    branches.forEach((branch, index) => {
      const angle = (index / branches.length) * Math.PI * 2 - Math.PI / 2;
      const conf = BRANCH_CONFIG[branch] || BRANCH_CONFIG.OTHER;
      clusters[branch] = {
        code: branch,
        name: conf.label,
        color: conf.color,
        glow: conf.glow,
        targetAngle: angle,
        x: centerX + Math.cos(angle) * orbitRingRadius,
        y: centerY + Math.sin(angle) * orbitRingRadius,
        radius: 22,
      };
    });

    // Initialize Student orbiting particles
    const particles: StudentParticle[] = students.map((s, idx) => {
      const b = (s.branch || "OTHER").toUpperCase();
      const cluster = clusters[b] || Object.values(clusters)[0];
      const angle = (idx * 137.5 * Math.PI) / 180; // Golden angle dispersion
      
      // Better students orbit closer to their branch hub
      const pct = s.percentage || 50;
      const dist = 35 + (100 - Math.min(100, Math.max(30, pct))) * 0.95;

      // Color coding by backlogs
      let color = "#00f0ff";
      if (s.total_backlogs > 2) color = "#f43f5e"; // Crimson (critical)
      else if (s.total_backlogs > 0) color = "#fbbf24"; // Amber (warning)
      else if (pct >= 80) color = "#10b981"; // Emerald topper

      const size = Math.max(3.2, Math.min(9.5, (pct / 100) * 8.5));

      return {
        student: s,
        branch: b,
        x: cluster ? cluster.x + Math.cos(angle) * dist : centerX,
        y: cluster ? cluster.y + Math.sin(angle) * dist : centerY,
        vx: 0,
        vy: 0,
        angle,
        targetRadius: dist,
        orbitSpeed: 0.008 + (Math.random() * 0.006 - 0.003),
        size,
        color,
      };
    });

    let pulseTime = 0;

    // Main render loop
    const render = () => {
      pulseTime += 0.03;
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Sub-pixel radar background grid
      ctx.save();
      ctx.strokeStyle = "rgba(0, 240, 255, 0.04)";
      ctx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Central Hub radar concentric circles
      ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
      ctx.beginPath();
      ctx.arc(centerX, centerY, orbitRingRadius * 0.45, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(0, 240, 255, 0.12)";
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, orbitRingRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Central Nexus Core (VTU Mainframe)
      const corePulse = Math.sin(pulseTime) * 3;
      const coreGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        4,
        centerX,
        centerY,
        28 + corePulse
      );
      coreGradient.addColorStop(0, "#00f0ff");
      coreGradient.addColorStop(0.5, "rgba(0, 240, 255, 0.2)");
      coreGradient.addColorStop(1, "transparent");

      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 32 + corePulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#08090a";
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#00f0ff";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("VTU", centerX, centerY);

      // 3. Draw branch clusters & orbital links
      Object.values(clusters).forEach((cluster) => {
        // Link line to core
        ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(cluster.x, cluster.y);
        ctx.stroke();

        // Pulsing branch perimeter
        const bPulse = Math.sin(pulseTime + cluster.targetAngle) * 4;
        ctx.strokeStyle = cluster.color;
        ctx.lineWidth = 1.5;
        ctx.fillStyle = "#08090a";

        ctx.beginPath();
        ctx.arc(cluster.x, cluster.y, cluster.radius + bPulse * 0.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cluster.x, cluster.y, cluster.radius - 4, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = cluster.color;
        ctx.font = "bold 11px monospace";
        ctx.fillText(cluster.code, cluster.x, cluster.y);

        ctx.font = "8px sans-serif";
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fillText(cluster.name, cluster.x, cluster.y + 28);
      });

      // 4. Update and render student orbiters
      particles.forEach((p) => {
        const cluster = clusters[p.branch] || Object.values(clusters)[0];
        if (!cluster) return;

        if (!isPaused) {
          p.angle += p.orbitSpeed;
        }

        const targetX = cluster.x + Math.cos(p.angle) * p.targetRadius;
        const targetY = cluster.y + Math.sin(p.angle) * p.targetRadius;

        p.x += (targetX - p.x) * 0.12;
        p.y += (targetY - p.y) * 0.12;

        const isHighlighted = hoveredStudent?.usn === p.student.usn;
        const isBranchMatch = activeBranch === "ALL" || p.branch === activeBranch;

        // Faint orbit line between student and branch
        if (isHighlighted || (isBranchMatch && Math.random() < 0.008)) {
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = isHighlighted ? 0.6 : 0.15;
          ctx.beginPath();
          ctx.moveTo(cluster.x, cluster.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }

        // Student node rendering
        ctx.fillStyle = p.color;
        if (!isBranchMatch) {
          ctx.globalAlpha = 0.25;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, isHighlighted ? p.size * 1.6 : p.size, 0, Math.PI * 2);
        ctx.fill();

        if (isHighlighted) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.globalAlpha = 1.0;
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Mouse interaction: detect hovered student
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let found: StudentParticle | null = null;
      let minDistance = 16;

      for (const p of particles) {
        const dist = Math.hypot(p.x - mouseX, p.y - mouseY);
        if (dist < minDistance) {
          minDistance = dist;
          found = p;
        }
      }

      if (found) {
        if (hoveredStudent?.usn !== found.student.usn) {
          sfx.playClick();
          if (found.student.percentage >= 85) {
            sfx.playSonar();
          }
        }
        setHoveredStudent(found.student);
        setTooltipPos({ x: found.x, y: found.y });
      } else {
        setHoveredStudent(null);
        setTooltipPos(null);
      }
    };

    const handleClick = () => {
      if (hoveredStudent) {
        sfx.playSonar();
        onSelectStudent(hoveredStudent);
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, [students, branches, activeBranch, isPaused, zoomLevel, hoveredStudent, onSelectStudent]);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-3xl overflow-hidden border border-cyan-500/30 bg-[#08090a] shadow-[0_0_35px_rgba(0,240,255,0.06)]"
    >
      {/* Top HUD Status Bar */}
      <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex items-center justify-between z-10 bg-gradient-to-b from-[#08090a]/90 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
            NETWORK TOPOLOGY // RADAR VIEW
          </span>
          <span className="text-[10px] font-mono text-slate-500 px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800">
            NODES: {students.length}
          </span>
        </div>

        {/* Tactical Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            className="px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:text-cyan-300 bg-slate-900/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors"
          >
            {isPaused ? "RESUME" : "FREEZE"}
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => (z === 1 ? 1.25 : z === 1.25 ? 0.85 : 1))}
            className="px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:text-cyan-300 bg-slate-900/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors"
          >
            ZOOM {zoomLevel.toFixed(2)}x
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <canvas
        ref={canvasRef}
        className="w-full block cursor-crosshair"
      />

      {/* Hover Mini-Dossier Popover */}
      {hoveredStudent && tooltipPos && (
        <div
          className="absolute z-20 pointer-events-auto -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
          }}
        >
          <div className="bg-[#0c1015]/95 backdrop-blur-md border border-cyan-400/60 rounded-2xl p-3.5 shadow-[0_0_25px_rgba(0,240,255,0.25)] min-w-[240px] text-left">
            <div className="flex items-center gap-2.5 mb-2">
              <CryptographicAvatar usn={hoveredStudent.usn} size={38} />
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 uppercase">
                  {hoveredStudent.branch || "ENG"}
                </span>
                <p className="font-bold text-sm text-slate-100 truncate mt-0.5">
                  {hoveredStudent.name || "Student Node"}
                </p>
                <p className="font-mono text-[10px] text-cyan-400/80">
                  {hoveredStudent.usn}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 py-1.5 border-y border-slate-800/80 my-2 text-center font-mono">
              <div className="p-1 rounded bg-slate-900/70">
                <p className="text-[9px] text-slate-400">AGGREGATE</p>
                <p className="text-xs font-black text-cyan-300">
                  {hoveredStudent.percentage.toFixed(1)}%
                </p>
              </div>
              <div className="p-1 rounded bg-slate-900/70">
                <p className="text-[9px] text-slate-400">BACKLOGS</p>
                <p
                  className={`text-xs font-black ${
                    hoveredStudent.total_backlogs > 0 ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {hoveredStudent.total_backlogs}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectStudent(hoveredStudent)}
              className="w-full py-1.5 px-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-mono text-xs font-bold rounded-xl transition-all shadow-[0_0_12px_rgba(0,240,255,0.4)]"
            >
              INSPECT DOSSIER →
            </button>
          </div>
        </div>
      )}

      {/* Bottom Radar Legend */}
      <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Clear Orbit (0 Backlogs)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Caution (1-2 Backlogs)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Critical (3+ Backlogs)
          </span>
        </div>
        <p className="text-[10px] text-slate-500">
          NODE SIZE = % SCORE • PROXIMITY = CLUSTER GRAVITY
        </p>
      </div>
    </div>
  );
}

