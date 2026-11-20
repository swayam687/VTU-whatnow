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
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Dragging and touch tracking state
  const draggedNodeRef = useRef<GraphNode | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });

  // Available branches
  const branches = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.branch) set.add(s.branch);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [students]);

  // Branch Cluster Statistics for the bottom section
  const branchClusters = useMemo(() => {
    const map = new Map<
      string,
      {
        branch: string;
        students: Student[];
        avgPct: number;
        clearCount: number;
        backlogCount: number;
        topper: Student | null;
      }
    >();

    students.forEach((s) => {
      const b = s.branch || "OTHER";
      if (!map.has(b)) {
        map.set(b, {
          branch: b,
          students: [],
          avgPct: 0,
          clearCount: 0,
          backlogCount: 0,
          topper: null,
        });
      }
      const item = map.get(b)!;
      item.students.push(s);
      if (s.total_backlogs === 0) item.clearCount++;
      else item.backlogCount++;
      if (!item.topper || s.percentage > item.topper.percentage) {
        item.topper = s;
      }
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        avgPct:
          item.students.reduce((acc, cur) => acc + cur.percentage, 0) /
          (item.students.length || 1),
        passRate: ((item.clearCount / (item.students.length || 1)) * 100),
      }))
      .sort((a, b) => b.students.length - a.students.length);
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

  // Overall Spectrum breakdown
  const spectrumBreakdown = useMemo(() => {
    const total = visibleStudents.length || 1;
    const toppers = visibleStudents.filter((s) => s.percentage >= 80 && s.total_backlogs === 0);
    const clear = visibleStudents.filter((s) => s.percentage < 80 && s.total_backlogs === 0);
    const moderate = visibleStudents.filter((s) => s.total_backlogs >= 1 && s.total_backlogs <= 2);
    const critical = visibleStudents.filter((s) => s.total_backlogs >= 3);

    return {
      total: visibleStudents.length,
      toppersCount: toppers.length,
      toppersPct: ((toppers.length / total) * 100).toFixed(1),
      clearCount: clear.length,
      clearPct: ((clear.length / total) * 100).toFixed(1),
      moderateCount: moderate.length,
      moderatePct: ((moderate.length / total) * 100).toFixed(1),
      criticalCount: critical.length,
      criticalPct: ((critical.length / total) * 100).toFixed(1),
    };
  }, [visibleStudents]);

  // Set default spotlight student if none selected
  useEffect(() => {
    if (!selectedStudent && visibleStudents.length > 0) {
      const topStudent = [...visibleStudents].sort((a, b) => b.percentage - a.percentage)[0];
      if (topStudent) setSelectedStudent(topStudent);
    }
  }, [visibleStudents, selectedStudent]);

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
        const isMobile = window.innerWidth < 640;
        canvasRef.current.width = rect.width;
        canvasRef.current.height = isMobile
          ? Math.max(Math.min(rect.width * 0.85, 360), 290)
          : Math.max(rect.width * 0.52, 420);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const findNodeAt = (clientX: number, clientY: number, hitAllowance = 8): GraphNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    for (const node of nodesRef.current) {
      const dx = mx - node.x;
      const dy = my - node.y;
      const hitRadius = node.radius + hitAllowance;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return node;
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };

    const target = findNodeAt(e.clientX, e.clientY, e.pointerType === "touch" ? 14 : 8);
    if (target) {
      if (e.pointerType === "mouse") {
        draggedNodeRef.current = target;
      }
      if (target.type === "student" && target.student) {
        setSelectedStudent(target.student);
        setHoveredNode(target);
        sfx.playMechanicalClick();
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (draggedNodeRef.current && e.pointerType === "mouse") {
      draggedNodeRef.current.x = mx;
      draggedNodeRef.current.y = my;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      return;
    }

    if (e.pointerType === "mouse") {
      const found = findNodeAt(e.clientX, e.clientY, 6);
      if (found !== hoveredNode) {
        if (found && found.type === "student") {
          sfx.playGeigerTick();
          if (found.student) setSelectedStudent(found.student);
        }
        setHoveredNode(found);
      }
      if (found) {
        setHoverPos({ x: mx, y: my });
      } else {
        setHoverPos(null);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current = null;
    }

    const dist = Math.hypot(
      e.clientX - pointerStartRef.current.x,
      e.clientY - pointerStartRef.current.y
    );
    if (dist < 15) {
      const target = findNodeAt(e.clientX, e.clientY, e.pointerType === "touch" ? 16 : 8);
      if (target) {
        if (target.type === "student" && target.student) {
          setSelectedStudent(target.student);
          setHoveredNode(target);
          sfx.playSonarChime();
        } else if (target.type === "branch") {
          setFilterBranch(target.branch);
          sfx.playMechanicalClick();
        }
      }
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const target = findNodeAt(e.clientX, e.clientY, 10);
    if (target && target.type === "student" && target.student) {
      sfx.playSonarChime();
      onSelectStudent(target.student.usn);
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
          className="w-full h-auto block touch-pan-y select-none"
        />

        {/* Floating Student Card on Hover (Desktop) */}
        {hoveredNode && hoveredNode.type === "student" && hoveredNode.student && hoverPos && (
          <div
            className="hidden sm:block absolute pointer-events-none z-30 transform -translate-x-1/2 -translate-y-full mb-3"
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
                    className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
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

      {/* Interactive Legend & Filter Footer */}
      <div
        className={`p-3.5 sm:p-4 border-t flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
          isObsidian
            ? "bg-[#090b0e] border-slate-800/70 text-slate-400"
            : "bg-slate-50 border-slate-200/80 text-slate-600"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px]">
          <button
            onClick={() => {
              sfx.playMechanicalClick();
              setFilterMode("all");
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
              filterMode === "all"
                ? isObsidian
                  ? "bg-slate-800 border-slate-700 text-white font-bold"
                  : "bg-white border-slate-300 text-slate-900 font-bold shadow-xs"
                : isObsidian
                ? "border-transparent hover:border-slate-800"
                : "border-transparent hover:border-slate-200"
            }`}
          >
            <span>All Nodes ({spectrumBreakdown.total})</span>
          </button>

          <button
            onClick={() => {
              sfx.playMechanicalClick();
              setFilterMode(filterMode === "toppers" ? "all" : "toppers");
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
              filterMode === "toppers"
                ? isObsidian
                  ? "bg-amber-950/40 border-amber-500/60 text-amber-300 font-bold"
                  : "bg-amber-50 border-amber-300 text-amber-900 font-bold"
                : isObsidian
                ? "border-transparent hover:border-slate-800"
                : "border-transparent hover:border-slate-200"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Topper &gt;80%</span>
            <span className="font-mono text-[10px] opacity-75">
              ({spectrumBreakdown.toppersCount})
            </span>
          </button>

          <div className="flex items-center gap-1.5 px-2 py-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Clear Pass</span>
            <span className="font-mono text-[10px] opacity-75">
              ({spectrumBreakdown.clearCount})
            </span>
          </div>

          <button
            onClick={() => {
              sfx.playMechanicalClick();
              setFilterMode(filterMode === "backlogs" ? "all" : "backlogs");
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
              filterMode === "backlogs"
                ? isObsidian
                  ? "bg-rose-950/40 border-rose-500/60 text-rose-300 font-bold"
                  : "bg-rose-50 border-rose-300 text-rose-900 font-bold"
                : isObsidian
                ? "border-transparent hover:border-slate-800"
                : "border-transparent hover:border-slate-200"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>With Backlogs</span>
            <span className="font-mono text-[10px] opacity-75">
              ({Number(spectrumBreakdown.moderateCount) + Number(spectrumBreakdown.criticalCount)})
            </span>
          </button>
        </div>

        {/* Tactile Gestures Tip */}
        <div className="flex items-center gap-2 text-[11px] opacity-70">
          <span className="inline sm:hidden">📱 Swipe down to scroll page • Tap node to inspect</span>
          <span className="hidden sm:inline">💡 Drag nodes to orbit • Click any student to open scorecard</span>
        </div>
      </div>

      {/* Selected Node Spotlight Drawer */}
      {selectedStudent && (
        <div
          className={`p-4 sm:p-5 border-t transition-colors ${
            isObsidian ? "bg-[#0b0d10] border-slate-800/80" : "bg-white border-slate-200/90"
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Identicon
                usn={selectedStudent.usn}
                percentage={selectedStudent.percentage}
                totalBacklogs={selectedStudent.total_backlogs}
                customPixelArt={selectedStudent.avatar_pixel_art}
                size={44}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-sm tracking-tight truncate">
                    {selectedStudent.name || "Student"}
                  </h4>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isObsidian
                        ? "bg-cyan-950/60 text-cyan-300 border border-cyan-800/60"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}
                  >
                    {selectedStudent.branch}
                  </span>
                  {selectedStudent.percentage >= 80 && selectedStudent.total_backlogs === 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      ★ TOPPER
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs opacity-60 mt-0.5">{selectedStudent.usn}</p>
              </div>
            </div>

            {/* Metrics & Actions */}
            <div className="w-full sm:w-auto flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-4">
              <div className="flex items-center gap-4 text-center">
                <div>
                  <span className="block text-[10px] uppercase font-mono opacity-50">Score</span>
                  <span className="font-bold text-sm text-amber-500">
                    {selectedStudent.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="border-l border-slate-800/40 pl-3 sm:pl-4">
                  <span className="block text-[10px] uppercase font-mono opacity-50">Total</span>
                  <span className="font-bold text-sm">
                    {selectedStudent.total_marks}
                  </span>
                </div>
                <div className="border-l border-slate-800/40 pl-3 sm:pl-4">
                  <span className="block text-[10px] uppercase font-mono opacity-50">Backlogs</span>
                  <span
                    className={`font-bold text-sm ${
                      selectedStudent.total_backlogs === 0 ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    {selectedStudent.total_backlogs}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    sfx.playMechanicalClick();
                    setFilterBranch(selectedStudent.branch);
                  }}
                  className={`flex-1 sm:flex-initial px-3 py-2 border rounded-xl text-xs font-semibold transition-colors ${
                    isObsidian
                      ? "border-slate-800 hover:border-slate-700 text-slate-300"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  Focus {selectedStudent.branch}
                </button>
                <button
                  onClick={() => {
                    sfx.playSonarChime();
                    onSelectStudent(selectedStudent.usn);
                  }}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                    isObsidian
                      ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                  }`}
                >
                  Inspect Marksheet →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campus Performance Spectrum Distribution Bar */}
      <div
        className={`p-4 sm:p-5 border-t space-y-2.5 ${
          isObsidian ? "bg-[#08090b] border-slate-800/70" : "bg-slate-50/70 border-slate-200/70"
        }`}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold tracking-tight">Active Population Spectrum</span>
          <span className="font-mono text-[11px] opacity-60">
            {spectrumBreakdown.total} student nodes visualized
          </span>
        </div>

        {/* Multi-segment distribution meter */}
        <div className="w-full h-2.5 rounded-full bg-slate-800/30 overflow-hidden flex">
          <div
            style={{ width: `${spectrumBreakdown.toppersPct}%` }}
            className="h-full bg-amber-500 transition-all"
            title={`Toppers: ${spectrumBreakdown.toppersCount} (${spectrumBreakdown.toppersPct}%)`}
          />
          <div
            style={{ width: `${spectrumBreakdown.clearPct}%` }}
            className="h-full bg-emerald-500 transition-all"
            title={`Clear Pass: ${spectrumBreakdown.clearCount} (${spectrumBreakdown.clearPct}%)`}
          />
          <div
            style={{ width: `${spectrumBreakdown.moderatePct}%` }}
            className="h-full bg-orange-500 transition-all"
            title={`1-2 Backlogs: ${spectrumBreakdown.moderateCount} (${spectrumBreakdown.moderatePct}%)`}
          />
          <div
            style={{ width: `${spectrumBreakdown.criticalPct}%` }}
            className="h-full bg-rose-500 transition-all"
            title={`3+ Backlogs: ${spectrumBreakdown.criticalCount} (${spectrumBreakdown.criticalPct}%)`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono opacity-70">
          <span>🌟 {spectrumBreakdown.toppersPct}% Distinction (&gt;80%)</span>
          <span>🟢 {spectrumBreakdown.clearPct}% Clear Pass</span>
          <span>⚠️ {spectrumBreakdown.moderatePct}% 1-2 Backlogs</span>
          <span>🚨 {spectrumBreakdown.criticalPct}% 3+ Backlogs</span>
        </div>
      </div>

      {/* Department Network Clusters Grid */}
      <div
        className={`p-4 sm:p-5 border-t space-y-4 ${
          isObsidian ? "bg-[#090b0e] border-slate-800/70" : "bg-white border-slate-200/70"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h4 className="font-bold text-xs sm:text-sm tracking-tight">
              Department Network Clusters
            </h4>
            <p className="text-[11px] opacity-60">
              Select any branch to isolate its orbit or compare cluster benchmarks
            </p>
          </div>
          <span className="text-[11px] font-mono opacity-50">
            {branchClusters.length} Academic Departments
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {branchClusters.map((cluster) => {
            const isSelected = filterBranch === cluster.branch;
            return (
              <div
                key={cluster.branch}
                onClick={() => {
                  sfx.playMechanicalClick();
                  setFilterBranch(isSelected ? "ALL" : cluster.branch);
                  if (containerRef.current) {
                    containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? isObsidian
                      ? "bg-cyan-950/30 border-cyan-500/70 shadow-sm"
                      : "bg-blue-50/70 border-blue-400 shadow-sm"
                    : isObsidian
                    ? "bg-[#0d0f13] border-slate-800/80 hover:border-slate-700"
                    : "bg-slate-50/60 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isSelected ? "bg-cyan-400" : "bg-blue-500"
                      }`}
                    />
                    <span className="font-bold text-xs tracking-tight">{cluster.branch}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold ${
                      isObsidian ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {cluster.students.length} nodes
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-800/40 text-[11px]">
                  <div>
                    <span className="block text-[9px] uppercase font-mono opacity-50">Avg Score</span>
                    <span className="font-bold text-amber-500">
                      {cluster.avgPct.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-mono opacity-50">Clear Rate</span>
                    <span
                      className={`font-bold ${
                        cluster.passRate >= 70 ? "text-emerald-500" : "text-amber-500"
                      }`}
                    >
                      {cluster.passRate.toFixed(0)}% Pass
                    </span>
                  </div>
                </div>

                {cluster.topper && (
                  <div className="mt-2 pt-2 border-t border-slate-800/30 flex items-center justify-between text-[10px]">
                    <span className="opacity-50 truncate max-w-[120px]">
                      Top: {cluster.topper.name || cluster.topper.usn}
                    </span>
                    <span className="font-mono font-bold text-amber-500">
                      {cluster.topper.percentage.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
