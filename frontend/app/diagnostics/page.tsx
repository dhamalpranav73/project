"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ShieldCheck, 
  ExternalLink,
  Layers,
  ArrowLeft,
  Server
} from "lucide-react";
import { API_BASE } from "@/lib/api";

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const fetchDiagnostics = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/database/status`);
      const data = await res.json();
      setDiagnostics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setTesting(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <button
          onClick={fetchDiagnostics}
          disabled={testing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin text-blue-600" : ""}`} />
          Test Connection Now
        </button>
      </div>

      <div className="text-center max-w-lg mx-auto">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Database & System Health
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Diagnostics for student profiles, facial Base64 data, and attendance records.
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Checking database connections...</p>
        </div>
      ) : diagnostics ? (
        <div className="space-y-6">
          {/* Engine Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* MongoDB Atlas Card */}
            <div className={`p-6 rounded-2xl border shadow-xs ${
              diagnostics.mongo_atlas.connected 
                ? "bg-emerald-50/70 border-emerald-200" 
                : "bg-amber-50/70 border-amber-200"
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2.5 rounded-xl ${
                    diagnostics.mongo_atlas.connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">MongoDB Atlas Cloud</h3>
                    <p className="text-[11px] text-slate-500">Primary Cloud Cluster</p>
                  </div>
                </div>

                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  diagnostics.mongo_atlas.connected 
                    ? "bg-emerald-200 text-emerald-900" 
                    : "bg-amber-200 text-amber-900"
                }`}>
                  {diagnostics.mongo_atlas.connected ? "ONLINE" : "OFFLINE / PENDING"}
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                Status: <strong>{diagnostics.mongo_atlas.status_text}</strong>
              </p>

              {!diagnostics.mongo_atlas.connected && (
                <div className="mt-4 p-3 bg-white/90 rounded-xl border border-amber-300/80 text-xs text-amber-900 space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    How to fix Atlas Connection (IP Whitelist):
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-700">
                    <li>Log in to <a href="https://cloud.mongodb.com" target="_blank" className="font-semibold text-blue-600 underline">cloud.mongodb.com</a></li>
                    <li>Click <strong>Network Access</strong> under Security.</li>
                    <li>Click <strong>Add IP Address</strong> &rarr; Add <code>0.0.0.0/0</code> (Allow Access Anywhere).</li>
                    <li>Click <strong>Confirm</strong>, wait 1-2 minutes, then click &ldquo;Test Connection Now&rdquo;.</li>
                  </ol>
                </div>
              )}
            </div>

            {/* Local Synchronized Database Card */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Local Relational Database</h3>
                    <p className="text-[11px] text-slate-500">Zero-downtime Engine</p>
                  </div>
                </div>

                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  OPERATIONAL
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                File: <code>{diagnostics.local_database.file}</code>
              </p>
              <p className="text-xs text-slate-500 mt-2">
                All student registrations, facial Base64 data, and attendance records are stored with full relational integrity and instant query performance.
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Total Stored Students:</span>
                <span className="font-mono text-blue-600">{diagnostics.counts.total_students}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Total Attendance Records:</span>
                <span className="font-mono text-blue-600">{diagnostics.counts.total_attendance_records}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-rose-500 text-sm">
          Failed to load diagnostics from backend server.
        </div>
      )}
    </div>
  );
}
