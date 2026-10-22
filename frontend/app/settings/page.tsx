"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Settings as SettingsIcon, 
  MapPin, 
  ShieldCheck, 
  Sliders, 
  Lock, 
  Clock, 
  Database, 
  Download, 
  Trash2, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Navigation, 
  LogOut, 
  Cpu, 
  KeyRound, 
  Eye, 
  EyeOff, 
  RefreshCw,
  AlertTriangle,
  Compass
} from "lucide-react";
import { 
  fetchAppSettings, 
  updateAppSettings, 
  AppSettings, 
  getAdminToken, 
  setAdminToken, 
  removeAdminToken, 
  verifyAdminSession, 
  loginAdmin, 
  changeAdminPassword, 
  resetAttendanceLogs, 
  fetchSystemBackup 
} from "@/lib/api";

export default function SettingsPage() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>({
    campus_name: "College Campus / Classroom",
    latitude: 18.5204,
    longitude: 73.8567,
    radius_meters: 100.0,
    geofence_enabled: true,
    match_threshold: 0.40,
    late_cutoff_time: "09:30",
    prevent_duplicate: true,
    allow_manual_entry: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // GPS detection state
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  // Password change state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Danger zone state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Check auth and load settings
  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    verifyAdminSession(token).then((isValid) => {
      setIsAuthenticated(isValid);
      if (isValid) {
        loadSettings();
      } else {
        removeAdminToken();
        setLoading(false);
      }
    });
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const data = await fetchAppSettings();
    if (data) {
      setSettings(data);
    }
    setLoading(false);
  };

  // Inline Login Handler
  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) {
      setLoginError("Please enter both username and password.");
      return;
    }

    setLoginLoading(true);
    setLoginError(null);

    const res = await loginAdmin(loginUsername.trim(), loginPassword);
    setLoginLoading(false);

    if (res.success && res.token) {
      setIsAuthenticated(true);
      loadSettings();
    } else {
      setLoginError(res.message || "Invalid credentials.");
    }
  };

  // Logout Handler
  const handleLogout = () => {
    removeAdminToken();
    setIsAuthenticated(false);
    setLoginPassword("");
  };

  // Detect Live GPS coordinates from Browser
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setGpsMessage("Geolocation is not supported by your browser.");
      return;
    }

    setDetectingGps(true);
    setGpsMessage("Requesting GPS coordinates from your device...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSettings((prev) => ({
          ...prev,
          latitude: parseFloat(pos.coords.latitude.toFixed(6)),
          longitude: parseFloat(pos.coords.longitude.toFixed(6)),
        }));
        setDetectingGps(false);
        setGpsMessage(`Location captured! Accuracy: ±${Math.round(pos.coords.accuracy)}m`);
      },
      (err) => {
        setDetectingGps(false);
        setGpsMessage(`GPS Error: ${err.message}. Please allow location access in your browser.`);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Save Settings Handler
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const token = getAdminToken();
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    const res = await updateAppSettings(settings, token);
    setSaving(false);

    if (res.success) {
      if (res.settings) setSettings(res.settings);
      setSaveSuccess("Application settings successfully saved and applied!");
      setTimeout(() => setSaveSuccess(null), 4000);
    } else {
      setSaveError(res.message || "Failed to update settings.");
    }
  };

  // Password Change Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError("Password must be at least 4 characters long.");
      return;
    }

    const token = getAdminToken();
    if (!token) return;

    setPasswordLoading(true);
    const res = await changeAdminPassword(oldPassword, newPassword, token);
    setPasswordLoading(false);

    if (res.success) {
      setPasswordSuccess("Password updated successfully! Please remember your new password.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPasswordError(res.message || "Failed to change password.");
    }
  };

  // Export Backup Handler
  const handleExportBackup = async () => {
    const token = getAdminToken();
    if (!token) return;

    const data = await fetchSystemBackup(token);
    if (!data) {
      alert("Failed to export backup.");
      return;
    }

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data.backup || data, null, 2)
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute(
      "download",
      `SmartAttendance_Backup_${new Date().toISOString().split("T")[0]}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Reset Attendance Records
  const handleConfirmReset = async () => {
    const token = getAdminToken();
    if (!token) return;

    setResetLoading(true);
    const res = await resetAttendanceLogs(token);
    setResetLoading(false);
    setResetModalOpen(false);

    if (res.success) {
      alert(res.message);
    } else {
      alert(res.message || "Failed to clear attendance logs.");
    }
  };

  // ==========================================
  // RENDER: Security Login Gate (if unauthenticated)
  // ==========================================
  if (isAuthenticated === false) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 animate-fadeIn">
        <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-6 py-8 text-white text-center">
            <div className="inline-flex p-3 bg-white/15 backdrop-blur-md rounded-2xl mb-3 border border-white/20">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-black">Security Protected</h1>
            <p className="text-xs text-blue-100 mt-1">
              Admin authentication is required to access or modify application settings.
            </p>
          </div>

          <div className="p-6 space-y-5">
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleInlineLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Admin Username
                </label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="admin"
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {loginLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>Unlock Settings</span>
              </button>
            </form>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-[11px] space-y-1">
              <span className="font-bold text-slate-700 block">Default Credentials:</span>
              <div className="font-mono flex justify-between bg-white px-2 py-1 rounded border border-slate-200/80">
                <span>user: <strong>admin</strong></span>
                <span>pass: <strong>admin123</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading indicator
  if (loading || isAuthenticated === null) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-600 rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Loading settings...</p>
      </div>
    );
  }

  // ==========================================
  // RENDER: Full Authenticated Settings Page
  // ==========================================
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Application Settings
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Mode
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure campus geofencing, facial recognition sensitivity, timetable rules, and security.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{saving ? "Saving..." : "Save Changes"}</span>
          </button>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Save Alerts */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}
      {saveError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* ========================================== */}
        {/* 1. CAMPUS LOCATION & 100M GEOFENCING PANEL */}
        {/* ========================================== */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Campus Location & Geofencing</h2>
                <p className="text-xs text-slate-500">
                  Defines the geographical center and allowed radius for student attendance.
                </p>
              </div>
            </div>

            {/* Geofence Master Toggle */}
            <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Geofence Enforced:</span>
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({ ...prev, geofence_enabled: !prev.geofence_enabled }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  settings.geofence_enabled ? "bg-blue-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.geofence_enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Campus Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Campus / Classroom Name
              </label>
              <input
                type="text"
                value={settings.campus_name}
                onChange={(e) => setSettings({ ...settings, campus_name: e.target.value })}
                placeholder="e.g. Department of Computer Science / Room 304"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
              />
            </div>

            {/* Latitude */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Latitude Coordinates (GPS)
              </label>
              <input
                type="number"
                step="0.000001"
                value={settings.latitude}
                onChange={(e) => setSettings({ ...settings, latitude: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
              />
            </div>

            {/* Longitude */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Longitude Coordinates (GPS)
              </label>
              <input
                type="number"
                step="0.000001"
                value={settings.longitude}
                onChange={(e) => setSettings({ ...settings, longitude: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
              />
            </div>

            {/* Radius (Meters) */}
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Allowed Geofence Radius
                </label>
                <span className="text-xs font-mono font-bold text-blue-600 px-2 py-0.5 bg-blue-50 rounded-lg border border-blue-200">
                  {settings.radius_meters} meters
                </span>
              </div>

              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={settings.radius_meters}
                onChange={(e) =>
                  setSettings({ ...settings, radius_meters: parseFloat(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer"
              />

              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-400 font-medium">Quick Presets:</span>
                {[50, 100, 200, 300].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSettings({ ...settings, radius_meters: preset })}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                      settings.radius_meters === preset
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {preset}m {preset === 100 && "(Default)"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Detect GPS Button */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Navigation className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                {gpsMessage || "Calibrate to your classroom by auto-detecting your device's live coordinates."}
              </span>
            </div>

            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={detectingGps}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl transition shadow-xs cursor-pointer shrink-0"
            >
              <Compass className={`w-3.5 h-3.5 ${detectingGps ? "animate-spin text-blue-600" : "text-blue-600"}`} />
              <span>{detectingGps ? "Acquiring Fix..." : "Use Current Location"}</span>
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* 2. AI BIOMETRICS & FACE RECOGNITION PANEL  */}
        {/* ========================================== */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">AI Face Recognition Sensitivity</h2>
              <p className="text-xs text-slate-500">
                Adjusts the Euclidean distance matching threshold in Python DeepFace (Facenet).
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Face Match Threshold (Distance Metric)
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lower value = Stricter matching (fewer false positives). Higher value = More lenient.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-600 px-2.5 py-1 bg-indigo-50 rounded-lg border border-indigo-200">
                {settings.match_threshold.toFixed(2)}
              </span>
            </div>

            <input
              type="range"
              min="0.20"
              max="0.60"
              step="0.01"
              value={settings.match_threshold}
              onChange={(e) =>
                setSettings({ ...settings, match_threshold: parseFloat(e.target.value) })
              }
              className="w-full accent-indigo-600 cursor-pointer"
            />

            <div className="flex justify-between text-[11px] font-semibold text-slate-400">
              <span>0.20 (Strict / Identical Twins)</span>
              <span className="text-indigo-600 font-bold">0.40 (Recommended Standard)</span>
              <span>0.60 (Lenient / Low Light)</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Backend face engine uses open-source <strong>DeepFace (Facenet 128D)</strong> with Base64 storage in database.
              </span>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* 3. ATTENDANCE TIMETABLE & POLICIES PANEL   */}
        {/* ========================================== */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Attendance Policies & Timetable</h2>
              <p className="text-xs text-slate-500">
                Automated attendance rules, duplicate prevention, and late mark thresholds.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Late Cutoff Time */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Late Arrival Cutoff Time (24h)
              </label>
              <input
                type="time"
                value={settings.late_cutoff_time}
                onChange={(e) => setSettings({ ...settings, late_cutoff_time: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Students marking attendance after this time will be tagged as <strong>Late</strong>.
              </p>
            </div>

            {/* Duplicate Prevention Toggle */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Prevent Daily Duplicates</span>
                  <span className="text-[11px] text-slate-400">Block students from marking twice on the same date</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, prevent_duplicate: !prev.prevent_duplicate }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    settings.prevent_duplicate ? "bg-purple-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.prevent_duplicate ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Manual Entry Toggle */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Allow Manual Attendance Entry</span>
                  <span className="text-[11px] text-slate-400">Allow teachers to manually mark attendance overrides</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, allow_manual_entry: !prev.allow_manual_entry }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    settings.allow_manual_entry ? "bg-purple-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.allow_manual_entry ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Save Bar Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/25 transition cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? "Saving Configuration..." : "Save All Application Settings"}</span>
          </button>
        </div>
      </form>

      {/* ========================================== */}
      {/* 4. SECURITY & CREDENTIALS MANAGEMENT       */}
      {/* ========================================== */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Admin Security & Password</h2>
            <p className="text-xs text-slate-500">
              Update administrator credentials used to access this settings page.
            </p>
          </div>
        </div>

        {passwordSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{passwordSuccess}</span>
          </div>
        )}
        {passwordError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showOldPass ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Current password"
                required
                className="w-full pl-3 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
              />
              <button
                type="button"
                onClick={() => setShowOldPass(!showOldPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                required
                className="w-full pl-3 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
            />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={passwordLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              {passwordLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Admin Password</span>
            </button>
          </div>
        </form>
      </div>

      {/* ========================================== */}
      {/* 5. SYSTEM TOOLS & DANGER ZONE              */}
      {/* ========================================== */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Database Tools & Danger Zone</h2>
            <p className="text-xs text-slate-500">
              Download system backups or clear test attendance records.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Backup Button */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Complete System Backup (JSON)</span>
              <p className="text-[11px] text-slate-500 mt-1">
                Exports all registered students with Base64 photos, verified attendance records, and location settings.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Download JSON Backup</span>
            </button>
          </div>

          {/* Reset Attendance Button */}
          <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200/80 flex flex-col justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-rose-900 block">Clear Attendance Records</span>
              <p className="text-[11px] text-rose-700 mt-1">
                Removes all attendance logs from the database while keeping registered student profiles intact.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setResetModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Attendance Logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Reset Attendance */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Are you sure?</h3>
              <p className="text-xs text-slate-500">
                This will delete all attendance records from SQLite and MongoDB Atlas. Registered students will NOT be deleted.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={resetLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {resetLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Delete Logs</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
