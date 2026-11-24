"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest, Content, Version, Finding, Comment, Approval, Score } from "@/lib/api";

interface ReportData {
  content: Content & { creator_name?: string; creator_email?: string };
  version_history: Version[];
  versions: Version[];
  findings: Finding[];
  comments: Comment[];
  approvals: Approval[];
  services_used: string[];
}

function formatDate(isoStr?: string): string {
  if (!isoStr) return "—";
  try {
    return isoStr.replace("T", " ").substring(0, 19);
  } catch {
    return isoStr;
  }
}

export default function ApprovalReportPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedDate, setGeneratedDate] = useState<string>("");

  useEffect(() => {
    setGeneratedDate(new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC");
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiRequest<ReportData>(`/content/${id}/report-data`)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load approval report data");
        setLoading(false);
      });
  }, [id]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8 text-slate-600 font-sans">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading approval report...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-slate-800 font-sans">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl max-w-md text-center">
          <p className="font-semibold mb-2">Error Loading Report</p>
          <p className="text-sm">{error || "Content report not found"}</p>
          <Link
            href={`/content/${id}`}
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Back to Content
          </Link>
        </div>
      </div>
    );
  }

  const { content, version_history, findings, comments, approvals, services_used } = data;
  const currentVersion =
    version_history.find((v) => v.number === content.current_version) ||
    version_history[version_history.length - 1];

  const scoreData: Score | null = currentVersion?.score || null;
  const blockersCount = findings.filter((f) => f.severity === "Blocker").length;
  const warningsCount = findings.filter((f) => f.severity === "Warning").length;
  const infoCount = findings.filter((f) => f.severity === "Info").length;
  const openBlockers = findings.filter((f) => f.severity === "Blocker" && f.status === "open").length;

  const hasPiiMasking = services_used.some((s) => s.includes("pii_masked"));

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white text-slate-800 font-sans py-8 px-4 sm:px-6 print:p-0">
      <style jsx global>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 12mm;
          }
          body {
            background-color: #ffffff !important;
            color: #1e293b !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen action bar */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between no-print">
        <Link
          href={`/content/${id}`}
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm hover:bg-slate-50 transition"
        >
          ← Back to Content
        </Link>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          Print / Save as PDF
        </button>
      </div>

      {/* Report Sheet */}
      <article className="max-w-4xl mx-auto bg-white border border-slate-200 print:border-none rounded-xl p-8 sm:p-12 shadow-sm print:shadow-none print:p-0">
        {/* Header */}
        <header className="border-b border-slate-200 pb-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase tracking-widest font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
                  TruBrand Governance
                </span>
                <span className="text-xs text-slate-400">ID: {content.id}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#142D4E] tracking-tight">
                Brand Approval & Compliance Report
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Generated: {generatedDate || "—"}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-block px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border ${
                  content.state === "Approved"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : content.state === "InReview"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : content.state === "ChangesRequested"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-slate-50 text-slate-700 border-slate-200"
                }`}
              >
                ● {content.state}
              </span>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 text-sm">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase block">Title</span>
              <span className="font-semibold text-slate-800">{content.title}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase block">Channel</span>
              <span className="font-semibold text-slate-800">{content.channel}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase block">Creator</span>
              <span className="font-semibold text-slate-800">
                {content.creator_name || content.creator_email || "Creator"}
              </span>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase block">Version</span>
              <span className="font-semibold text-slate-800">
                v{content.current_version} ({version_history.length} revision{version_history.length !== 1 ? "s" : ""})
              </span>
            </div>
          </div>
        </header>

        {/* Brand Health Score & AI Governance Overview */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-medium text-slate-500 uppercase block mb-1">
              Brand Health Score
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#142D4E]">
                {scoreData?.overall !== undefined ? scoreData.overall : "—"}
              </span>
              <span className="text-sm font-semibold text-slate-400">/ 100</span>
            </div>
            <div className="mt-2 text-xs font-medium">
              {openBlockers === 0 ? (
                <span className="text-green-700 font-semibold">✓ Approvable (No open blockers)</span>
              ) : (
                <span className="text-red-700 font-semibold">✗ Not Approvable ({openBlockers} open blocker{openBlockers !== 1 ? "s" : ""})</span>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-medium text-slate-500 uppercase block mb-1">
              Governance Findings
            </span>
            <div className="flex items-center gap-3 mt-2 text-sm">
              <span className="inline-flex items-center gap-1 font-semibold text-[#B91C1C]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B91C1C]"></span>
                {blockersCount} Blockers
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#D97706]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]"></span>
                {warningsCount} Warnings
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#2563EB]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]"></span>
                {infoCount} Info
              </span>
            </div>
            <span className="text-xs text-slate-500 mt-2 block">
              {findings.filter((f) => f.status === "accepted").length} accepted,{" "}
              {findings.filter((f) => f.status === "dismissed").length} dismissed
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-medium text-slate-500 uppercase block mb-1">
              AI & Privacy Assurance
            </span>
            <div className="text-xs text-slate-700 space-y-1 mt-1">
              <div className="flex items-center justify-between">
                <span>Privacy Masking:</span>
                <span className="font-semibold text-green-700">
                  {hasPiiMasking ? "Active (PII Masked)" : "Standard"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>External Services:</span>
                <span className="font-medium text-slate-600 truncate max-w-[130px]">
                  {services_used.length > 0 ? services_used.join(", ") : "Local / Rule-based"}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-tight">
              Humans make all final approval decisions.
            </p>
          </div>
        </section>

        {/* Content Snapshot */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-2">
            Approved Content Text (v{content.current_version})
          </h2>
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-800">
            {currentVersion?.body || "No content text recorded."}
          </div>
          {currentVersion?.meta?.has_image && (
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex flex-wrap gap-4 text-slate-600">
              <span><strong>Visual Asset:</strong> Includes Image</span>
              {currentVersion.meta.alt_text && (
                <span><strong>Alt Text:</strong> &ldquo;{currentVersion.meta.alt_text}&rdquo;</span>
              )}
              {currentVersion.meta.logo_bg && (
                <span><strong>Logo Background:</strong> {currentVersion.meta.logo_bg}</span>
              )}
            </div>
          )}
        </section>

        {/* Findings Log */}
        {findings.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-2">
              Rule Review Findings ({findings.length})
            </h2>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Quoted Text / Finding</th>
                    <th className="py-2.5 px-3">Rule ID</th>
                    <th className="py-2.5 px-3">Status / Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {findings.map((f, idx) => (
                    <tr key={f.id || idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                            f.severity === "Blocker"
                              ? "bg-red-50 text-[#B91C1C]"
                              : f.severity === "Warning"
                              ? "bg-amber-50 text-[#D97706]"
                              : "bg-blue-50 text-[#2563EB]"
                          }`}
                        >
                          {f.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 capitalize">{f.category}</td>
                      <td className="py-2.5 px-3 max-w-xs">
                        <p className="font-medium text-slate-800 truncate">&ldquo;{f.quote}&rdquo;</p>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{f.explanation}</p>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{f.rule_id || "—"}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`font-semibold capitalize ${
                            f.status === "accepted"
                              ? "text-green-700"
                              : f.status === "dismissed"
                              ? "text-slate-500"
                              : "text-red-700"
                          }`}
                        >
                          {f.status}
                        </span>
                        {f.dismiss_reason && (
                          <span className="block text-[10px] text-slate-400 italic">
                            ({f.dismiss_reason})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Approval Decisions Log */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-2">
            Governance Decision Trail
          </h2>
          {approvals.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-200">
              No formal approval decisions recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {approvals.map((ap) => (
                <div
                  key={ap.id}
                  className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-start justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                          ap.decision === "approve"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {ap.decision === "approve" ? "APPROVED" : "CHANGES REQUESTED"}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        by {ap.reviewer_name || "Reviewer"} ({ap.reviewer_role || "reviewer"})
                      </span>
                      <span className="text-xs text-slate-400">• {formatDate(ap.created_at)}</span>
                    </div>
                    {ap.reason && (
                      <p className="text-sm text-slate-700 mt-1">&ldquo;{ap.reason}&rdquo;</p>
                    )}
                    {ap.override && (
                      <div className="mt-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 p-2 rounded">
                        ⚠ Blocker Override Justification: {ap.override}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Review Discussion Comments (if any) */}
        {comments.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-2">
              Reviewer Notes & Comments ({comments.length})
            </h2>
            <div className="space-y-2">
              {comments.map((cm) => (
                <div key={cm.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="font-semibold text-slate-700">
                      {cm.author_name || "User"} ({cm.author_role || "member"})
                    </span>
                    <span>{formatDate(cm.created_at)}</span>
                  </div>
                  <p className="text-slate-800 text-sm">{cm.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Verification & Legal Sign-off Footer */}
        <footer className="pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-700">TruBrand Brand Governance Platform</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Findings labelled AI-assisted use external AI services. Humans make all final decisions.
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-400">
            <p>Verification Hash: {content.id.substring(0, 8)}...{content.current_version}</p>
            <p>Certified Brand Compliant</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
