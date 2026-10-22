"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Users, 
  UserCheck, 
  UserX, 
  Percent, 
  Camera, 
  UserPlus, 
  ClipboardList, 
  Database,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { fetchStats, DashboardStats } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    const data = await fetchStats();
    setStats(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Attendance Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time biometric facial recognition and student attendance tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
            Refresh
          </button>

          <Link
            href="/attendance/mark"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 hover:shadow-md transition"
          >
            <Camera className="w-4 h-4" />
            Mark Attendance
          </Link>
        </div>
      </div>

      {/* Database Status Alert */}
      {stats && (
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          stats.diagnostics.mongo_atlas.connected 
            ? "bg-emerald-50/70 border-emerald-200 text-emerald-900" 
            : "bg-amber-50/70 border-amber-200 text-amber-900"
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${stats.diagnostics.mongo_atlas.connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold">
                  Database Engine: {stats.diagnostics.mongo_atlas.connected ? "MongoDB Atlas (Online & Synced)" : "SQLite Local Database (Operational)"}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/80 border">
                  {stats.diagnostics.counts.total_students} Students Stored
                </span>
              </div>
              <p className="text-xs mt-0.5 opacity-90">
                {stats.diagnostics.mongo_atlas.connected 
                  ? "All students and attendance logs are securely persisted in MongoDB Atlas."
                  : stats.diagnostics.ip_whitelist_instruction}
              </p>
            </div>
          </div>

          <Link 
            href="/diagnostics"
            className="text-xs font-bold underline shrink-0 hover:opacity-80"
          >
            View DB Diagnostics →
          </Link>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Students */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Registered</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900">
              {loading ? "—" : stats?.total_students ?? 0}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Active student profiles</p>
        </div>

        {/* Present Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Present Today</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-emerald-600">
              {loading ? "—" : stats?.present_today ?? 0}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Verified today via AI / Admin</p>
        </div>

        {/* Absent Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Absent Today</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <UserX className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-rose-600">
              {loading ? "—" : stats?.absent_today ?? 0}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Unmarked students</p>
        </div>

        {/* Attendance Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Attendance Rate</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {loading ? "—" : `${stats?.attendance_rate ?? 0}%`}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div 
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${stats?.attendance_rate ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          href="/attendance/mark"
          className="group relative overflow-hidden bg-linear-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-md shadow-blue-500/20 hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-white/15 rounded-xl backdrop-blur-xs">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <ArrowRight className="w-5 h-5 opacity-70 group-hover:translate-x-1 transition-transform" />
          </div>
          <h2 className="text-lg font-bold mt-4">Mark Attendance</h2>
          <p className="text-xs text-blue-100 mt-1">
            Open live camera, align face, and automatically record attendance via DeepFace AI.
          </p>
        </Link>

        <Link
          href="/students/register"
          className="group relative overflow-hidden bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all hover:border-blue-300"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <UserPlus className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-4">Register Student</h2>
          <p className="text-xs text-slate-500 mt-1">
            Capture face photo and store student profile as Base64 in database.
          </p>
        </Link>

        <Link
          href="/attendance"
          className="group relative overflow-hidden bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all hover:border-blue-300"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <ClipboardList className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-4">Attendance Reports</h2>
          <p className="text-xs text-slate-500 mt-1">
            Filter by date/class, export CSV reports, and review AI verification logs.
          </p>
        </Link>
      </div>

      {/* 7-Day Trend & Recent Logs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Trend Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                7-Day Attendance Trend
              </h2>
              <p className="text-xs text-slate-500">Daily present count over the past week</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-md text-slate-600">
              Past 7 Days
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 h-44 items-end pt-4 pb-2 border-b border-slate-100">
            {stats?.trend_7_days.map((item) => {
              const total = stats.total_students || 1;
              const heightPct = Math.max(12, Math.round((item.present / total) * 100));

              return (
                <div key={item.date} className="flex flex-col items-center gap-2 group">
                  <span className="text-[11px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.present}
                  </span>
                  <div className="w-full bg-slate-100 rounded-t-lg relative flex items-end h-32 overflow-hidden">
                    <div
                      className="w-full bg-linear-to-t from-blue-600 to-indigo-500 rounded-t-lg transition-all duration-500 group-hover:from-blue-500 group-hover:to-indigo-400"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 truncate max-w-full">
                    {item.day.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-3">
            <span>Visualized student presence by day</span>
            <span>Based on verified records</span>
          </div>
        </div>

        {/* Recent Attendance Stream */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Recent Activity
            </h2>
            <Link href="/attendance" className="text-xs text-blue-600 hover:underline font-semibold">
              View All
            </Link>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-72">
            {stats?.recent_logs && stats.recent_logs.length > 0 ? (
              stats.recent_logs.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {log.name ? log.name.charAt(0).toUpperCase() : "S"}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{log.name}</h4>
                      <p className="text-[11px] text-slate-500">{log.roll_number} • {log.class_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-emerald-600 block">{log.time}</span>
                    <span className="text-[10px] text-slate-400 block">{log.date}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs">
                No recent attendance records yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
