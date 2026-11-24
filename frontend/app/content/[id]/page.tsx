"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import WordDiff from "@/components/WordDiff";
import DismissibleToast from "@/components/Toast";
import {
  Content,
  Finding,
  Score,
  Version,
  Comment,
  User,
  apiRequest,
  getStoredUser,
} from "@/lib/api";

const SEVERITY_ORDER: Record<string, number> = {
  Blocker: 1,
  Warning: 2,
  Info: 3,
};

export default function ContentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedVerNum, setSelectedVerNum] = useState<number>(1);
  const [showDiff, setShowDiff] = useState(false);

  // Review states & banners
  const [reviewing, setReviewing] = useState(false);
  const [maskPii, setMaskPii] = useState(true);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Sources map for citation lookup
  const [sourcesMap, setSourcesMap] = useState<Record<string, { title: string; text: string }>>({});

  // Action states
  const [dismissModalFinding, setDismissModalFinding] = useState<Finding | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [editingSuggestionFinding, setEditingSuggestionFinding] = useState<Finding | null>(null);
  const [editSuggestionText, setEditSuggestionText] = useState("");
  const [whyExplanations, setWhyExplanations] = useState<Record<string, string>>({});
  const [loadingWhy, setLoadingWhy] = useState<Record<string, boolean>>({});

  const handleFetchWhy = async (findingId: string) => {
    if (whyExplanations[findingId]) {
      setWhyExplanations((prev) => {
        const copy = { ...prev };
        delete copy[findingId];
        return copy;
      });
      return;
    }

    setLoadingWhy((prev) => ({ ...prev, [findingId]: true }));
    try {
      const res = await apiRequest<{ explanation: string }>(`/findings/${findingId}/why`, {
        method: "POST",
      });
      setWhyExplanations((prev) => ({ ...prev, [findingId]: res.explanation }));
    } catch (err: any) {
      setWhyExplanations((prev) => ({
        ...prev,
        [findingId]: err?.message || "Failed to retrieve rationale.",
      }));
    } finally {
      setLoadingWhy((prev) => ({ ...prev, [findingId]: false }));
    }
  };

  // Comments
  const [commentText, setCommentText] = useState("");
  const [commentFindingId, setCommentFindingId] = useState<string>("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Decision
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionOverride, setDecisionOverride] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const isPrivileged = user?.role === "reviewer" || user?.role === "manager" || user?.role === "admin";
  const isCreatorOrPrivileged = user?.role === "manager" || user?.role === "admin" || (content && user?.id === content.creator_id);

  const loadContent = async () => {
    try {
      const data = await apiRequest<Content>(`/content/${id}`);
      setContent(data);
      setSelectedVerNum(data.current_version);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to load content");
      setLoading(false);
    }
  };

  useEffect(() => {
    setUser(getStoredUser());
    if (!id) return;
    loadContent();

    // Fetch KB items to power the cited-source chips
    Promise.all([
      apiRequest<any[]>("/kb/rules").catch(() => []),
      apiRequest<any[]>("/kb/facts").catch(() => []),
      apiRequest<any[]>("/kb/claims").catch(() => []),
    ]).then(([rules, facts, claims]) => {
      const map: Record<string, { title: string; text: string }> = {};
      rules?.forEach((r) => {
        if (r.id) map[r.id] = { title: r.title, text: r.text };
      });
      facts?.forEach((f) => {
        if (f.id) map[f.id] = { title: "Verified Fact", text: f.statement };
      });
      claims?.forEach((c) => {
        if (c.id) map[c.id] = { title: `Approved Claim: "${c.phrase}"`, text: c.evidence || "Evidence pending" };
      });
      setSourcesMap(map);
    });
  }, [id]);

  const versions: Version[] = content?.versions || [];
  const currentVer = versions.find((v) => v.number === selectedVerNum) || versions[versions.length - 1];
  const prevVer = versions.find((v) => v.number === selectedVerNum - 1);

  // Findings for the selected version
  const versionFindings: Finding[] = useMemo(() => {
    const raw = (content?.findings || []).filter((f) => f.version_number === selectedVerNum);
    return [...raw].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] || 99) - (SEVERITY_ORDER[b.severity] || 99)
    );
  }, [content?.findings, selectedVerNum]);

  // Open Blockers count on current version
  const openBlockersCount = useMemo(() => {
    return versionFindings.filter((f) => f.severity === "Blocker" && f.status === "open").length;
  }, [versionFindings]);

  // Score
  const currentScore: Score | null = (currentVer?.score as Score) || null;

  // Run Review
  const handleRunReview = async () => {
    setReviewing(true);
    setAiError(null);
    try {
      const res = await apiRequest<{
        findings: Finding[];
        score: Score;
        provider: string | null;
        ai_error: string | null;
      }>(`/content/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ mask_pii: maskPii }),
      });

      setActiveProvider(res.provider);
      setAiError(res.ai_error);
      await loadContent();
    } catch (err: any) {
      setError(err.message || "Review failed");
    } finally {
      setReviewing(false);
    }
  };

  // Apply Accepted Suggestions
  const handleApplySuggestions = async () => {
    const acceptedFindings = versionFindings.filter(
      (f) => f.status === "accepted" && f.suggestion && f.suggestion.trim()
    );

    if (acceptedFindings.length === 0) {
      setError("No accepted suggestions to apply. Please accept one or more suggestions first.");
      return;
    }

    let updatedText = currentVer?.body || "";
    for (const f of acceptedFindings) {
      if (f.quote && f.suggestion && updatedText.includes(f.quote)) {
        updatedText = updatedText.replaceAll(f.quote, f.suggestion);
      }
    }

    setReviewing(true);
    try {
      // 1. Create revised version
      await apiRequest(`/content/${id}/revise`, {
        method: "POST",
        body: JSON.stringify({ text: updatedText, meta: currentVer?.meta || {} }),
      });

      // 2. Re-run review
      const res = await apiRequest<{ provider: string | null; ai_error: string | null }>(
        `/content/${id}/review`,
        { method: "POST" }
      );
      setActiveProvider(res.provider);
      setAiError(res.ai_error);

      await loadContent();
    } catch (err: any) {
      setError(err.message || "Failed to apply suggestions");
    } finally {
      setReviewing(false);
    }
  };

  // Submit for review
  const handleSubmitForReview = async () => {
    try {
      await apiRequest(`/content/${id}/submit`, { method: "POST" });
      await loadContent();
    } catch (err: any) {
      setError(err.message || "Failed to submit for review");
    }
  };

  // Finding action: Accept / Open
  const handleUpdateFindingStatus = async (
    findingId: string,
    status: "open" | "accepted" | "dismissed",
    reason?: string
  ) => {
    try {
      await apiRequest(`/findings/${findingId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, dismiss_reason: reason }),
      });
      await loadContent();
    } catch (err: any) {
      setError(err.message || "Failed to update finding");
    }
  };

  // Finding action: Save edited suggestion
  const handleSaveSuggestion = async (finding: Finding) => {
    const updatedData = { ...(finding.data || {}), suggestion: editSuggestionText };
    try {
      await apiRequest(`/findings/${finding.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: finding.status, dismiss_reason: finding.dismiss_reason }),
      });
      finding.suggestion = editSuggestionText;
      setEditingSuggestionFinding(null);
      await loadContent();
    } catch (err: any) {
      setError(err.message || "Failed to update suggestion");
    }
  };

  // Submit Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await apiRequest(`/content/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          text: commentText.trim(),
          finding_id: commentFindingId || null,
        }),
      });
      setCommentText("");
      setCommentFindingId("");
      await loadContent();
    } catch (err: any) {
      setError(err.message || "Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  // Submit Decision
  const handleDecision = async (decision: "approve" | "request_changes") => {
    setSubmittingDecision(true);
    try {
      await apiRequest(`/content/${id}/decision`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          reason: decisionReason.trim(),
          override: decisionOverride,
        }),
      });
      setDecisionReason("");
      setDecisionOverride(false);
      await loadContent();
    } catch (err: any) {
      setError(err.message || `Failed to ${decision}`);
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Scroll to finding card
  const scrollToFinding = (findingId?: string) => {
    if (!findingId) return;
    const el = document.getElementById(`finding-${findingId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-4", "ring-[#2563EB]");
      setTimeout(() => el.classList.remove("ring-4", "ring-[#2563EB]"), 2000);
    }
  };

  // Render text with finding highlights
  const renderHighlightedText = () => {
    const text = currentVer?.body || "";
    if (!text || versionFindings.length === 0) {
      return <div className="whitespace-pre-wrap leading-relaxed">{text || "No text available."}</div>;
    }

    // Identify non-overlapping quotes to highlight
    interface Match {
      start: number;
      end: number;
      finding: Finding;
    }
    const matches: Match[] = [];

    versionFindings.forEach((f) => {
      const q = f.quote?.trim();
      if (!q || q.startsWith("[") && q.endsWith("]")) return; // skip metadata quotes like [image]
      const idx = text.toLowerCase().indexOf(q.toLowerCase());
      if (idx !== -1) {
        // Ensure no collision with previous matches
        const collides = matches.some((m) => Math.max(m.start, idx) < Math.min(m.end, idx + q.length));
        if (!collides) {
          matches.push({ start: idx, end: idx + q.length, finding: f });
        }
      }
    });

    matches.sort((a, b) => a.start - b.start);

    const elements: React.ReactNode[] = [];
    let lastIdx = 0;

    matches.forEach((m, i) => {
      if (m.start > lastIdx) {
        elements.push(text.slice(lastIdx, m.start));
      }

      const f = m.finding;
      let badgeColor = "bg-blue-100 text-[#142D4E] border-b-2 border-[#2563EB]";
      if (f.severity === "Blocker") {
        badgeColor = "bg-red-100 text-red-950 border-b-2 border-[#B91C1C]";
      } else if (f.severity === "Warning") {
        badgeColor = "bg-amber-100 text-amber-950 border-b-2 border-[#D97706]";
      }

      elements.push(
        <mark
          key={`highlight-${i}`}
          onClick={() => scrollToFinding(f.id)}
          className={`cursor-pointer px-1 py-0.5 rounded transition ${badgeColor} hover:opacity-80`}
          title={`Click to inspect finding (${f.severity}): ${f.explanation}`}
        >
          {text.slice(m.start, m.end)}
        </mark>
      );
      lastIdx = m.end;
    });

    if (lastIdx < text.length) {
      elements.push(text.slice(lastIdx));
    }

    return <div className="whitespace-pre-wrap leading-relaxed">{elements}</div>;
  };

  if (loading || !content) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-full">
          {/* Header Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E2E8F0] pb-4 animate-pulse">
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 rounded w-36" />
              <div className="h-8 bg-slate-200 rounded w-64" />
            </div>
            <div className="h-8 bg-slate-200 rounded-lg w-32" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column Skeleton */}
            <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4 animate-pulse">
              <div className="h-8 bg-slate-200 rounded w-48 mb-4" />
              <div className="space-y-2.5">
                <div className="h-4 bg-slate-200 rounded w-full" />
                <div className="h-4 bg-slate-200 rounded w-5/6" />
                <div className="h-4 bg-slate-200 rounded w-4/6" />
                <div className="h-4 bg-slate-200 rounded w-full" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <div className="h-10 bg-slate-200 rounded-lg w-28" />
                <div className="h-10 bg-slate-200 rounded-lg w-48" />
              </div>
            </div>

            {/* Right Column Skeleton */}
            <div className="lg:col-span-5 space-y-6 animate-pulse">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4">
                <div className="h-5 bg-slate-200 rounded w-40" />
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-full bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-full" />
                    <div className="h-3 bg-slate-200 rounded w-full" />
                    <div className="h-3 bg-slate-200 rounded w-full" />
                  </div>
                </div>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-3">
                <div className="h-5 bg-slate-200 rounded w-32" />
                <div className="h-20 bg-slate-100 rounded-lg" />
                <div className="h-20 bg-slate-100 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-full">
        {/* Dismissible Error Toast */}
        <DismissibleToast message={error} onDismiss={() => setError(null)} />

        {/* Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E2E8F0] pb-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Link href="/dashboard" className="hover:underline">Dashboard</Link>
              <span>/</span>
              <span className="font-semibold text-[#142D4E]">{content.title}</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-[#142D4E] tracking-tight">{content.title}</h1>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-[#142D4E] border border-[#E2E8F0]">
                {content.channel}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  content.state === "Approved"
                    ? "bg-emerald-100 text-emerald-800"
                    : content.state === "ChangesRequested"
                    ? "bg-red-100 text-[#B91C1C]"
                    : content.state === "InReview"
                    ? "bg-amber-100 text-[#D97706]"
                    : content.state === "Reviewed"
                    ? "bg-blue-100 text-[#2563EB]"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {content.state}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/content/${content.id}/report`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-[#E2E8F0] text-[#142D4E] hover:bg-slate-50 shadow-sm transition"
            >
              📄 Approval Report
            </Link>
            <Link
              href="/dashboard"
              className="text-base font-semibold text-[#2563EB] hover:underline"
            >
              ← Back to dashboard
            </Link>
          </div>
        </div>

        {/* AI & Provider Banner */}
        {activeProvider && (
          <div className="p-3 bg-blue-50 border border-[#2563EB] text-[#142D4E] rounded-xl text-sm font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">✨</span>
              <span>AI-assisted findings were generated using: <strong>{activeProvider}</strong></span>
            </div>
          </div>
        )}
        {aiError && (
          <DismissibleToast
            message={`AI notice: ${aiError} (Rule-based checks executed successfully).`}
            onDismiss={() => setAiError(null)}
            type="warning"
          />
        )}

        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ================= LEFT COLUMN ================= */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-6 space-y-4">
              {/* Version Selector & Diff Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="version-select" className="text-sm font-bold text-[#142D4E]">
                    Version:
                  </label>
                  <select
                    id="version-select"
                    value={selectedVerNum}
                    onChange={(e) => setSelectedVerNum(Number(e.target.value))}
                    className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm font-semibold bg-white text-[#142D4E] focus:ring-2 focus:ring-[#2563EB]"
                  >
                    {versions.map((v) => (
                      <option key={v.number} value={v.number}>
                        v{v.number} {v.number === content.current_version ? "(Current)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {prevVer && (
                  <button
                    type="button"
                    onClick={() => setShowDiff(!showDiff)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${
                      showDiff
                        ? "bg-[#142D4E] text-white border-[#142D4E]"
                        : "bg-[#F8FAFC] text-[#142D4E] border-[#E2E8F0] hover:bg-slate-200"
                    }`}
                  >
                    {showDiff ? "Hide Word Diff" : `Compare with v${prevVer.number}`}
                  </button>
                )}
              </div>

              {/* Text View / Diff View */}
              {showDiff && prevVer ? (
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Word-level changes (v{prevVer.number} → v{currentVer.number}):
                  </div>
                  <WordDiff oldText={prevVer.body} newText={currentVer.body} />
                </div>
              ) : (
                <div className="min-h-[220px] p-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-base text-[#1E293B]">
                  {renderHighlightedText()}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={handleRunReview}
                  disabled={reviewing}
                  className="px-4 py-2.5 rounded-lg text-base font-semibold text-white bg-[#2563EB] hover:bg-blue-700 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8] disabled:opacity-50"
                >
                  {reviewing ? "Running review..." : "🔍 Run review"}
                </button>

                <label
                  htmlFor="mask_pii_toggle"
                  className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-[#142D4E] bg-slate-50 px-3 py-2.5 rounded-lg border border-[#E2E8F0] hover:bg-slate-100 transition select-none"
                >
                  <input
                    id="mask_pii_toggle"
                    type="checkbox"
                    checked={maskPii}
                    onChange={(e) => setMaskPii(e.target.checked)}
                    className="w-4 h-4 text-[#2563EB] rounded focus:ring-2 focus:ring-[#38BDF8]"
                  />
                  <span>Mask personal data before AI</span>
                </label>

                <button
                  type="button"
                  onClick={handleApplySuggestions}
                  disabled={reviewing}
                  className="px-4 py-2.5 rounded-lg text-base font-semibold text-[#142D4E] bg-slate-100 hover:bg-slate-200 border border-[#E2E8F0] shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8] disabled:opacity-50"
                >
                  ⚡ Apply accepted suggestions
                </button>

                {content.state === "Reviewed" && isCreatorOrPrivileged && (
                  <button
                    type="button"
                    onClick={handleSubmitForReview}
                    className="px-4 py-2.5 rounded-lg text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                  >
                    ✓ Submit for review
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ================= RIGHT COLUMN ================= */}
          <div className="lg:col-span-5 space-y-6">
            {/* Brand Health Score Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#142D4E]">Brand Health Score</h2>
                  <p className="text-xs text-slate-500">Compliance health across 5 core categories</p>
                </div>

                {currentScore ? (
                  currentScore.approvable ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      ✓ Approvable
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-[#B91C1C]">
                      ⛔ Not approvable
                    </span>
                  )
                ) : (
                  <span className="text-xs font-bold text-slate-500">No review run</span>
                )}
              </div>

              {/* Gauge display */}
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full border-4 border-[#2563EB] flex flex-col items-center justify-center bg-[#F8FAFC]">
                  <span className="text-3xl font-extrabold text-[#142D4E]">
                    {currentScore ? currentScore.overall : "—"}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">/ 100</span>
                </div>

                <div className="flex-1 space-y-2">
                  {currentScore?.categories ? (
                    Object.entries(currentScore.categories).map(([cat, val]) => (
                      <div key={cat} className="space-y-0.5">
                        <div className="flex justify-between text-xs font-semibold capitalize text-[#142D4E]">
                          <span>{cat}</span>
                          <span>{val}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              val >= 80 ? "bg-emerald-500" : val >= 50 ? "bg-amber-500" : "bg-[#B91C1C]"
                            }`}
                            style={{ width: `${val}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500 italic">Run review to calculate category breakdown.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Findings List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#142D4E]">
                  Findings ({versionFindings.length})
                </h2>
                <div className="text-xs font-semibold text-slate-500">
                  Sorted by severity (Blocker → Warning → Info)
                </div>
              </div>

              {versionFindings.length === 0 ? (
                <div className="p-8 text-center bg-white border border-[#E2E8F0] rounded-xl text-slate-500 text-base">
                  <span className="text-3xl block mb-2">🎉</span>
                  <p className="font-semibold text-[#142D4E]">No compliance findings</p>
                  <p className="text-sm text-slate-600 mt-1">
                    This version adheres to all active brand guidelines and claims.
                  </p>
                </div>
              ) : (
                versionFindings.map((f) => {
                  const citation = sourcesMap[f.rule_id];
                  const isBlocker = f.severity === "Blocker";
                  const isWarning = f.severity === "Warning";

                  return (
                    <div
                      key={f.id}
                      id={`finding-${f.id}`}
                      className={`bg-white border rounded-xl p-5 shadow-sm space-y-3 transition ${
                        f.status === "dismissed"
                          ? "opacity-60 border-slate-200"
                          : f.status === "accepted"
                          ? "border-emerald-300 bg-emerald-50/20"
                          : isBlocker
                          ? "border-[#B91C1C]/40"
                          : isWarning
                          ? "border-[#D97706]/40"
                          : "border-[#E2E8F0]"
                      }`}
                    >
                      {/* Header tags */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isBlocker
                                ? "bg-red-100 text-[#B91C1C]"
                                : isWarning
                                ? "bg-amber-100 text-[#D97706]"
                                : "bg-blue-100 text-[#2563EB]"
                            }`}
                          >
                            <span>{isBlocker ? "⛔" : isWarning ? "⚠️" : "ℹ️"}</span>
                            <span>{f.severity}</span>
                          </span>

                          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            {f.category}
                          </span>

                          <span className="text-xs text-slate-500 font-medium">
                            {f.source_type === "rule-based" ? "Rule-based" : "AI-assisted"}
                          </span>
                        </div>

                        {f.status !== "open" && (
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                              f.status === "accepted"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {f.status}
                          </span>
                        )}
                      </div>

                      {/* Human Review Needed Label */}
                      {f.label && (
                        <div className="text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded px-2.5 py-1">
                          ⚠️ {f.label}
                        </div>
                      )}

                      {/* Quote & Explanation */}
                      <div className="space-y-1">
                        <div className="text-sm text-slate-600">
                          Quote: <strong className="font-mono text-[#142D4E]">"{f.quote}"</strong>
                        </div>
                        <p className="text-base font-medium text-[#1E293B]">{f.explanation}</p>
                      </div>

                      {/* Cited source chip */}
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5 text-xs text-slate-700 space-y-0.5">
                        <div className="font-bold text-[#142D4E] flex items-center gap-1">
                          <span>📖 Cited Source:</span>
                          <span className="font-mono">{f.rule_id}</span>
                          {citation?.title && <span>— {citation.title}</span>}
                        </div>
                        {citation?.text && <div className="text-slate-600">{citation.text}</div>}
                      </div>

                      {/* Suggestion comparison */}
                      {f.suggestion && (
                        <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 text-sm space-y-1">
                          <div className="font-bold text-emerald-900 text-xs uppercase tracking-wider">
                            Suggested Fix:
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="line-through text-red-700 text-xs">{f.quote}</span>
                            <span className="text-slate-400">→</span>
                            <span className="font-bold text-emerald-800">{f.suggestion}</span>
                          </div>
                        </div>
                      )}

                      {/* Dismiss reason note if dismissed */}
                      {f.status === "dismissed" && f.dismiss_reason && (
                        <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
                          Dismissal reason: "{f.dismiss_reason}"
                        </div>
                      )}

                      {/* Inline Why Explanation */}
                      {whyExplanations[f.id!] && (
                        <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs space-y-1 text-slate-800 animate-in fade-in duration-150">
                          <div className="font-bold text-[#0284C7] flex items-center gap-1">
                            <span>💡 Why this suggestion was made:</span>
                          </div>
                          <p className="text-sm leading-relaxed text-[#1E293B]">{whyExplanations[f.id!]}</p>
                        </div>
                      )}

                      {/* Card Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0] text-sm">
                        <span className="text-xs font-semibold text-slate-500">
                          Confidence: {Math.round((f.confidence ?? 1) * 100)}%
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleFetchWhy(f.id!)}
                            disabled={loadingWhy[f.id!]}
                            className="px-2.5 py-1 font-semibold rounded text-xs bg-sky-50 text-[#0284C7] hover:bg-sky-100 border border-sky-200 transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8] disabled:opacity-50"
                          >
                            {loadingWhy[f.id!] ? "Loading..." : whyExplanations[f.id!] ? "Hide explanation" : "💡 Why this?"}
                          </button>
                          {f.status === "open" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateFindingStatus(f.id!, "accepted")}
                                className="px-3 py-1 font-semibold rounded text-xs bg-emerald-600 text-white hover:bg-emerald-700 transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                              >
                                Accept
                              </button>
                              {f.suggestion && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSuggestionFinding(f);
                                    setEditSuggestionText(f.suggestion || "");
                                  }}
                                  className="px-2.5 py-1 font-semibold rounded text-xs bg-slate-100 text-[#142D4E] hover:bg-slate-200 border border-slate-300 transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                                >
                                  Edit fix
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setDismissModalFinding(f);
                                  setDismissReason("");
                                }}
                                className="px-3 py-1 font-semibold rounded text-xs bg-red-100 text-[#B91C1C] hover:bg-red-200 transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                              >
                                Dismiss
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUpdateFindingStatus(f.id!, "open")}
                              className="text-xs font-semibold text-[#2563EB] hover:underline focus:outline-none focus:ring-2 focus:ring-[#38BDF8] rounded px-1"
                            >
                              Re-open
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ================= BELOW: COMMENTS & DECISIONS ================= */}
        <div className="pt-8 border-t border-[#E2E8F0] grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Comments Thread */}
          <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-6 space-y-6">
            <h2 className="text-xl font-bold text-[#142D4E]">
              Comments Thread ({content.comments?.length || 0})
            </h2>

            <div className="space-y-3">
              {(content.comments || []).length === 0 ? (
                <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-sm">
                  <span className="text-2xl block mb-1">💬</span>
                  <p className="font-medium text-slate-700">No review comments yet</p>
                  <p className="text-xs text-slate-500 mt-0.5">Start the conversation by sharing feedback below.</p>
                </div>
              ) : (
                content.comments?.map((cm) => (
                  <div key={cm.id} className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#142D4E]">{cm.author_name || "Author"}</span>
                        {cm.author_role && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-200 text-slate-700">
                            {cm.author_role}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500">
                        {new Date(cm.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {cm.finding_id && (
                      <div className="text-xs text-[#2563EB] font-medium">
                        Attached to finding: <span className="font-mono">{cm.finding_id}</span>
                      </div>
                    )}

                    <p className="text-base text-[#1E293B] pt-1">{cm.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleAddComment} className="pt-4 border-t border-[#E2E8F0] space-y-3">
              <div>
                <label htmlFor="comment_text" className="block text-sm font-semibold text-[#1E293B] mb-1">
                  Leave a comment
                </label>
                <textarea
                  id="comment_text"
                  rows={3}
                  required
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share feedback, review notes, or instructions..."
                  className="w-full px-3 py-2 text-base border border-[#E2E8F0] rounded-lg text-[#1E293B] bg-white focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              {versionFindings.length > 0 && (
                <div>
                  <label htmlFor="comment_finding" className="block text-xs font-semibold text-slate-600 mb-1">
                    Optionally link to finding
                  </label>
                  <select
                    id="comment_finding"
                    value={commentFindingId}
                    onChange={(e) => setCommentFindingId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-sm bg-white text-[#1E293B]"
                  >
                    <option value="">None (General comment)</option>
                    {versionFindings.map((f) => (
                      <option key={f.id} value={f.id}>
                        [{f.severity}] {f.quote} ({f.rule_id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingComment}
                className="px-4 py-2 rounded-lg text-base font-semibold text-white bg-[#2563EB] hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8] disabled:opacity-50"
              >
                {submittingComment ? "Posting..." : "Post comment"}
              </button>
            </form>
          </div>

          {/* Decision Panel (Reviewer, Manager, Admin when InReview) */}
          <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-xl font-bold text-[#142D4E]">Approval Workflow</h2>

            {content.state === "InReview" ? (
              isPrivileged ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Content is currently <strong>In Review</strong>. Submit your decision below.
                  </p>

                  <div>
                    <label htmlFor="decision_reason" className="block text-sm font-semibold text-[#1E293B] mb-1">
                      Reason / Notes (required for changes or overrides)
                    </label>
                    <textarea
                      id="decision_reason"
                      rows={3}
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                      placeholder="Explain your approval rationale or describe required revisions..."
                      className="w-full px-3 py-2 text-base border border-[#E2E8F0] rounded-lg text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                    />
                  </div>

                  {/* Override Blockers checkbox shown ONLY when open Blockers exist */}
                  {openBlockersCount > 0 && (
                    <div className="p-3 bg-red-50 border border-[#B91C1C] rounded-lg space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          id="override_blockers"
                          type="checkbox"
                          checked={decisionOverride}
                          onChange={(e) => setDecisionOverride(e.target.checked)}
                          className="w-4 h-4 text-[#B91C1C] rounded focus:ring-2 focus:ring-red-400"
                        />
                        <label
                          htmlFor="override_blockers"
                          className="text-sm font-bold text-[#B91C1C] cursor-pointer"
                        >
                          Override {openBlockersCount} open Blocker(s)
                        </label>
                      </div>
                      <p className="text-xs text-red-700 pl-6">
                        Approval is normally blocked while open Blockers exist. Checking this requires a non-empty reason.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      disabled={submittingDecision}
                      onClick={() => handleDecision("approve")}
                      className="flex-1 py-2.5 px-4 rounded-lg text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8] disabled:opacity-50"
                    >
                      ✓ Approve
                    </button>
                    <button
                      type="button"
                      disabled={submittingDecision}
                      onClick={() => handleDecision("request_changes")}
                      className="flex-1 py-2.5 px-4 rounded-lg text-base font-semibold text-white bg-[#B91C1C] hover:bg-red-800 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8] disabled:opacity-50"
                    >
                      ✕ Request changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                  ⏳ This content is waiting for a decision by a reviewer, manager, or administrator.
                </div>
              )
            ) : (
              <div className="text-sm text-slate-600 space-y-2">
                <p>
                  Current status: <strong>{content.state}</strong>
                </p>
                {content.state === "Draft" && (
                  <p>Run review to check for brand compliance before submitting for approval.</p>
                )}
                {content.state === "Reviewed" && (
                  <p>Click "Submit for review" in the left panel to request approval.</p>
                )}
                {content.state === "Approved" && (
                  <p className="text-emerald-700 font-semibold">✓ Content has been approved for publication.</p>
                )}
                {content.state === "ChangesRequested" && (
                  <p className="text-red-700 font-semibold">✕ Changes were requested. Please revise copy and review again.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal: Dismiss Finding Reason Input */}
        {dismissModalFinding && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-[#142D4E]">Dismiss Finding</h3>
              <p className="text-sm text-slate-600">
                Dismissing a compliance finding requires a documented rationale.
              </p>

              <div>
                <label htmlFor="dismiss_reason" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                  Dismissal Reason *
                </label>
                <textarea
                  id="dismiss_reason"
                  rows={3}
                  required
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  placeholder="Explain why this finding is dismissed or permitted..."
                  className="w-full px-3 py-2 text-base border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDismissModalFinding(null)}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-lg text-sm font-semibold hover:bg-[#F8FAFC] transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!dismissReason.trim()}
                  onClick={() => {
                    handleUpdateFindingStatus(dismissModalFinding.id!, "dismissed", dismissReason.trim());
                    setDismissModalFinding(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#B91C1C] hover:bg-red-800 disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                >
                  Confirm Dismissal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Edit Suggestion */}
        {editingSuggestionFinding && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-[#142D4E]">Edit Suggested Replacement</h3>

              <div>
                <label htmlFor="edit_suggestion_input" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                  Replacement Text
                </label>
                <input
                  id="edit_suggestion_input"
                  type="text"
                  required
                  value={editSuggestionText}
                  onChange={(e) => setEditSuggestionText(e.target.value)}
                  className="w-full px-3 py-2 text-base border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSuggestionFinding(null)}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-lg text-sm font-semibold hover:bg-[#F8FAFC] transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveSuggestion(editingSuggestionFinding)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                >
                  Save Fix
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
