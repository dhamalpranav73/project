"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Camera, 
  Users, 
  UserPlus, 
  ClipboardList, 
  LayoutDashboard, 
  Database,
  Menu,
  X,
  Settings
} from "lucide-react";
import { API_BASE } from "@/lib/api";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/database/status`)
      .then((res) => setBackendOnline(res.ok))
      .catch(() => setBackendOnline(false));
  }, [pathname]);

  const navLinks = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Mark Attendance", href: "/attendance/mark", icon: Camera, highlight: true },
    { name: "Students", href: "/students", icon: Users },
    { name: "Register", href: "/students/register", icon: UserPlus },
    { name: "Logs", href: "/attendance", icon: ClipboardList },
    { name: "Database", href: "/diagnostics", icon: Database },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight block">SmartAttendance<span className="text-blue-600">AI</span></span>
              <span className="text-[11px] text-slate-500 font-medium block -mt-1">Biometric Face Recognition</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              if (link.highlight) {
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`ml-2 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-sm ${
                      isActive
                        ? "bg-blue-700 text-white shadow-blue-500/30 ring-2 ring-blue-600 ring-offset-2"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 hover:shadow-md"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.name}
                  </Link>
                );
              }

              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                    isActive
                      ? "bg-slate-100 text-blue-600 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Backend / DB Status Indicator */}
          <div className="hidden md:flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
            <span
              className={`w-2 h-2 rounded-full ${
                backendOnline === true
                  ? "bg-emerald-500 animate-pulse"
                  : backendOnline === false
                  ? "bg-rose-500"
                  : "bg-amber-400"
              }`}
            />
            <span className="text-slate-600">
              {backendOnline === true
                ? "Backend & DB Live"
                : backendOnline === false
                ? "Backend Offline"
                : "Connecting..."}
            </span>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-5 h-5" />
                {link.name}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
