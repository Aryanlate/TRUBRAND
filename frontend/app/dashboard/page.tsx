"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Content, apiRequest } from "@/lib/api";
import DismissibleToast from "@/components/Toast";

export default function DashboardPage() {
  const [items, setItems] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<Content[]>("/content")
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load content");
        setLoading(false);
      });
  }, []);

  const getStateBadge = (state: string) => {
    switch (state) {
      case "Approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <span>✓</span> Approved
          </span>
        );
      case "ChangesRequested":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-[#B91C1C]">
            <span>✕</span> Changes Requested
          </span>
        );
      case "InReview":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-[#D97706]">
            <span>⏳</span> In Review
          </span>
        );
      case "Reviewed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-[#2563EB]">
            <span>🔍</span> Reviewed
          </span>
        );
      case "Draft":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
            <span>✏️</span> Draft
          </span>
        );
    }
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "—";
    try {
      return isoStr.replace("T", " ").substring(0, 16);
    } catch {
      return isoStr;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#142D4E] tracking-tight">
              Content Dashboard
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Review, track and govern brand compliance across all channels.
            </p>
          </div>
          <Link
            href="/content/new"
            className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-base font-semibold text-white bg-[#2563EB] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-[#38BDF8] focus:ring-offset-2 transition"
          >
            + New content
          </Link>
        </div>

        {/* Dismissible Error Toast */}
        <DismissibleToast message={error} onDismiss={() => setError(null)} />

        {/* Content Table & States */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="overflow-x-auto p-4 sm:p-6 space-y-4">
              <div className="h-6 bg-slate-200 rounded w-48 animate-pulse mb-4" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg animate-pulse"
                  >
                    <div className="space-y-1.5 flex-1 min-w-[140px]">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-1/3" />
                    </div>
                    <div className="h-6 bg-slate-200 rounded-full w-20" />
                    <div className="h-6 bg-slate-200 rounded-full w-24" />
                    <div className="h-4 bg-slate-200 rounded w-16" />
                  </div>
                ))}
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="text-4xl mb-3">📄</div>
              <h3 className="text-lg font-bold text-[#142D4E]">No content created yet</h3>
              <p className="text-slate-600 mt-1 mb-6 text-sm sm:text-base max-w-md mx-auto">
                Get started by creating your first piece of brand content to review against brand rules and claims.
              </p>
              <Link
                href="/content/new"
                className="inline-flex items-center px-4 py-2.5 text-base font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8] focus:ring-offset-2"
              >
                Create new content
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-[#E2E8F0] text-left">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase tracking-wider">
                      Channel
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase tracking-wider">
                      Version
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase tracking-wider">
                      Created / Updated
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 text-right text-xs font-bold text-[#142D4E] uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] bg-white text-sm sm:text-base">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-[#F8FAFC] transition cursor-pointer"
                      onClick={() => (window.location.href = `/content/${item.id}`)}
                    >
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/content/${item.id}`}
                          className="font-semibold text-[#142D4E] hover:text-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#38BDF8] rounded px-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.title}
                        </Link>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-slate-600">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {item.channel}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        {getStateBadge(item.state)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-slate-600">
                        v{item.current_version}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-slate-500 font-mono">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/content/${item.id}`}
                          className="font-semibold text-[#2563EB] hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-[#38BDF8] rounded px-2 py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
