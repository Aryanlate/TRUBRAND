"use client";

import React, { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiRequest, getStoredUser } from "@/lib/api";
import DismissibleToast from "@/components/Toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface RuleStat {
  rule_id: string;
  total: number;
  dismissed: number;
  dismissal_rate: number;
}

interface GapRule extends RuleStat {
  recommendation: string;
}

interface ExpiringClaim {
  id: string;
  phrase: string;
  evidence: string;
  expires_on: string;
  days_remaining: number;
  is_expired: boolean;
}

interface ScorePerDay {
  date: string;
  average_score: number;
  count: number;
}

interface CategoryStat {
  category: string;
  count: number;
}

interface InsightsData {
  top_rules: RuleStat[];
  gap_rules: GapRule[];
  override_count: number;
  average_score_per_day: ScorePerDay[];
  claims_expiring: ExpiringClaim[];
  most_frequent_categories: CategoryStat[];
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    apiRequest<InsightsData>("/insights")
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load governance insights");
        setLoading(false);
      });
  }, []);

  const user = mounted ? getStoredUser() : null;
  const isManagerOrAdmin = user?.role === "manager" || user?.role === "admin";

  return (
    <AppShell>
      <div className="space-y-8 max-w-full">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#142D4E] tracking-tight">
            Governance Insights
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            Rule performance, compliance trends, rule gaps, and expiring claim alerts.
          </p>
        </div>

        {/* Dismissible Error Toast */}
        <DismissibleToast message={error} onDismiss={() => setError(null)} />

        {loading ? (
          <div className="space-y-8">
            {/* Stat Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-2 animate-pulse"
                >
                  <div className="h-3 bg-slate-200 rounded w-24" />
                  <div className="h-8 bg-slate-200 rounded w-16" />
                  <div className="h-3 bg-slate-200 rounded w-36" />
                </div>
              ))}
            </div>

            {/* Charts Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-48" />
                <div className="h-3 bg-slate-200 rounded w-64" />
                <div className="h-64 bg-slate-100 rounded-lg" />
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-48" />
                <div className="h-3 bg-slate-200 rounded w-64" />
                <div className="h-64 bg-slate-100 rounded-lg" />
              </div>
            </div>

            {/* Tables Skeleton */}
            <div className="space-y-8">
              <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-6 space-y-3 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-40" />
                <div className="h-28 bg-slate-100 rounded-lg" />
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-6 space-y-3 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-40" />
                <div className="h-28 bg-slate-100 rounded-lg" />
              </div>
            </div>
          </div>
        ) : data ? (
          <>
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Blocker Overrides
                </div>
                <div className="text-3xl font-extrabold text-[#142D4E]">
                  {data.override_count}
                </div>
                <div className="text-xs text-slate-600">
                  Approved content with documented blocker override
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active Rule Gaps
                </div>
                <div className="text-3xl font-extrabold text-[#D97706]">
                  {data.gap_rules.length}
                </div>
                <div className="text-xs text-slate-600">
                  Rules with ≥5 findings and ≥40% dismissal rate
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Expiring / Expired Claims
                </div>
                <div className="text-3xl font-extrabold text-[#B91C1C]">
                  {data.claims_expiring.length}
                </div>
                <div className="text-xs text-slate-600">
                  Evidence expires within 30 days or already expired
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Top Violated Rule
                </div>
                <div className="text-3xl font-extrabold text-[#2563EB]">
                  {data.top_rules[0]?.rule_id || "None"}
                </div>
                <div className="text-xs text-slate-600 truncate">
                  {data.top_rules[0] ? `${data.top_rules[0].total} total findings recorded` : "No rule findings yet"}
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Bar Chart: Top Rules */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-6 shadow-sm space-y-4 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#142D4E]">Top Rules by Finding Count</h2>
                    <p className="text-xs text-slate-500">Rules that generate the most findings across all reviews</p>
                  </div>
                </div>

                {data.top_rules.length === 0 ? (
                  <div className="h-[260px] sm:h-[280px] flex flex-col items-center justify-center text-slate-400 text-sm p-4 text-center">
                    <span className="text-3xl mb-2">📊</span>
                    <span>No rule findings data available yet.</span>
                  </div>
                ) : (
                  <div className="h-[280px] sm:h-[300px] w-full pt-2">
                    {mounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.top_rules.slice(0, 8)}
                          margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis
                            dataKey="rule_id"
                            tick={{ fill: "#1E293B", fontSize: 11, fontWeight: 600 }}
                            interval={0}
                          />
                          <YAxis tick={{ fill: "#64748B", fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #E2E8F0",
                              borderRadius: "0.75rem",
                              fontSize: "13px",
                              color: "#1E293B",
                            }}
                          />
                          <Bar
                            dataKey="total"
                            name="Total Findings"
                            fill="#2563EB"
                            radius={[6, 6, 0, 0]}
                          />
                          <Bar
                            dataKey="dismissed"
                            name="Dismissed"
                            fill="#38BDF8"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </div>

              {/* Line Chart: Average Score */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-6 shadow-sm space-y-4 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#142D4E]">Average Brand Score Trend</h2>
                    <p className="text-xs text-slate-500">Daily average score across content revisions</p>
                  </div>
                </div>

                {data.average_score_per_day.length === 0 ? (
                  <div className="h-[260px] sm:h-[280px] flex flex-col items-center justify-center text-slate-400 text-sm p-4 text-center">
                    <span className="text-3xl mb-2">📈</span>
                    <span>No version review score data available yet.</span>
                  </div>
                ) : (
                  <div className="h-[280px] sm:h-[300px] w-full pt-2">
                    {mounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={data.average_score_per_day}
                          margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis
                            dataKey="date"
                            tick={{ fill: "#1E293B", fontSize: 11, fontWeight: 600 }}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fill: "#64748B", fontSize: 11 }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #E2E8F0",
                              borderRadius: "0.75rem",
                              fontSize: "13px",
                              color: "#1E293B",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="average_score"
                            name="Average Score"
                            stroke="#2563EB"
                            strokeWidth={3}
                            dot={{ fill: "#142D4E", r: 4 }}
                            activeDot={{ r: 6, fill: "#38BDF8" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tables Section */}
            <div className="space-y-8">
              {/* Gap Rules Table */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    <h2 className="text-base sm:text-lg font-bold text-[#142D4E]">Rule Gap Analysis</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Rules with high dismissal rates (≥5 findings and ≥40% dismissed) suggesting ambiguity or friction.
                  </p>
                </div>

                {data.gap_rules.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    ✓ No rule gaps detected. Rules have healthy acceptance rates.
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="min-w-full divide-y divide-[#E2E8F0] text-left">
                      <thead className="bg-[#F8FAFC]">
                        <tr>
                          <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Rule ID</th>
                          <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Total Findings</th>
                          <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Dismissed</th>
                          <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Dismissal Rate</th>
                          <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Recommendation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] bg-white text-sm sm:text-base">
                        {data.gap_rules.map((rule) => (
                          <tr key={rule.rule_id} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 sm:px-6 py-4 font-mono font-bold text-[#142D4E] whitespace-nowrap">
                              {rule.rule_id}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-slate-700">
                              {rule.total}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-[#B91C1C] font-semibold">
                              {rule.dismissed}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-[#D97706]">
                                ⚠️ {Math.round(rule.dismissal_rate * 100)}%
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-4 font-semibold text-[#142D4E]">
                              {rule.recommendation}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Expiring Claims Table */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⏳</span>
                    <h2 className="text-base sm:text-lg font-bold text-[#142D4E]">Expiring & Expired Claims</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Claims with certificates or evidence expiring within 30 days or already invalid.
                  </p>
                </div>

                {data.claims_expiring.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    ✓ All approved claims have active, up-to-date evidence certifications.
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="min-w-full divide-y divide-[#E2E8F0] text-left">
                      <thead className="bg-[#F8FAFC]">
                        <tr>
                          <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Claim ID</th>
                          <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Claim Phrase</th>
                          <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Evidence Reference</th>
                          <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Expires On</th>
                          <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] bg-white text-sm sm:text-base">
                        {data.claims_expiring.map((claim) => (
                          <tr key={claim.id} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 sm:px-6 py-4 font-mono font-bold text-[#142D4E] whitespace-nowrap">
                              {claim.id}
                            </td>
                            <td className="px-4 sm:px-6 py-4 font-bold text-[#142D4E]">
                              &ldquo;{claim.phrase}&rdquo;
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-sm text-slate-700">
                              {claim.evidence || <span className="text-red-600 italic">No evidence recorded</span>}
                            </td>
                            <td className="px-4 sm:px-6 py-4 font-mono text-sm text-slate-700 whitespace-nowrap">
                              {claim.expires_on}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              {claim.is_expired ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-[#B91C1C] border border-[#B91C1C]">
                                  <span>⛔</span> Expired
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-[#D97706] border border-[#D97706]">
                                  <span>⚠️</span> Expiring in {claim.days_remaining} day{claim.days_remaining === 1 ? "" : "s"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
