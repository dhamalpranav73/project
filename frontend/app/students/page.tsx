"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Users, 
  UserPlus, 
  Search, 
  Trash2, 
  Camera, 
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Filter
} from "lucide-react";
import { fetchStudents, Student, deleteStudent, getAdminToken, API_BASE } from "@/lib/api";

export default function StudentsDirectoryPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [deletingRoll, setDeletingRoll] = useState<string | null>(null);

  const loadStudents = async () => {
    setLoading(true);
    const data = await fetchStudents(search, classFilter);
    setStudents(data);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStudents();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, classFilter]);

  const handleDelete = async (roll: string, name: string) => {
    const token = getAdminToken();
    if (!token) {
      alert("Administrator login is required to delete students. Please log in first.");
      window.location.href = "/login";
      return;
    }

    if (!confirm(`Are you sure you want to delete student ${name} (${roll}) from the database?`)) return;

    setDeletingRoll(roll);
    try {
      const res = await deleteStudent(roll, token);
      if (res.success) {
        setStudents((prev) => prev.filter((s) => s.roll_number !== roll));
      } else {
        alert(res.message || "Failed to delete student");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setDeletingRoll(null);
    }
  };

  // Get unique classes for filter
  const classes = Array.from(new Set(students.map((s) => s.class_name))).filter(Boolean);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Student Roster
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Registered students with biometric facial profiles stored in database.
          </p>
        </div>

        <Link
          href="/students/register"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-blue-500/20 transition self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Add Student
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student by name or roll number..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="w-full sm:w-44 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:bg-white transition"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Student List Grid / Table */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading database records...</p>
        </div>
      ) : students.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Student Profile</th>
                  <th className="py-3.5 px-4">Roll Number</th>
                  <th className="py-3.5 px-4">Class</th>
                  <th className="py-3.5 px-4">Face Status</th>
                  <th className="py-3.5 px-4">Registered On</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <tr key={student.roll_number} className="hover:bg-slate-50/60 transition">
                    {/* Profile */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {student.image_base64 ? (
                          <img
                            src={student.image_base64}
                            alt={student.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold shrink-0">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{student.name}</p>
                          <p className="text-[11px] text-slate-400">{student.email || "No email"}</p>
                        </div>
                      </div>
                    </td>

                    {/* Roll */}
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                      {student.roll_number}
                    </td>

                    {/* Class */}
                    <td className="py-3 px-4 text-slate-600">
                      {student.class_name}
                    </td>

                    {/* Face Base64 status */}
                    <td className="py-3 px-4">
                      {student.image_base64 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Base64 Stored
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                          <AlertTriangle className="w-3 h-3" />
                          Missing Image
                        </span>
                      )}
                    </td>

                    {/* Registered Date */}
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {student.registered_at ? student.registered_at.split(" ")[0] : "—"}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/attendance/mark`}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Verify face attendance"
                        >
                          <Camera className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(student.roll_number, student.name)}
                          disabled={deletingRoll === student.roll_number}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                          title="Delete student"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-3">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">No Students Found</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search || classFilter ? "No students matched your search criteria." : "Start by registering your first student into the database."}
          </p>
          <Link
            href="/students/register"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Register Student Now
          </Link>
        </div>
      )}
    </div>
  );
}
