export interface User {
  id: string;
  name: string;
  email: string;
  role: "creator" | "reviewer" | "manager" | "admin";
}

export interface ContentMeta {
  has_image?: boolean;
  alt_text?: string;
  logo_bg?: string;
  fg?: string;
  bg?: string;
  [key: string]: any;
}

export interface Version {
  id: string;
  content_id: string;
  number: number;
  body: string;
  meta?: ContentMeta;
  score?: Score | null;
  created_by: string;
  created_at: string;
}

export interface Finding {
  id?: string;
  content_id?: string;
  version_number?: number;
  category: "tone" | "messaging" | "facts" | "claims" | "terminology" | "accessibility" | "visual" | string;
  severity: "Blocker" | "Warning" | "Info";
  source_type: "rule-based" | "ai-assisted" | string;
  quote: string;
  rule_id: string;
  explanation: string;
  confidence: number;
  suggestion?: string | null;
  status: "open" | "accepted" | "dismissed";
  dismiss_reason?: string | null;
  label?: string | null;
  [key: string]: any;
}

export interface Score {
  overall: number;
  categories: Record<string, number>;
  approvable: boolean;
}

export interface Comment {
  id: string;
  content_id: string;
  finding_id?: string | null;
  author_id: string;
  author_name?: string;
  author_role?: string;
  text: string;
  created_at: string;
}

export interface Approval {
  id: string;
  content_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  reviewer_role?: string;
  decision: "approve" | "request_changes";
  reason?: string;
  override?: string | null;
  created_at: string;
}

export interface Content {
  id: string;
  creator_id: string;
  title: string;
  channel: string;
  state: "Draft" | "Reviewed" | "InReview" | "Approved" | "ChangesRequested";
  current_version: number;
  created_at: string;
  versions?: Version[];
  findings?: Finding[];
  comments?: Comment[];
  approvals?: Approval[];
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || `Request failed with status ${response.status}`;
    throw new Error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
  }

  return data as T;
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setAuth(token: string, user: User) {
  if (typeof window === "undefined") return;
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
