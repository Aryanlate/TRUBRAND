"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, getStoredToken, getStoredUser, clearAuth, apiRequest } from "@/lib/api";
import BrandAssistant from "@/components/BrandAssistant";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    const token = getStoredToken();
    const currentUser = getStoredUser();

    if (!token || !currentUser) {
      clearAuth();
      router.push("/login");
      return;
    }

    setUser(currentUser);
    setLoading(false);

    apiRequest<string[]>("/providers")
      .then((res) => setProviders(Array.isArray(res) ? res : []))
      .catch(() => {});
  }, [router]);

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-[#1E293B] text-lg font-medium animate-pulse">Loading TruBrand...</div>
      </div>
    );
  }

  const isManagerOrAdmin = user.role === "manager" || user.role === "admin";

  const navLinks = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "New content", href: "/content/new" },
    ...(isManagerOrAdmin
      ? [
          { label: "Knowledge base", href: "/kb" },
          { label: "Insights", href: "/insights" },
          { label: "Audit", href: "/audit" },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#1E293B]">
      {/* Top Bar */}
      <header className="bg-[#142D4E] text-white shadow-sm border-b border-[#142D4E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-2xl font-bold tracking-tight text-white focus:outline-none focus:ring-2 focus:ring-[#38BDF8] rounded px-1"
            >
              Tru<span className="text-[#38BDF8]">Brand</span>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-2">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-lg text-sm sm:text-base font-medium transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8] ${
                      isActive
                        ? "bg-[#2563EB] text-white"
                        : "text-slate-200 hover:text-white hover:bg-[#1E3A63]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-sm font-semibold text-white leading-tight">{user.name}</span>
              <span className="text-xs uppercase tracking-wider text-[#38BDF8] font-bold">
                {user.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-sm sm:text-base font-medium bg-[#1E3A63] text-white hover:bg-red-700 transition focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#E2E8F0] bg-white py-4 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p>
            Findings labelled <span className="font-bold text-[#142D4E]">AI-assisted</span> use external AI services. Humans make all final decisions.
          </p>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="font-semibold text-slate-600">Configured AI Providers:</span>
            {providers.length > 0 ? (
              providers.map((p) => (
                <span
                  key={p}
                  className="px-2 py-0.5 rounded bg-slate-100 text-[#142D4E] font-mono text-[11px] font-bold uppercase border border-[#E2E8F0]"
                >
                  {p}
                </span>
              ))
            ) : (
              <span className="italic text-slate-400">None detected (Rule-based only)</span>
            )}
          </div>
        </div>
      </footer>

      {/* Floating Brand Assistant */}
      <BrandAssistant />
    </div>
  );
}
