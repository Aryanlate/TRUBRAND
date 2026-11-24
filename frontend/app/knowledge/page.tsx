"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { apiRequest, getStoredUser, User } from "@/lib/api";
import DismissibleToast from "@/components/Toast";

type TabKind = "rules" | "terms" | "facts" | "claims";

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState<TabKind>("rules");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [today, setToday] = useState<string>("");

  useEffect(() => {
    setUser(getStoredUser());
    setToday(new Date().toISOString().split("T")[0]);
  }, []);

  const canWrite = user?.role === "manager" || user?.role === "admin";

  const loadData = (kind: TabKind) => {
    setLoading(true);
    setError(null);
    apiRequest<any[]>(`/kb/${kind}`)
      .then((items) => {
        setData(Array.isArray(items) ? items : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || `Failed to load ${kind}`);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    if (activeTab === "rules") {
      setFormData({ id: "", category: "tone", title: "", text: "", severity: "Warning", good: "", bad: "" });
    } else if (activeTab === "terms") {
      setFormData({ type: "banned", term: "", replacement: "", rule_id: "R-4.2", severity: "Blocker", note: "" });
    } else if (activeTab === "facts") {
      setFormData({ id: "", statement: "" });
    } else if (activeTab === "claims") {
      setFormData({ id: "", phrase: "", evidence: "", expires_on: "" });
    }
    setModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this knowledge base entry?")) return;
    try {
      await apiRequest(`/kb/${activeTab}/${id}`, { method: "DELETE" });
      loadData(activeTab);
    } catch (err: any) {
      setError(err.message || "Failed to delete knowledge entry");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem && editingItem.id) {
        await apiRequest(`/kb/${activeTab}/${editingItem.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
      } else {
        await apiRequest(`/kb/${activeTab}`, {
          method: "POST",
          body: JSON.stringify(formData),
        });
      }
      setModalOpen(false);
      loadData(activeTab);
    } catch (err: any) {
      setError(err.message || "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const renderSeverityBadge = (severity: string) => {
    switch (severity) {
      case "Blocker":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-[#B91C1C]">
            <span>⛔</span> Blocker
          </span>
        );
      case "Warning":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-[#D97706]">
            <span>⚠️</span> Warning
          </span>
        );
      case "Info":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-[#2563EB]">
            <span>ℹ️</span> Info
          </span>
        );
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#142D4E] tracking-tight">
              Knowledge Base
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Brand rules, approved terms, verified facts, and legal claims.
            </p>
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-base font-semibold text-white bg-[#2563EB] hover:bg-blue-700 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8] focus:ring-offset-2"
            >
              + Add {activeTab.slice(0, -1)}
            </button>
          )}
        </div>

        {!canWrite && (
          <div className="p-3 bg-blue-50 border border-[#E2E8F0] rounded-xl text-sm font-medium text-[#1E293B] flex items-center gap-2">
            <span>ℹ️</span>
            <span>You have read-only permissions for the Knowledge Base. Only managers and admins can edit.</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-[#E2E8F0] flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(["rules", "terms", "facts", "claims"] as TabKind[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`py-2.5 px-4 sm:px-5 text-sm sm:text-base font-semibold capitalize border-b-2 whitespace-nowrap transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8] rounded-t-lg ${
                  isActive
                    ? "border-[#2563EB] text-[#2563EB] bg-blue-50/50"
                    : "border-transparent text-slate-600 hover:text-[#142D4E] hover:bg-slate-50"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Dismissible Error Toast */}
        <DismissibleToast message={error} onDismiss={() => setError(null)} />

        {/* Content Table & States */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="overflow-x-auto p-4 sm:p-6 space-y-4">
              <div className="h-6 bg-slate-200 rounded w-48 animate-pulse mb-4" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg animate-pulse"
                  >
                    <div className="space-y-1.5 flex-1 min-w-[120px]">
                      <div className="h-4 bg-slate-200 rounded w-1/4" />
                      <div className="h-3 bg-slate-200 rounded w-3/4" />
                    </div>
                    <div className="h-6 bg-slate-200 rounded-full w-20" />
                    <div className="h-4 bg-slate-200 rounded w-16" />
                  </div>
                ))}
              </div>
            </div>
          ) : data.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="text-4xl mb-3">📚</div>
              <h3 className="text-lg font-bold text-[#142D4E] capitalize">
                No {activeTab} configured yet
              </h3>
              <p className="text-slate-600 mt-1 mb-6 text-sm sm:text-base max-w-md mx-auto">
                Define approved brand {activeTab} to govern content checks and automated compliance.
              </p>
              {canWrite ? (
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="inline-flex items-center px-4 py-2 text-base font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8] focus:ring-offset-2"
                >
                  + Add {activeTab.slice(0, -1)}
                </button>
              ) : (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2 text-base font-semibold text-[#142D4E] bg-slate-100 border border-[#E2E8F0] rounded-lg hover:bg-slate-200 transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                >
                  Return to Dashboard
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-[#E2E8F0] text-left">
                <thead className="bg-[#F8FAFC]">
                  {activeTab === "rules" && (
                    <tr>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">ID</th>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Category</th>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Title & Text</th>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Severity</th>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Examples</th>
                      {canWrite && <th className="px-4 sm:px-6 py-3.5 text-right text-xs font-bold text-[#142D4E] uppercase">Actions</th>}
                    </tr>
                  )}
                  {activeTab === "terms" && (
                    <tr>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Type</th>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Term</th>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Replacement</th>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Rule ID</th>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Severity</th>
                      {canWrite && <th className="px-4 sm:px-6 py-3.5 text-right text-xs font-bold text-[#142D4E] uppercase">Actions</th>}
                    </tr>
                  )}
                  {activeTab === "facts" && (
                    <tr>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">ID</th>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Fact Statement</th>
                      {canWrite && <th className="px-4 sm:px-6 py-3.5 text-right text-xs font-bold text-[#142D4E] uppercase">Actions</th>}
                    </tr>
                  )}
                  {activeTab === "claims" && (
                    <tr>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">ID</th>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Claim Phrase</th>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Evidence</th>
                      <th className="px-4 sm:px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Expires On</th>
                      {canWrite && <th className="px-4 sm:px-6 py-3.5 text-right text-xs font-bold text-[#142D4E] uppercase">Actions</th>}
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] bg-white text-sm sm:text-base">
                  {data.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-[#F8FAFC] transition">
                      {activeTab === "rules" && (
                        <>
                          <td className="px-4 sm:px-6 py-4 font-mono text-xs font-bold text-[#142D4E]">
                            {item.id}
                          </td>
                          <td className="px-4 sm:px-6 py-4 capitalize text-slate-600">
                            {item.category}
                          </td>
                          <td className="px-4 sm:px-6 py-4 max-w-sm">
                            <p className="font-bold text-[#142D4E]">{item.title}</p>
                            <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{item.text}</p>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            {renderSeverityBadge(item.severity)}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-xs space-y-1">
                            {item.good && (
                              <div className="text-emerald-700">
                                <strong>✓ Good:</strong> &ldquo;{item.good}&rdquo;
                              </div>
                            )}
                            {item.bad && (
                              <div className="text-red-700">
                                <strong>✕ Bad:</strong> &ldquo;{item.bad}&rdquo;
                              </div>
                            )}
                          </td>
                        </>
                      )}

                      {activeTab === "terms" && (
                        <>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-slate-100 text-[#142D4E]">
                              {item.type}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-4 font-mono font-bold text-[#142D4E]">
                            {item.term}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-emerald-700 font-mono text-sm">
                            {item.replacement || "—"}
                          </td>
                          <td className="px-4 sm:px-6 py-4 font-mono text-xs text-slate-500">
                            {item.rule_id}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            {renderSeverityBadge(item.severity || "Warning")}
                          </td>
                        </>
                      )}

                      {activeTab === "facts" && (
                        <>
                          <td className="px-4 sm:px-6 py-4 font-mono text-xs font-bold text-[#142D4E] whitespace-nowrap">
                            {item.id}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-slate-800">
                            {item.statement}
                          </td>
                        </>
                      )}

                      {activeTab === "claims" && (
                        <>
                          <td className="px-4 sm:px-6 py-4 font-mono text-xs font-bold text-[#142D4E] whitespace-nowrap">
                            {item.id}
                          </td>
                          <td className="px-4 sm:px-6 py-4 font-bold text-[#142D4E]">
                            &ldquo;{item.phrase}&rdquo;
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm text-slate-700">
                            {item.evidence || <span className="text-red-600 italic">No evidence recorded</span>}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            {item.expires_on ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono text-slate-700">{item.expires_on}</span>
                                {today && item.expires_on < today && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-[#B91C1C] border border-[#B91C1C]">
                                    <span>⛔</span> Expired
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-500">None</span>
                            )}
                          </td>
                        </>
                      )}

                      {canWrite && (
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="font-semibold text-[#2563EB] hover:underline mr-4 focus:outline-none focus:ring-2 focus:ring-[#38BDF8] rounded px-1"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="font-semibold text-[#B91C1C] hover:underline focus:outline-none focus:ring-2 focus:ring-[#38BDF8] rounded px-1"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal for Add / Edit */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl max-w-lg w-full p-6 space-y-4 my-8">
              <h2 className="text-xl font-bold text-[#142D4E]">
                {editingItem ? `Edit ${activeTab.slice(0, -1)}` : `Add ${activeTab.slice(0, -1)}`}
              </h2>

              <form onSubmit={handleSave} className="space-y-4">
                {activeTab === "rules" && (
                  <>
                    <div>
                      <label htmlFor="kb_rule_id" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Rule ID
                      </label>
                      <input
                        id="kb_rule_id"
                        type="text"
                        required
                        disabled={!!editingItem}
                        value={formData.id || ""}
                        onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                        placeholder="e.g. R-2.5"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label htmlFor="kb_rule_cat" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Category
                      </label>
                      <select
                        id="kb_rule_cat"
                        value={formData.category || "tone"}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      >
                        <option value="tone">Tone</option>
                        <option value="messaging">Messaging</option>
                        <option value="terminology">Terminology</option>
                        <option value="claims">Claims</option>
                        <option value="visual">Visual</option>
                        <option value="accessibility">Accessibility</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="kb_rule_title" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Title
                      </label>
                      <input
                        id="kb_rule_title"
                        type="text"
                        required
                        value={formData.title || ""}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g. Warm and conversational"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label htmlFor="kb_rule_text" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Rule Text
                      </label>
                      <textarea
                        id="kb_rule_text"
                        required
                        rows={3}
                        value={formData.text || ""}
                        onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label htmlFor="kb_rule_sev" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Severity
                      </label>
                      <select
                        id="kb_rule_sev"
                        value={formData.severity || "Warning"}
                        onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      >
                        <option value="Blocker">Blocker (⛔ #B91C1C)</option>
                        <option value="Warning">Warning (⚠️ #D97706)</option>
                        <option value="Info">Info (ℹ️ #2563EB)</option>
                      </select>
                    </div>
                  </>
                )}

                {activeTab === "terms" && (
                  <>
                    <div>
                      <label htmlFor="kb_term_type" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Term Type
                      </label>
                      <select
                        id="kb_term_type"
                        value={formData.type || "banned"}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      >
                        <option value="banned">Banned</option>
                        <option value="replace">Replace</option>
                        <option value="brand_name">Brand Name</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="kb_term_val" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Term
                      </label>
                      <input
                        id="kb_term_val"
                        type="text"
                        required
                        value={formData.term || ""}
                        onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                        placeholder="e.g. cheapest"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label htmlFor="kb_term_repl" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Replacement
                      </label>
                      <input
                        id="kb_term_repl"
                        type="text"
                        value={formData.replacement || ""}
                        onChange={(e) => setFormData({ ...formData, replacement: e.target.value })}
                        placeholder="e.g. affordable"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label htmlFor="kb_term_rule_id" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Associated Rule ID
                      </label>
                      <input
                        id="kb_term_rule_id"
                        type="text"
                        required
                        value={formData.rule_id || ""}
                        onChange={(e) => setFormData({ ...formData, rule_id: e.target.value })}
                        placeholder="e.g. R-4.2"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label htmlFor="kb_term_sev" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Severity
                      </label>
                      <select
                        id="kb_term_sev"
                        value={formData.severity || "Blocker"}
                        onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      >
                        <option value="Blocker">Blocker (⛔ #B91C1C)</option>
                        <option value="Warning">Warning (⚠️ #D97706)</option>
                        <option value="Info">Info (ℹ️ #2563EB)</option>
                      </select>
                    </div>
                  </>
                )}

                {activeTab === "facts" && (
                  <>
                    <div>
                      <label htmlFor="kb_fact_id" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Fact ID
                      </label>
                      <input
                        id="kb_fact_id"
                        type="text"
                        required
                        disabled={!!editingItem}
                        value={formData.id || ""}
                        onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                        placeholder="e.g. F-5"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label htmlFor="kb_fact_stmt" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Verified Statement
                      </label>
                      <textarea
                        id="kb_fact_stmt"
                        required
                        rows={4}
                        value={formData.statement || ""}
                        onChange={(e) => setFormData({ ...formData, statement: e.target.value })}
                        placeholder="Enter the official company fact statement..."
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      />
                    </div>
                  </>
                )}

                {activeTab === "claims" && (
                  <>
                    <div>
                      <label htmlFor="kb_claim_id" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Claim ID
                      </label>
                      <input
                        id="kb_claim_id"
                        type="text"
                        required
                        disabled={!!editingItem}
                        value={formData.id || ""}
                        onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                        placeholder="e.g. C-10"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label htmlFor="kb_claim_phrase" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Claim Phrase
                      </label>
                      <input
                        id="kb_claim_phrase"
                        type="text"
                        required
                        value={formData.phrase || ""}
                        onChange={(e) => setFormData({ ...formData, phrase: e.target.value })}
                        placeholder="e.g. 100% recyclable"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label htmlFor="kb_claim_evidence" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Evidence Reference / Certificate
                      </label>
                      <input
                        id="kb_claim_evidence"
                        type="text"
                        value={formData.evidence || ""}
                        onChange={(e) => setFormData({ ...formData, evidence: e.target.value })}
                        placeholder="e.g. Certificate ISO-14021"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label htmlFor="kb_claim_expires" className="block text-sm font-semibold mb-1 text-[#1E293B]">
                        Expires On (YYYY-MM-DD)
                      </label>
                      <input
                        id="kb_claim_expires"
                        type="date"
                        value={formData.expires_on || ""}
                        onChange={(e) => setFormData({ ...formData, expires_on: e.target.value })}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                      />
                    </div>
                  </>
                )}

                <div className="pt-4 flex justify-end gap-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-[#E2E8F0] rounded-lg text-base font-semibold text-[#1E293B] hover:bg-[#F8FAFC] transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-lg text-base font-semibold text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
