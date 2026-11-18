"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, setAuth } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await apiRequest<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setAuth(data.token, data.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("demo1234");
    setError(null);
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
            {error && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-[#B91C1C] text-[#B91C1C] rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

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

          {/* Quick-fill Demo Logins */}
          <div className="mt-8 pt-6 border-t border-[#E2E8F0]">
            <p className="text-sm font-semibold text-[#1E293B] mb-3 text-center">
              Quick demo login (password: demo1234)
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => quickFill("creator@demo.com")}
                className="px-3 py-2 text-sm font-medium border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] text-[#142D4E] hover:bg-[#E2E8F0] transition focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                Creator
              </button>
              <button
                type="button"
                onClick={() => quickFill("reviewer@demo.com")}
                className="px-3 py-2 text-sm font-medium border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] text-[#142D4E] hover:bg-[#E2E8F0] transition focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                Reviewer
              </button>
              <button
                type="button"
                onClick={() => quickFill("manager@demo.com")}
                className="px-3 py-2 text-sm font-medium border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] text-[#142D4E] hover:bg-[#E2E8F0] transition focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                Manager
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
