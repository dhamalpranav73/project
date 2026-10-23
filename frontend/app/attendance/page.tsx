"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ClipboardList, 
  Calendar, 
  Search, 
  Download, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Filter, 
  RefreshCw,
  PlusCircle,
  Camera,
  MapPin
} from "lucide-react";
import { 
  fetchAttendance, 
  AttendanceRecord, 
  deleteAttendanceRecord, 
  submitManualAttendance, 
  getAdminToken, 
  verifyAdminSession,
  API_BASE 
} from "@/lib/api";

export default function AttendanceLogsPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [rollFilter, setRollFilter] = useState("");
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualRoll, setManualRoll] = useState("");
  const [manualStatus, setManualStatus] = useState("Present");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const loadAttendance = async () => {
    setLoading(true);
    const data = await fetchAttendance(dateFilter, rollFilter);
    setRecords(data);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(loadAttendance, 250);
    return () => clearTimeout(timer);
  }, [dateFilter, rollFilter]);

  // Check admin privileges
  useEffect(() => {
    const token = getAdminToken();
    if (token) {
      verifyAdminSession(token).then((valid) => setIsAdmin(valid));
    }
  }, []);

  // Export to CSV
  const exportToCSV = () => {
    if (records.length === 0) {
      alert("No attendance records to export.");
      return;
    }

    const headers = ["ID", "Roll Number", "Name", "Class", "Date", "Time", "Status", "Campus Distance (m)", "AI Distance", "Verification Method"];
    const rows = records.map((r) => [
      r.id || "",
      r.roll_number,
      `"${r.name}"`,
      `"${r.class_name}"`,
      r.date,
      r.time,
      r.status,
      r.distance_from_campus !== null && r.distance_from_campus !== undefined ? Math.round(r.distance_from_campus) : "",
      r.confidence !== null && r.confidence !== undefined ? r.confidence : "",
      `"${r.verification_method || "AI Face Match"}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_Report_${dateFilter || "All"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete attendance record
  const handleDelete = async (id: number | string | undefined) => {
    if (id === undefined || id === null) return;
    const token = getAdminToken();
    if (!token) {
      alert("Administrator login is required to delete attendance records. Please log in first.");
      window.location.href = "/login";
      return;
    }

    if (!confirm("Are you sure you want to remove this attendance record?")) return;

    try {
      const res = await deleteAttendanceRecord(id, token);
      if (res.success) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
      } else {
        alert(res.message || "Failed to delete record.");
      }
    } catch (err: any) {
      alert("Failed to delete record: " + err.message);
    }
  };

  // Submit Manual Attendance
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRoll.trim()) return;

    const token = getAdminToken();
    if (!token) {
      alert("Administrator login is required to record manual attendance. Please log in first.");
      window.location.href = "/login";
      return;
    }

    setManualSubmitting(true);
    try {
      const res = await submitManualAttendance(
        manualRoll.trim().toUpperCase(),
        manualStatus,
        dateFilter || undefined,
        token
      );
      if (res.success) {
        setManualModalOpen(false);
        setManualRoll("");
        loadAttendance();
      } else {
        alert(res.message || "Failed to record manual attendance.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Attendance Logs & Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Verified biometric logs recorded directly into database with timestamps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setManualModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition"
            >
              <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
              Manual Entry
            </button>
          )}

          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            Export CSV
          </button>

          <Link
            href="/attendance/mark"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 transition"
          >
            <Camera className="w-3.5 h-3.5" />
            Mark Live
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:bg-white transition"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="text-xs text-slate-400 hover:text-slate-600 font-semibold px-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Roll Filter */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={rollFilter}
            onChange={(e) => setRollFilter(e.target.value)}
            placeholder="Filter by roll number..."
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white transition"
          />
        </div>

        <button
          onClick={loadAttendance}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition"
          title="Refresh logs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Attendance Table */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Fetching database logs...</p>
        </div>
      ) : records.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Roll Number</th>
                  <th className="py-3.5 px-4">Class</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Campus Dist</th>
                  <th className="py-3.5 px-4">Verification</th>
                  <th className="py-3.5 px-4">AI Distance</th>
                  {isAdmin && <th className="py-3.5 px-4 text-right">Delete</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{r.date}</span>
                      <span className="text-[11px] text-slate-400 font-medium">{r.time}</span>
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-800">
                      {r.name}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      {r.roll_number}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {r.class_name}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        r.status === "Present" 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : r.status === "Late"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {r.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {r.distance_from_campus !== null && r.distance_from_campus !== undefined ? (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                          r.distance_from_campus <= 100 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          <MapPin className="w-3 h-3" />
                          {Math.round(r.distance_from_campus)}m
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-xs text-slate-500">
                      {r.verification_method || "AI Face Match"}
                    </td>

                    <td className="py-3 px-4 text-xs font-mono text-slate-500">
                      {r.confidence !== null && r.confidence !== undefined ? r.confidence : "—"}
                    </td>

                    {isAdmin && (
                      <td className="py-3 px-4 text-right">
                        {r.id !== undefined && r.id !== null && (
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-3">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">No Attendance Records</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {dateFilter || rollFilter ? "No attendance found matching this filter." : "No students have marked attendance yet."}
          </p>
          <Link
            href="/attendance/mark"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
          >
            <Camera className="w-3.5 h-3.5" />
            Mark Attendance Station
          </Link>
        </div>
      )}

      {/* Manual Attendance Modal */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl space-y-4 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Manual Attendance Entry</h3>
            <p className="text-xs text-slate-500">Override attendance status for a registered student.</p>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase">Roll Number *</label>
                <input
                  type="text"
                  required
                  value={manualRoll}
                  onChange={(e) => setManualRoll(e.target.value)}
                  placeholder="e.g. MCA001"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase">Status</label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none"
                >
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {manualSubmitting ? "Saving..." : "Record Attendance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
