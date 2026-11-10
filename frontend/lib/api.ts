const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Mark {
  id: number;
  subject_code: string;
  subject_name: string;
  internal_marks: number;
  external_marks: number;
  total: number;
  max_marks: number;
  status: "P" | "F" | "A" | "W" | string;
  semester: string;
}

export interface Student {
  usn: string;
  name: string;
  branch: string;
  batch?: number;
  total_marks: number;
  max_marks: number;
  percentage: number;
  cgpa: number;
  total_backlogs: number;
  github_url?: string;
  linkedin_url?: string;
  avatar_pixel_art?: string;
  marks?: Mark[];
}

export interface BranchStat {
  branch: string;
  total_students: number;
  avg_percentage: number;
  total_backlogs: number;
  pass_count: number;
}

export interface ScrapeStatus {
  is_running: boolean;
  status: string;
  message: string;
  current_usn?: string;
  start_usn?: string;
  end_usn?: string;
  processed_count: number;
  total_count: number;
  captcha_base64?: string;
  logs: string[];
}

export interface AuthStatus {
  usn: string;
  exists: boolean;
  is_claimed: boolean;
  name?: string;
  branch?: string;
}

export interface AuthSession {
  ok: boolean;
  status: "registered" | "authenticated";
  token: string;
  usn: string;
  name: string;
  branch: string;
  login_count: number;
}

export interface DisputeRecord {
  id: number;
  usn: string;
  name: string;
  branch: string;
  selfie_base64: string;
  status: "pending" | "approved" | "rejected";
  created_at?: string;
  reviewed_at?: string;
  admin_notes?: string;
}

export interface MissingUSNReportRecord {
  id: number;
  usn: string;
  name: string;
  branch: string;
  message: string;
  status: "pending" | "resolved";
  reported_at?: string;
  ip_address?: string;
}

export interface LoginLogEntry {
  id: number;
  usn: string;
  name: string;
  branch: string;
  login_at: string;
  ip_address?: string;
}

export interface LoginFrequencyEntry {
  usn: string;
  name: string;
  branch: string;
  login_count: number;
  last_login?: string;
}

export interface LoginLogsData {
  total_logins: number;
  unique_students: number;
  frequency: LoginFrequencyEntry[];
  recent_logs: LoginLogEntry[];
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchStudents(params?: {
  branch?: string;
  search?: string;
  sort?: string;
  token?: string;
}): Promise<Student[]> {
  try {
    const query = new URLSearchParams();
    if (params?.branch && params.branch !== "ALL") query.set("branch", params.branch);
    if (params?.search) query.set("search", params.search);
    if (params?.sort) query.set("sort", params.sort);

    const headers: Record<string, string> = {};
    const token = params?.token || (typeof window !== "undefined" ? sessionStorage.getItem("vtu_student_token") : null);
    if (token) {
      headers["X-Student-Token"] = token;
    }

    const res = await fetch(`${API_BASE}/api/students?${query.toString()}`, {
      headers,
      cache: "no-store",
    });

    if (res.headers.get("X-Token-Revoked") === "true") {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("vtu_student_token");
        sessionStorage.removeItem("vtu_student_session");
        sessionStorage.removeItem("vtu_student_usn");
        window.dispatchEvent(new CustomEvent("vtu:session-revoked"));
      }
    }

    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn("Could not connect to backend server at " + API_BASE);
    return [];
  }
}

export async function fetchStudent(usn: string): Promise<Student> {
  const res = await fetch(`${API_BASE}/api/students/${encodeURIComponent(usn)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Student not found");
  return res.json();
}

export async function updateStudentSocials(
  usn: string,
  data: { github_url?: string; linkedin_url?: string },
  adminKey?: string
): Promise<{ message: string; student?: Student }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminKey) headers["X-Admin-Key"] = adminKey;

  const res = await fetch(`${API_BASE}/api/students/${encodeURIComponent(usn)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(data),
  });
  const resData = await res.json();
  if (!res.ok) throw new Error(resData.detail || "Failed to update profile");
  return resData;
}

export async function updateStudentAvatar(
  usn: string,
  pixelArt: string,
  token?: string
): Promise<{ ok: boolean; message: string; pixel_art: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const effectiveToken = token || (typeof window !== "undefined" ? sessionStorage.getItem("vtu_student_token") || "" : "");
  if (effectiveToken) {
    headers["X-Student-Token"] = effectiveToken;
  }
  const res = await fetch(`${API_BASE}/api/students/${encodeURIComponent(usn)}/avatar`, {
    method: "POST",
    headers,
    body: JSON.stringify({ pixel_art: pixelArt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to update avatar pixel art");
  return data;
}

export async function deleteStudent(usn: string, adminKey?: string): Promise<{ message: string }> {
  const headers: Record<string, string> = {};
  if (adminKey) headers["X-Admin-Key"] = adminKey;

  const res = await fetch(`${API_BASE}/api/students/${encodeURIComponent(usn)}`, {
    method: "DELETE",
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to delete student");
  return data;
}

export async function fetchBranches(): Promise<BranchStat[]> {
  try {
    const res = await fetch(`${API_BASE}/api/branches`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchLeaderboard(params?: {
  branch?: string;
  limit?: number;
}): Promise<Student[]> {
  try {
    const query = new URLSearchParams();
    if (params?.branch && params.branch !== "ALL") query.set("branch", params.branch);
    if (params?.limit) query.set("limit", String(params.limit));

    const res = await fetch(`${API_BASE}/api/leaderboard?${query.toString()}`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function startScraper(
  payload: {
    start_usn: string;
    end_usn: string;
    semester: string;
    custom_url?: string;
    semester_link_id?: number;
  },
  adminKey?: string
): Promise<{ message: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminKey) headers["X-Admin-Key"] = adminKey;

  const res = await fetch(`${API_BASE}/api/scrape/start`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to start scraper");
  return data;
}

export async function stopScraper(adminKey?: string): Promise<{ message: string }> {
  const headers: Record<string, string> = {};
  if (adminKey) headers["X-Admin-Key"] = adminKey;

  const res = await fetch(`${API_BASE}/api/scrape/stop`, {
    method: "POST",
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to stop scraper");
  return data;
}

export async function fetchScrapeStatus(): Promise<ScrapeStatus> {
  const res = await fetch(`${API_BASE}/api/scrape/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to get status");
  return res.json();
}

export async function submitScraperCaptcha(text: string, adminKey?: string): Promise<{ message: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminKey) headers["X-Admin-Key"] = adminKey;

  const res = await fetch(`${API_BASE}/api/scrape/captcha`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to submit captcha");
  return data;
}

export interface SubjectBacklogStat {
  subject_code: string;
  subject_name: string;
  branch?: string;
  total_students: number;
  fail_count: number;
  pass_count: number;
  fail_rate: number;
}

export interface BranchBacklogSummary {
  branch: string;
  total_students: number;
  total_backlogs: number;
  avg_backlogs_per_student: number;
  students_with_backlogs: number;
  clean_pass_students: number;
  top_failed_subjects: SubjectBacklogStat[];
}

export interface BacklogAnalytics {
  total_failed_papers: number;
  overall_deadliest_subjects: SubjectBacklogStat[];
  branches: BranchBacklogSummary[];
}

export async function fetchBacklogAnalytics(): Promise<BacklogAnalytics> {
  const res = await fetch(`${API_BASE}/api/analytics/backlogs`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load backlog analytics");
  return res.json();
}

// -------------------------------------------------------------
// Semester Links Management
// -------------------------------------------------------------

export interface SemesterLink {
  id: number;
  title: string;
  url: string;
  semester: string;
  is_default: boolean;
  created_at?: string;
}

export async function fetchSemesterLinks(): Promise<SemesterLink[]> {
  try {
    const res = await fetch(`${API_BASE}/api/semester-links`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createSemesterLink(
  payload: { title: string; url: string; semester: string; is_default?: boolean },
  adminKey?: string
): Promise<SemesterLink> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminKey) headers["X-Admin-Key"] = adminKey;

  const res = await fetch(`${API_BASE}/api/semester-links`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to create semester link");
  return data;
}

export async function deleteSemesterLink(id: number, adminKey?: string): Promise<{ message: string }> {
  const headers: Record<string, string> = {};
  if (adminKey) headers["X-Admin-Key"] = adminKey;

  const res = await fetch(`${API_BASE}/api/semester-links/${id}`, {
    method: "DELETE",
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to delete semester link");
  return data;
}

// -------------------------------------------------------------
// System Diagnostics
// -------------------------------------------------------------

export interface BrowserStatus {
  status: "ready" | "not_found";
  detected_paths: string[];
  platform: string;
}

export async function fetchBrowserStatus(): Promise<BrowserStatus> {
  try {
    const res = await fetch(`${API_BASE}/api/system/browser-status`, { cache: "no-store" });
    if (!res.ok) return { status: "not_found", detected_paths: [], platform: "" };
    return await res.json();
  } catch {
    return { status: "not_found", detected_paths: [], platform: "" };
  }
}

export async function installBrowser(adminKey?: string): Promise<{ ok: boolean; message: string }> {
  const headers: Record<string, string> = {};
  if (adminKey) headers["X-Admin-Key"] = adminKey;

  const res = await fetch(`${API_BASE}/api/system/install-browser`, {
    method: "POST",
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.message || "Failed to trigger browser verification");
  return data;
}

// -------------------------------------------------------------
// Student Auth & Dispute Management
// -------------------------------------------------------------

export async function fetchAuthStatus(usn: string): Promise<AuthStatus> {
  const res = await fetch(`${API_BASE}/api/auth/status?usn=${encodeURIComponent(usn.trim().toUpperCase())}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to check USN status");
  return res.json();
}

export async function loginOrRegisterStudent(usn: string, password: string): Promise<AuthSession> {
  const res = await fetch(`${API_BASE}/api/auth/login-or-register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usn: usn.trim().toUpperCase(), password: password.trim() }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Authentication failed. Check your password.");
  }
  return data;
}

export async function submitUsnDispute(
  usn: string,
  newPassword: string,
  selfieBase64: string
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/auth/dispute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usn: usn.trim().toUpperCase(),
      new_password: newPassword.trim(),
      selfie_base64: selfieBase64,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to submit ownership dispute.");
  }
  return data;
}

export async function fetchAdminDisputes(adminKey: string, status?: string): Promise<DisputeRecord[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`${API_BASE}/api/admin/disputes${query}`, {
    headers: { "X-Admin-Key": adminKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load USN disputes");
  return res.json();
}

export async function reviewAdminDispute(
  disputeId: number,
  action: "approve" | "reject",
  adminNotes?: string,
  adminKey?: string
): Promise<{ ok: boolean; message: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminKey) headers["X-Admin-Key"] = adminKey;

  const res = await fetch(`${API_BASE}/api/admin/disputes/${disputeId}/review`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, admin_notes: adminNotes || "" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to process dispute action");
  return data;
}

export async function fetchAdminLoginLogs(adminKey: string): Promise<LoginLogsData> {
  const res = await fetch(`${API_BASE}/api/admin/login-logs`, {
    headers: { "X-Admin-Key": adminKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load login audit logs");
  return res.json();
}

// -------------------------------------------------------------
// Comparison Tracking & Admin Audit (Admin Only Visibility)
// -------------------------------------------------------------

export interface ComparisonLogEntry {
  id: number;
  viewer_usn?: string;
  viewer_name?: string;
  student1_usn: string;
  student1_name: string;
  student1_branch: string;
  student2_usn: string;
  student2_name: string;
  student2_branch: string;
  compared_at?: string;
  ip_address?: string;
}

export interface ComparisonLogsData {
  total_comparisons: number;
  recent_logs: ComparisonLogEntry[];
  top_targets: { usn: string; name: string; branch: string; count: number }[];
  active_viewers: { usn: string; name: string; count: number }[];
}

export async function logStudentComparison(payload: {
  viewer_usn?: string;
  viewer_name?: string;
  student1_usn: string;
  student1_name?: string;
  student1_branch?: string;
  student2_usn: string;
  student2_name?: string;
  student2_branch?: string;
}): Promise<void> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = typeof window !== "undefined" ? sessionStorage.getItem("vtu_student_token") : null;
    if (token) headers["X-Student-Token"] = token;

    await fetch(`${API_BASE}/api/compare/log`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking telemetry
  }
}

export async function fetchAdminComparisonLogs(adminKey: string): Promise<ComparisonLogsData> {
  const res = await fetch(`${API_BASE}/api/admin/compare-logs`, {
    headers: { "X-Admin-Key": adminKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load comparison logs");
  return res.json();
}

export async function verifyStudentSession(token?: string): Promise<{
  valid: boolean;
  usn?: string;
  name?: string;
  branch?: string;
}> {
  const activeToken = token || (typeof window !== "undefined" ? sessionStorage.getItem("vtu_student_token") : null);
  if (!activeToken) return { valid: false };

  try {
    const res = await fetch(`${API_BASE}/api/auth/verify-session`, {
      headers: { "X-Student-Token": activeToken },
      cache: "no-store",
    });
    if (!res.ok) return { valid: false };
    return await res.json();
  } catch {
    return { valid: false };
  }
}

export async function reportMissingUsn(payload: {
  usn: string;
  name?: string;
  branch?: string;
  message?: string;
}): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/missing-usn/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to submit missing USN report");
  }
  return res.json();
}

export async function fetchAdminMissingUsnReports(adminKey: string): Promise<MissingUSNReportRecord[]> {
  const res = await fetch(`${API_BASE}/api/admin/missing-usn`, {
    headers: { "X-Admin-Key": adminKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load missing USN reports");
  return res.json();
}

export async function resolveAdminMissingUsnReport(id: number, adminKey: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/missing-usn/${id}/resolve`, {
    method: "POST",
    headers: { "X-Admin-Key": adminKey },
  });
  if (!res.ok) throw new Error("Failed to resolve missing USN report");
}
