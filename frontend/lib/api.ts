export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");

export interface Student {
  roll_number: string;
  name: string;
  class_name: string;
  email?: string;
  image_base64?: string;
  status?: string;
  registered_at?: string;
}

export interface AttendanceRecord {
  id?: number;
  roll_number: string;
  name: string;
  class_name: string;
  date: string;
  time: string;
  status: string;
  confidence?: number;
  verification_method?: string;
  latitude?: number;
  longitude?: number;
  distance_from_campus?: number;
  timestamp?: string;
}

export interface CampusLocation {
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  enabled: boolean;
  updated_at?: string;
}

export interface DashboardStats {
  total_students: number;
  present_today: number;
  absent_today: number;
  attendance_rate: number;
  today_date: string;
  classes: string[];
  campus_location?: CampusLocation;
  trend_7_days: {
    date: string;
    day: string;
    present: number;
    absent: number;
  }[];
  recent_logs: AttendanceRecord[];
  diagnostics: {
    mongo_atlas: {
      connected: boolean;
      uri_configured: boolean;
      status_text: string;
    };
    local_database: {
      engine: string;
      file: string;
      status: string;
    };
    geofence?: CampusLocation;
    counts: {
      total_students: number;
      total_attendance_records: number;
    };
    ip_whitelist_instruction: string;
  };
}

export async function fetchStats(): Promise<DashboardStats | null> {
  try {
    const res = await fetch(`${API_BASE}/api/stats`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch stats:", err);
    return null;
  }
}

export async function fetchCampusLocation(): Promise<CampusLocation | null> {
  try {
    const res = await fetch(`${API_BASE}/api/location/config`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.config;
  } catch (err) {
    console.error("Failed to fetch campus location:", err);
    return null;
  }
}

export async function updateCampusLocation(
  latitude: number,
  longitude: number,
  radius_meters = 100.0,
  name = "College Campus / Classroom",
  enabled = true
): Promise<CampusLocation | null> {
  try {
    const res = await fetch(`${API_BASE}/api/location/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude, radius_meters, name, enabled })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.config;
  } catch (err) {
    console.error("Failed to update campus location:", err);
    return null;
  }
}

export async function fetchStudents(search = "", className = ""): Promise<Student[]> {
  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (className) params.append("class_name", className);
    const res = await fetch(`${API_BASE}/api/students?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    return data.students || [];
  } catch (err) {
    console.error("Failed to fetch students:", err);
    return [];
  }
}

export async function fetchAttendance(date = "", roll = "", className = ""): Promise<AttendanceRecord[]> {
  try {
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    if (roll) params.append("roll_number", roll);
    if (className) params.append("class_name", className);
    const res = await fetch(`${API_BASE}/api/attendance?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    return data.records || [];
  } catch (err) {
    console.error("Failed to fetch attendance:", err);
    return [];
  }
}

export interface AppSettings {
  campus_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  geofence_enabled: boolean;
  match_threshold: number;
  late_cutoff_time: string;
  prevent_duplicate: boolean;
  allow_manual_entry: boolean;
  updated_at?: string;
}

export interface AdminUser {
  id?: number;
  username: string;
  role: string;
  last_login?: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: AdminUser;
  message?: string;
}

// Token storage helpers
export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("smart_attendance_admin_token");
}

export function setAdminToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("smart_attendance_admin_token", token);
  }
}

export function removeAdminToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("smart_attendance_admin_token");
  }
}

// Admin Authentication API calls
export async function loginAdmin(username: string, password: string): Promise<LoginResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      setAdminToken(data.token);
    }
    return data;
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to connect to authentication server." };
  }
}

export async function verifyAdminSession(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function changeAdminPassword(
  oldPassword: string,
  newPassword: string,
  token: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// Application Settings API calls
export async function fetchAppSettings(): Promise<AppSettings | null> {
  try {
    const res = await fetch(`${API_BASE}/api/settings`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.settings;
  } catch (err) {
    console.error("Failed to load settings:", err);
    return null;
  }
}

export async function updateAppSettings(
  settings: Partial<AppSettings>,
  token: string
): Promise<{ success: boolean; message: string; settings?: AppSettings }> {
  try {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(settings)
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// System Maintenance
export async function resetAttendanceLogs(token: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/system/reset-attendance`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function fetchSystemBackup(token: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/system/backup`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Unauthorized or server error");
    return await res.json();
  } catch (err: any) {
    console.error("Backup failed:", err);
    return null;
  }
}
