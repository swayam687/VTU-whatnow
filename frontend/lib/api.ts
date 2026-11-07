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
}): Promise<Student[]> {
  try {
    const query = new URLSearchParams();
    if (params?.branch && params.branch !== "ALL") query.set("branch", params.branch);
    if (params?.search) query.set("search", params.search);
    if (params?.sort) query.set("sort", params.sort);

    const res = await fetch(`${API_BASE}/api/students?${query.toString()}`, { cache: "no-store" });
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
