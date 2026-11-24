"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, setAuth } from "@/lib/api";
import DismissibleToast from "@/components/Toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPassword?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const loginEmail = customEmail || email;
    const loginPassword = customPassword || password;

    try {
      const data = await apiRequest<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      setAuth(data.token, data.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleUseAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("demo1234");
    handleLogin(undefined, demoEmail, "demo1234");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <h1 className="text-4xl font-extrabold text-[#142D4E] tracking-tight">
          Tru<span className="text-[#2563EB]">Brand</span>
        </h1>
        <p className="mt-2 text-base text-[#1E293B]">
          Brand governance, automated review & approval platform
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E2E8F0] rounded-xl sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            <DismissibleToast message={error} onDismiss={() => setError(null)} />

            <div>
              <label
                htmlFor="email"
                className="block text-base font-semibold text-[#1E293B] mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-2.5 text-base border border-[#E2E8F0] rounded-lg text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-base font-semibold text-[#1E293B] mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 text-base border border-[#E2E8F0] rounded-lg text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8] focus:ring-offset-2 transition disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Demo accounts box */}
          <div className="mt-8 pt-6 border-t border-[#E2E8F0]">
            <div className="p-4 bg-slate-50 border border-[#E2E8F0] rounded-xl space-y-3">
              <div className="text-center">
                <h2 className="text-sm font-bold text-[#142D4E] uppercase tracking-wider">
                  Demo accounts
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">Password: demo1234</p>
              </div>

              <p className="text-xs text-slate-600 text-center leading-relaxed">
                Try the flow: log in as creator, create content, run review, submit; then log in as reviewer to approve.
              </p>

              <div className="space-y-2 pt-1">
                {[
                  { role: "Creator", email: "creator@demo.com", desc: "Create, revise & submit drafts" },
                  { role: "Reviewer", email: "reviewer@demo.com", desc: "Review, comment & approve" },
                  { role: "Manager", email: "manager@demo.com", desc: "KB management & blocker override" },
                  { role: "Admin", email: "admin@demo.com", desc: "Full administrative access" },
                ].map((account) => (
                  <div
                    key={account.email}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2.5 bg-white border border-[#E2E8F0] rounded-lg shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#142D4E]">{account.role}</span>
                        <span className="text-[11px] font-mono text-slate-500">({account.email})</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{account.desc}</p>
                    </div>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleUseAccount(account.email)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8] disabled:opacity-50 whitespace-nowrap cursor-pointer text-center"
                    >
                      Use this account
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
