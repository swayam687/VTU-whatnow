/**
 * VTU WhatNow Offline Marksheet Cache (0ms Instant Load)
 * Provides local device caching with stale-while-revalidate for instantaneous loads on mobile devices.
 */

import { Student } from "./api";

const CACHE_PREFIX = "vtu_cache_student_";
const STUDENTS_LIST_KEY = "vtu_cache_students_list";
const MY_MARKSHEET_KEY = "vtu_cache_my_marksheet";

export interface CachedItem<T> {
  data: T;
  timestamp: number;
}

/**
 * Saves a student's full marksheet record to local device storage.
 */
export function cacheStudent(student: Student): void {
  if (typeof window === "undefined" || !student?.usn) return;
  try {
    const key = `${CACHE_PREFIX}${student.usn.toUpperCase()}`;
    const payload: CachedItem<Student> = {
      data: student,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.warn("Storage quota exceeded or unavailable:", err);
  }
}

/**
 * Retrieves a cached student marksheet with 0ms latency.
 */
export function getCachedStudent(usn: string): { student: Student; timestamp: number } | null {
  if (typeof window === "undefined" || !usn) return null;
  try {
    const key = `${CACHE_PREFIX}${usn.trim().toUpperCase()}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: CachedItem<Student> = JSON.parse(raw);
    return {
      student: parsed.data,
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
}

/**
 * Caches the complete campus directory for 0ms initial dashboard boot.
 */
export function cacheStudentsList(students: Student[]): void {
  if (typeof window === "undefined" || !students?.length) return;
  try {
    const payload: CachedItem<Student[]> = {
      data: students,
      timestamp: Date.now(),
    };
    localStorage.setItem(STUDENTS_LIST_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Could not cache students directory:", err);
  }
}

/**
 * Retrieves cached student list for instant dashboard display during server warmup.
 */
export function getCachedStudentsList(): { students: Student[]; timestamp: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STUDENTS_LIST_KEY);
    if (!raw) return null;
    const parsed: CachedItem<Student[]> = JSON.parse(raw);
    return {
      students: parsed.data,
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
}

/**
 * Returns human-readable relative time string (e.g. "Just now", "2m ago", "Today")
 */
export function getCacheAgeString(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 30) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
