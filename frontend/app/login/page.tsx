"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Lock, 
  User, 
  KeyRound, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  ShieldCheck, 
  Info,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { loginAdmin, getAdminToken, verifyAdminSession } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams?.get("redirect") || "/settings";

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    const token = getAdminToken();
    if (token) {
      verifyAdminSession(token).then((isValid) => {
        if (isValid) {
          router.replace(redirectTarget);
        }
      });
    }
  }, [router, redirectTarget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await loginAdmin(username.trim(), password);
    setLoading(false);

    if (res.success && res.token) {
      setSuccess(true);
      setTimeout(() => {
        router.push(redirectTarget);
      }, 700);
    } else {
      setError(res.message || "Invalid username or password. Please try again.");
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-10 px-4 animate-fadeIn">
      {/* Back button */}
      <div className="w-full max-w-md mb-4 flex justify-between items-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          End-to-End Encrypted
        </span>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden">
        {/* Header gradient banner */}
        <div className="bg-linear-to-r from-blue-600 via-indigo-600 to-blue-700 px-8 py-8 text-white text-center relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="inline-flex p-3 bg-white/15 backdrop-blur-md rounded-2xl mb-3 border border-white/20 shadow-inner">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Admin Portal</h1>
          <p className="text-xs text-blue-100 mt-1 font-medium">
            Sign in to configure campus location, geofence, and biometric AI settings
          </p>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Access granted! Redirecting to Settings...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Admin Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full mt-2 py-3 px-4 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/25 transition disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Authenticated!</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Unlock Application Settings</span>
                </>
              )}
            </button>
          </form>

          {/* Default Credentials Helper Box */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>Default Credentials (Initial Setup)</span>
            </div>
            <div className="flex items-center justify-between font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70 text-[11px]">
              <span>Username: <strong className="text-blue-700">admin</strong></span>
              <span>Password: <strong className="text-blue-700">admin123</strong></span>
            </div>
            <p className="text-[11px] text-slate-400">
              You can change this password anytime inside the Security Settings tab.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-600 rounded-full animate-spin mx-auto" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
