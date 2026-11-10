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
        radius: 24,
        color: isObsidian ? "#06b6d4" : "#2563eb",
        fixed: true,
      });
    });

    visibleStudents.forEach((student, idx) => {
      const bCenter = branchCenters[student.branch] || { x: cx, y: cy };
      const jitterAngle = idx * 1.37 + Math.random() * 0.5;
      const jitterDist = 35 + (idx % 6) * 18 + Math.random() * 25;

      const sx = bCenter.x + Math.cos(jitterAngle) * jitterDist;
      const sy = bCenter.y + Math.sin(jitterAngle) * jitterDist;

      let color = isObsidian ? "#10b981" : "#059669";
      if (student.percentage >= 80 && student.total_backlogs === 0) {
        color = isObsidian ? "#f59e0b" : "#d97706";
      } else if (student.total_backlogs >= 3) {
        color = isObsidian ? "#ef4444" : "#dc2626";
      } else if (student.total_backlogs > 0) {
        color = isObsidian ? "#f97316" : "#ea580c";
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
  }, [visibleStudents, filterBranch, isObsidian]);

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

      if (isPhysicsActive) {
        const branchPos: Record<string, { x: number; y: number }> = {};
        for (const n of nodes) {
          if (n.type === "branch") {
            branchPos[n.branch] = { x: n.x, y: n.y };
          }
        }

        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.fixed) continue;

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

          node.vx *= 0.88;
          node.vy *= 0.88;

          if (draggedNodeRef.current !== node) {
            node.x += node.vx;
            node.y += node.vy;
            node.x = Math.max(node.radius + 10, Math.min(width - node.radius - 10, node.x));
            node.y = Math.max(node.radius + 10, Math.min(height - node.radius - 10, node.y));
          }
        }
      }

      ctx.clearRect(0, 0, width, height);

      // Background Grid Dots
      const dotSpacing = 30;
      ctx.fillStyle = isObsidian ? "rgba(255, 255, 255, 0.04)" : "rgba(15, 23, 42, 0.05)";
      for (let x = 0; x < width; x += dotSpacing) {
        for (let y = 0; y < height; y += dotSpacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw connection lines
      const branchPosMap: Record<string, { x: number; y: number }> = {};
      for (const n of nodes) {
        if (n.type === "branch") branchPosMap[n.branch] = { x: n.x, y: n.y };
      }

      ctx.lineWidth = 1;
      for (const n of nodes) {
        if (n.type === "student") {
          const bHub = branchPosMap[n.branch];
          if (bHub) {
            const isHovered = hoveredNode === n;
            ctx.strokeStyle = isHovered
              ? isObsidian ? "rgba(6, 182, 212, 0.7)" : "rgba(37, 99, 235, 0.7)"
              : isObsidian
              ? "rgba(255, 255, 255, 0.06)"
              : "rgba(15, 23, 42, 0.07)";
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
          ctx.save();
          ctx.fillStyle = isObsidian ? "#0f172a" : "#ffffff";
          ctx.strokeStyle = isObsidian ? "#06b6d4" : "#2563eb";
          ctx.lineWidth = 2.2;

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isObsidian ? "#ffffff" : "#0f172a";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(node.label, node.x, node.y);
          ctx.restore();
        } else {
          ctx.save();
          if (isHovered) {
            ctx.shadowColor = node.color;
            ctx.shadowBlur = 14;
          }
          ctx.fillStyle = node.color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, isHovered ? node.radius * 1.3 : node.radius, 0, Math.PI * 2);
          ctx.fill();

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

  // Responsive canvas sizing
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = Math.max(rect.width * 0.54, 420);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (draggedNodeRef.current) {
      draggedNodeRef.current.x = mx;
      draggedNodeRef.current.y = my;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      return;
    }

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

  const handlePointerDown = () => {
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
      className={`relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border transition-all ${
        isObsidian
          ? "bg-[#08090a] border-slate-800/90 text-white"
          : "bg-white border-slate-200/90 text-slate-900 shadow-sm"
      }`}
    >
      {/* Topology Header Controls */}
      <div
        className={`p-3.5 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3 ${
          isObsidian ? "border-slate-800/80" : "border-slate-100"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isObsidian ? "bg-cyan-400" : "bg-blue-600"
            }`}
          />
          <div>
            <h3 className="text-xs sm:text-sm font-bold tracking-tight">
              Campus Student Network
            </h3>
            <p className="text-[11px] opacity-60">
              {visibleStudents.length} students grouped by department
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Branch filter */}
          <div
            className={`flex items-center gap-1 p-1 rounded-xl border ${
              isObsidian ? "bg-slate-900/60 border-slate-800" : "bg-slate-100 border-slate-200"
            }`}
          >
            {branches.map((b) => (
              <button
                key={b}
                onClick={() => {
                  sfx.playMechanicalClick();
                  setFilterBranch(b);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  filterBranch === b
                    ? isObsidian
                      ? "bg-cyan-500 text-slate-950 font-bold"
                      : "bg-white text-slate-900 font-bold shadow-sm"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Mode toggle */}
          <div
            className={`flex items-center gap-1 p-1 rounded-xl border ${
              isObsidian ? "bg-slate-900/60 border-slate-800" : "bg-slate-100 border-slate-200"
            }`}
          >
            {(["all", "toppers", "backlogs"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  sfx.playMechanicalClick();
                  setFilterMode(m);
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold transition-all ${
                  filterMode === m
                    ? "bg-amber-500 text-slate-950 font-bold"
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
            className={`px-2.5 py-1.5 border rounded-xl text-[11px] font-medium transition-colors ${
              isObsidian
                ? "border-slate-800 hover:border-slate-600"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            {isPhysicsActive ? "Pause" : "Resume"}
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

        {/* Floating Student Card on Hover */}
        {hoveredNode && hoveredNode.type === "student" && hoveredNode.student && hoverPos && (
          <div
            className="absolute pointer-events-none z-30 transform -translate-x-1/2 -translate-y-full mb-3"
            style={{
              left: `${hoverPos.x}px`,
              top: `${hoverPos.y - 10}px`,
            }}
          >
            <div
              className={`rounded-2xl p-3 shadow-xl min-w-[220px] max-w-[260px] border transition-all ${
                isObsidian
                  ? "bg-[#0f1115]/95 border-cyan-500/50 text-white"
                  : "bg-white/95 border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Identicon
                  usn={hoveredNode.student.usn}
                  percentage={hoveredNode.student.percentage}
                  totalBacklogs={hoveredNode.student.total_backlogs}
                  customPixelArt={hoveredNode.student.avatar_pixel_art}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs truncate">
                    {hoveredNode.student.name || "Student"}
                  </p>
                  <p className="font-mono text-[10px] opacity-60">{hoveredNode.student.usn}</p>
                  <span
                    className={`inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      isObsidian
                        ? "bg-slate-800 text-cyan-400"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {hoveredNode.student.branch}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-slate-800/40 text-center">
                <div>
                  <span className="block text-[9px] uppercase opacity-50">Score</span>
                  <span className="font-bold text-xs text-amber-500">
                    {hoveredNode.student.percentage.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase opacity-50">Total</span>
                  <span className="font-bold text-xs">
                    {hoveredNode.student.total_marks}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase opacity-50">Backlogs</span>
                  <span
                    className={`font-bold text-xs ${
                      hoveredNode.student.total_backlogs === 0
                        ? "text-emerald-500"
                        : "text-rose-500"
                    }`}
                  >
                    {hoveredNode.student.total_backlogs}
                  </span>
                </div>
              </div>

              <div className="mt-2 text-center">
                <span className="text-[9px] opacity-50">Click to view marks breakdown</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div
        className={`p-3 border-t flex flex-wrap items-center justify-between gap-3 text-[11px] ${
          isObsidian
            ? "bg-slate-950/40 border-slate-800/50 text-slate-400"
            : "bg-slate-50 border-slate-100 text-slate-600"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            Topper (&gt;80%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Clear Pass
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            1-2 Backlogs
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            3+ Backlogs
          </span>
        </div>
        <span className="hidden sm:inline opacity-60">💡 Click &amp; drag nodes • Click to inspect</span>
      </div>
    </div>
  );
}
