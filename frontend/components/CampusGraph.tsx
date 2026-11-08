"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Student } from "../lib/api";
import Identicon from "./Identicon";
import { sfx } from "../lib/sfx";

interface CampusGraphProps {
  students: Student[];
  onSelectStudent: (usn: string) => void;
  isObsidian?: boolean;
}

interface GraphNode {
  id: string;
  type: "branch" | "student";
  label: string;
  branch: string;
  student?: Student;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  fixed?: boolean;
}

export default function CampusGraph({
  students,
  onSelectStudent,
  isObsidian = true,
}: CampusGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [filterBranch, setFilterBranch] = useState("ALL");
  const [filterMode, setFilterMode] = useState<"all" | "toppers" | "backlogs">("all");
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [isPhysicsActive, setIsPhysicsActive] = useState(true);

  // Dragging state
  const draggedNodeRef = useRef<GraphNode | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Available branches
  const branches = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.branch) set.add(s.branch);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [students]);

  // Filter students based on UI selections
  const visibleStudents = useMemo(() => {
    let list = students;
    if (filterBranch !== "ALL") {
      list = list.filter((s) => s.branch === filterBranch);
    }
    if (filterMode === "toppers") {
      list = list.filter((s) => s.percentage >= 75 && s.total_backlogs === 0);
    } else if (filterMode === "backlogs") {
      list = list.filter((s) => s.total_backlogs > 0);
    }
    // Limit to 200 nodes for peak 60fps canvas performance
    return list.slice(0, 200);
  }, [students, filterBranch, filterMode]);

  // Initialize or re-create simulation nodes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;

    const newNodes: GraphNode[] = [];
    const branchCenters: Record<string, { x: number; y: number }> = {};

    // 1. Create central branch gravity hubs
    const activeBranches =
      filterBranch === "ALL"
        ? Array.from(new Set(visibleStudents.map((s) => s.branch || "OTHER")))
        : [filterBranch];

    const branchCount = Math.max(activeBranches.length, 1);
    const orbitRadius = Math.min(width, height) * 0.32;

    activeBranches.forEach((b, idx) => {
      const angle = (idx / branchCount) * 2 * Math.PI - Math.PI / 2;
      const bx = cx + Math.cos(angle) * (branchCount === 1 ? 0 : orbitRadius);
      const by = cy + Math.sin(angle) * (branchCount === 1 ? 0 : orbitRadius);

      branchCenters[b] = { x: bx, y: by };

      newNodes.push({
        id: `branch-${b}`,
        type: "branch",
        label: b,
        branch: b,
        x: bx,
        y: by,
        vx: 0,
        vy: 0,
        radius: 26,
        color: "#06b6d4",
        fixed: true,
      });
    });

    // 2. Create student nodes around their branch hub
    visibleStudents.forEach((student, idx) => {
      const bCenter = branchCenters[student.branch] || { x: cx, y: cy };
      const jitterAngle = (idx * 1.37) + Math.random() * 0.5;
      const jitterDist = 35 + (idx % 6) * 18 + Math.random() * 25;

      const sx = bCenter.x + Math.cos(jitterAngle) * jitterDist;
      const sy = bCenter.y + Math.sin(jitterAngle) * jitterDist;

      // Color coding & sizing
      let color = "#10b981"; // Emerald Clear Pass
      if (student.percentage >= 80 && student.total_backlogs === 0) {
        color = "#f59e0b"; // Gold Topper
      } else if (student.total_backlogs >= 3) {
        color = "#ef4444"; // Crimson Critical Backlog
      } else if (student.total_backlogs > 0) {
        color = "#f97316"; // Orange Backlog
      }

      const radius = 4.5 + Math.min((student.percentage / 100) * 8.5, 9);

      newNodes.push({
        id: `student-${student.usn}`,
        type: "student",
        label: student.name || student.usn,
        branch: student.branch,
        student,
        x: sx,
        y: sy,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius,
        color,
      });
    });

    nodesRef.current = newNodes;
  }, [visibleStudents, filterBranch]);

  // Main simulation & render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      const width = canvas.width;
      const height = canvas.height;
      const nodes = nodesRef.current;

      // 1. Physics Step (Spring & Repulsion)
      if (isPhysicsActive) {
        // Build branch position lookup
        const branchPos: Record<string, { x: number; y: number }> = {};
        for (const n of nodes) {
          if (n.type === "branch") {
            branchPos[n.branch] = { x: n.x, y: n.y };
          }
        }

        // Apply forces to students
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.fixed) continue;

          // Pull towards branch hub (Hooke's Spring force)
          const target = branchPos[node.branch];
          if (target) {
            const dx = target.x - node.x;
            const dy = target.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const idealDist = 65;
            const force = (dist - idealDist) * 0.003;
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
          }

          // Node-to-node repulsion
          for (let j = i + 1; j < nodes.length; j++) {
            const other = nodes[j];
            const rx = other.x - node.x;
            const ry = other.y - node.y;
            const rDistSq = rx * rx + ry * ry;
            const minDist = node.radius + other.radius + 6;

            if (rDistSq < minDist * minDist && rDistSq > 0) {
              const rDist = Math.sqrt(rDistSq);
              const repulse = (minDist - rDist) * 0.04;
              const ux = rx / rDist;
              const uy = ry / rDist;

              if (!node.fixed) {
                node.vx -= ux * repulse;
                node.vy -= uy * repulse;
              }
              if (!other.fixed) {
                other.vx += ux * repulse;
                other.vy += uy * repulse;
              }
            }
          }

          // Damping (Friction)
          node.vx *= 0.88;
          node.vy *= 0.88;

          // Update position if not dragged
          if (draggedNodeRef.current !== node) {
            node.x += node.vx;
            node.y += node.vy;

            // Boundaries
            node.x = Math.max(node.radius + 10, Math.min(width - node.radius - 10, node.x));
            node.y = Math.max(node.radius + 10, Math.min(height - node.radius - 10, node.y));
          }
        }
      }

      // 2. Drawing Pass
      ctx.clearRect(0, 0, width, height);

      // Background Grid Dots
      const dotSpacing = 32;
      ctx.fillStyle = isObsidian ? "rgba(255, 255, 255, 0.04)" : "rgba(15, 23, 42, 0.04)";
      for (let x = 0; x < width; x += dotSpacing) {
        for (let y = 0; y < height; y += dotSpacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Connection lines (holographic beams to branch hubs)
      ctx.lineWidth = 1;
      const branchPosMap: Record<string, { x: number; y: number }> = {};
      for (const n of nodes) {
        if (n.type === "branch") branchPosMap[n.branch] = { x: n.x, y: n.y };
      }

      for (const n of nodes) {
        if (n.type === "student") {
          const bHub = branchPosMap[n.branch];
          if (bHub) {
            const isHovered = hoveredNode === n;
            ctx.strokeStyle = isHovered
              ? "rgba(6, 182, 212, 0.7)"
              : isObsidian
              ? "rgba(255, 255, 255, 0.06)"
              : "rgba(15, 23, 42, 0.08)";
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(bHub.x, bHub.y);
            ctx.stroke();
          }
        }
      }

      // Draw Nodes
      for (const node of nodes) {
        const isHovered = hoveredNode === node;

        if (node.type === "branch") {
          // Central Gravity Branch Hub
          ctx.save();
          // Outer glow ring
          ctx.shadowColor = "#06b6d4";
          ctx.shadowBlur = isHovered ? 25 : 12;
          ctx.fillStyle = isObsidian ? "#0f172a" : "#ffffff";
          ctx.strokeStyle = "#06b6d4";
          ctx.lineWidth = 2.5;

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Hub label
          ctx.shadowBlur = 0;
          ctx.fillStyle = isObsidian ? "#ffffff" : "#0f172a";
          ctx.font = "bold 11px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(node.label, node.x, node.y);
          ctx.restore();
        } else {
          // Student Node
          ctx.save();
          if (isHovered) {
            ctx.shadowColor = node.color;
            ctx.shadowBlur = 18;
          } else if (node.student && node.student.percentage >= 80) {
            ctx.shadowColor = "#f59e0b";
            ctx.shadowBlur = 10;
          }

          ctx.fillStyle = node.color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, isHovered ? node.radius * 1.35 : node.radius, 0, Math.PI * 2);
          ctx.fill();

          // Delicate white core for toppers
          if (node.student && node.student.percentage >= 80) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius * 0.35, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPhysicsActive, isObsidian, hoveredNode]);

  // Resize canvas to match display container
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = Math.max(rect.width * 0.58, 480);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mouse & Touch interactions
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Handle dragging
    if (draggedNodeRef.current) {
      draggedNodeRef.current.x = mx;
      draggedNodeRef.current.y = my;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      return;
    }

    // Hit-testing for hover
    let found: GraphNode | null = null;
    for (const node of nodesRef.current) {
      const dx = mx - node.x;
      const dy = my - node.y;
      const hitRadius = node.radius + 6;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        found = node;
        break;
      }
    }

    if (found !== hoveredNode) {
      if (found && found.type === "student") {
        sfx.playGeigerTick();
      }
      setHoveredNode(found);
    }
    if (found) {
      setHoverPos({ x: mx, y: my });
    } else {
      setHoverPos(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (hoveredNode) {
      draggedNodeRef.current = hoveredNode;
      sfx.playMechanicalClick();
    }
  };

  const handlePointerUp = () => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current = null;
    }
  };

  const handleClick = () => {
    if (hoveredNode && hoveredNode.type === "student" && hoveredNode.student) {
      sfx.playSonarChime();
      onSelectStudent(hoveredNode.student.usn);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-3xl overflow-hidden border transition-all duration-300 ${
        isObsidian
          ? "bg-[#08090a] border-slate-800/80 text-white"
          : "bg-white border-slate-200 text-slate-900 shadow-sm"
      }`}
    >
      {/* Topology Header Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400/50" />
          <div>
            <h3 className="font-mono text-xs sm:text-sm font-black uppercase tracking-wider">
              Campus Force Network Topology
            </h3>
            <p className="text-[11px] font-mono opacity-60">
              Live orbital nodes: {visibleStudents.length} indexed students
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Branch filter */}
          <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 p-1 rounded-xl">
            {branches.map((b) => (
              <button
                key={b}
                onClick={() => {
                  sfx.playMechanicalClick();
                  setFilterBranch(b);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  filterBranch === b
                    ? "bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/40"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 p-1 rounded-xl">
            {(["all", "toppers", "backlogs"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  sfx.playMechanicalClick();
                  setFilterMode(m);
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold transition-all ${
                  filterMode === m
                    ? "bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/40"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Physics Pause */}
          <button
            onClick={() => {
              sfx.playMechanicalClick();
              setIsPhysicsActive(!isPhysicsActive);
            }}
            className="px-2.5 py-1 border border-slate-800 rounded-xl text-[11px] hover:border-slate-600 transition-colors"
          >
            {isPhysicsActive ? "⏸ Pause" : "▶ Resume"}
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative w-full cursor-crosshair">
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onClick={handleClick}
          className="w-full h-auto block touch-none"
        />

        {/* Floating Cyber-Dossier Card on Node Hover */}
        {hoveredNode && hoveredNode.type === "student" && hoveredNode.student && hoverPos && (
          <div
            className="absolute pointer-events-none z-30 transition-all duration-100 transform -translate-x-1/2 -translate-y-full mb-3"
            style={{
              left: `${hoverPos.x}px`,
              top: `${hoverPos.y - 12}px`,
            }}
          >
            <div className="bg-[#0f1115]/95 backdrop-blur-md border border-cyan-500/60 rounded-2xl p-3.5 shadow-2xl shadow-cyan-500/20 text-white min-w-[240px] max-w-[280px] font-mono animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <Identicon
                  usn={hoveredNode.student.usn}
                  percentage={hoveredNode.student.percentage}
                  totalBacklogs={hoveredNode.student.total_backlogs}
                  size={42}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs truncate text-cyan-300">
                    {hoveredNode.student.name || "Anonymous Student"}
                  </p>
                  <p className="text-[10px] text-slate-400">{hoveredNode.student.usn}</p>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
                    BRANCH::{hoveredNode.student.branch}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-800 text-center">
                <div>
                  <span className="block text-[9px] uppercase text-slate-400">Score</span>
                  <span className="font-black text-xs text-amber-400">
                    {hoveredNode.student.percentage.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase text-slate-400">Total</span>
                  <span className="font-black text-xs text-white">
                    {hoveredNode.student.total_marks}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase text-slate-400">Backlogs</span>
                  <span
                    className={`font-black text-xs ${
                      hoveredNode.student.total_backlogs === 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {hoveredNode.student.total_backlogs}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 text-center">
                <span className="text-[9px] text-cyan-400/80 tracking-wider uppercase">
                  ⚡ Click Node to Inspect Full Dossier
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div className="p-3.5 bg-slate-950/40 border-t border-slate-800/40 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono opacity-80">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
            Topper (&gt;80%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            Clear Pass
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
            1-2 Backlogs
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            3+ Backlogs
          </span>
        </div>
        <span className="hidden sm:inline">💡 Drag nodes to fling physics • Hover for details</span>
      </div>
    </div>
  );
}
