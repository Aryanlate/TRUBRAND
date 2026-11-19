"use client";

import React, { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiRequest, getStoredUser, User } from "@/lib/api";

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
      alert(err.message || "Failed to delete");
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
      alert(err.message || "Failed to save item");
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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#142D4E] tracking-tight">Knowledge Base</h1>
            <p className="text-base text-slate-600 mt-1">
              Brand rules, approved terms, verified facts, and legal claims.
            </p>
          </div>
          {canWrite && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center px-4 py-2.5 rounded-lg text-base font-semibold text-white bg-[#2563EB] hover:bg-blue-700 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
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
        <div className="border-b border-[#E2E8F0] flex gap-2">
          {(["rules", "terms", "facts", "claims"] as TabKind[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-5 text-base font-semibold capitalize border-b-2 transition focus:outline-none ${
                  isActive
                    ? "border-[#2563EB] text-[#2563EB]"
                    : "border-transparent text-slate-600 hover:text-[#142D4E]"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-[#B91C1C] text-[#B91C1C] rounded-xl text-base font-medium">
            {error}
          </div>
        )}

        {/* Content Table */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-base">Loading {activeTab}...</div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-base">
              No entries found in {activeTab}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#E2E8F0] text-left">
                <thead className="bg-[#F8FAFC]">
                  {activeTab === "rules" && (
                    <tr>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">ID</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Category</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Title & Text</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Severity</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Examples</th>
                      {canWrite && <th className="px-6 py-3.5 text-right text-xs font-bold text-[#142D4E] uppercase">Actions</th>}
                    </tr>
                  )}
                  {activeTab === "terms" && (
                    <tr>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Type</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Term</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Replacement</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Severity</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Rule ID & Note</th>
                      {canWrite && <th className="px-6 py-3.5 text-right text-xs font-bold text-[#142D4E] uppercase">Actions</th>}
                    </tr>
                  )}
                  {activeTab === "facts" && (
                    <tr>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">ID</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Verified Statement</th>
                      {canWrite && <th className="px-6 py-3.5 text-right text-xs font-bold text-[#142D4E] uppercase">Actions</th>}
                    </tr>
                  )}
                  {activeTab === "claims" && (
                    <tr>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">ID</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Phrase</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Approved Evidence</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-[#142D4E] uppercase">Expires On</th>
                      {canWrite && <th className="px-6 py-3.5 text-right text-xs font-bold text-[#142D4E] uppercase">Actions</th>}
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] bg-white text-base">
                  {data.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-[#F8FAFC]">
                      {activeTab === "rules" && (
                        <>
                          <td className="px-6 py-4 font-mono font-bold text-sm text-[#142D4E] whitespace-nowrap">
                            {item.id}
                          </td>
                          <td className="px-6 py-4 capitalize text-slate-700 whitespace-nowrap">
                            {item.category}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-[#142D4E]">{item.title}</div>
                            <div className="text-sm text-slate-600 mt-0.5">{item.text}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {renderSeverityBadge(item.severity)}
                          </td>
                          <td className="px-6 py-4 text-xs space-y-1">
                            {item.good && (
                              <div className="text-emerald-700 font-medium">
                                <span className="font-bold">Good:</span> "{item.good}"
                              </div>
                            )}
                            {item.bad && (
                              <div className="text-[#B91C1C] font-medium">
                                <span className="font-bold">Bad:</span> "{item.bad}"
                              </div>
                            )}
                          </td>
                        </>
                      )}

                      {activeTab === "terms" && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 uppercase">
                              {item.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-[#142D4E]">
                            "{item.term}"
                          </td>
                          <td className="px-6 py-4 text-emerald-700 font-semibold">
                            {item.replacement ? `→ "${item.replacement}"` : "—"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {renderSeverityBadge(item.severity || "Warning")}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            <span className="font-mono font-semibold text-[#142D4E]">{item.rule_id}</span>
                            {item.note && <div className="text-xs text-slate-500">{item.note}</div>}
                          </td>
                        </>
                      )}

                      {activeTab === "facts" && (
                        <>
                          <td className="px-6 py-4 font-mono font-bold text-sm text-[#142D4E] whitespace-nowrap">
                            {item.id}
                          </td>
                          <td className="px-6 py-4 text-[#1E293B]">
                            {item.statement}
                          </td>
                        </>
                      )}

                      {activeTab === "claims" && (
                        <>
                          <td className="px-6 py-4 font-mono font-bold text-sm text-[#142D4E] whitespace-nowrap">
                            {item.id}
                          </td>
                          <td className="px-6 py-4 font-bold text-[#142D4E]">
                            "{item.phrase}"
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {item.evidence || <span className="text-red-600 italic">No evidence recorded</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.expires_on ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono text-slate-700">{item.expires_on}</span>
                                {today && item.expires_on < today && (
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-[#B91C1C] border border-[#B91C1C]">
                                    Expired
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
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="font-semibold text-[#2563EB] hover:underline mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="font-semibold text-[#B91C1C] hover:underline"
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
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl max-w-lg w-full p-6 space-y-4">
              <h2 className="text-xl font-bold text-[#142D4E]">
                {editingItem ? `Edit ${activeTab.slice(0, -1)}` : `Add ${activeTab.slice(0, -1)}`}
              </h2>

              <form onSubmit={handleSave} className="space-y-4">
                {activeTab === "rules" && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Rule ID</label>
                      <input
                        type="text"
                        required
                        disabled={!!editingItem}
                        value={formData.id || ""}
                        onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                        placeholder="e.g. R-2.5"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Category</label>
                      <select
                        value={formData.category || "tone"}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
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
                      <label className="block text-sm font-semibold mb-1">Title</label>
                      <input
                        type="text"
                        required
                        value={formData.title || ""}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g. Warm and conversational"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Rule Text</label>
                      <textarea
                        required
                        rows={3}
                        value={formData.text || ""}
                        onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Severity</label>
                      <select
                        value={formData.severity || "Warning"}
                        onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      >
                        <option value="Blocker">Blocker (#B91C1C)</option>
                        <option value="Warning">Warning (#D97706)</option>
                        <option value="Info">Info (#2563EB)</option>
                      </select>
                    </div>
                  </>
                )}

                {activeTab === "terms" && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Term Type</label>
                      <select
                        value={formData.type || "banned"}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      >
                        <option value="banned">Banned</option>
                        <option value="replace">Replace</option>
                        <option value="brand_name">Brand Name</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Term</label>
                      <input
                        type="text"
                        required
                        value={formData.term || ""}
                        onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                        placeholder="e.g. cheapest"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Replacement</label>
                      <input
                        type="text"
                        value={formData.replacement || ""}
                        onChange={(e) => setFormData({ ...formData, replacement: e.target.value })}
                        placeholder="e.g. affordable"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Associated Rule ID</label>
                      <input
                        type="text"
                        required
                        value={formData.rule_id || ""}
                        onChange={(e) => setFormData({ ...formData, rule_id: e.target.value })}
                        placeholder="e.g. R-4.2"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Severity</label>
                      <select
                        value={formData.severity || "Blocker"}
                        onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      >
                        <option value="Blocker">Blocker</option>
                        <option value="Warning">Warning</option>
                        <option value="Info">Info</option>
                      </select>
                    </div>
                  </>
                )}

                {activeTab === "facts" && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Fact ID</label>
                      <input
                        type="text"
                        required
                        disabled={!!editingItem}
                        value={formData.id || ""}
                        onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                        placeholder="e.g. F-5"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Verified Statement</label>
                      <textarea
                        required
                        rows={4}
                        value={formData.statement || ""}
                        onChange={(e) => setFormData({ ...formData, statement: e.target.value })}
                        placeholder="Enter the official company fact statement..."
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      />
                    </div>
                  </>
                )}

                {activeTab === "claims" && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Claim ID</label>
                      <input
                        type="text"
                        required
                        disabled={!!editingItem}
                        value={formData.id || ""}
                        onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                        placeholder="e.g. C-10"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Claim Phrase</label>
                      <input
                        type="text"
                        required
                        value={formData.phrase || ""}
                        onChange={(e) => setFormData({ ...formData, phrase: e.target.value })}
                        placeholder="e.g. 100% recyclable"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Evidence Reference / Certificate</label>
                      <input
                        type="text"
                        value={formData.evidence || ""}
                        onChange={(e) => setFormData({ ...formData, evidence: e.target.value })}
                        placeholder="e.g. Certificate ISO-14021"
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Expires On (YYYY-MM-DD)</label>
                      <input
                        type="date"
                        value={formData.expires_on || ""}
                        onChange={(e) => setFormData({ ...formData, expires_on: e.target.value })}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-base"
                      />
                    </div>
                  </>
                )}

                <div className="pt-4 flex justify-end gap-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-[#E2E8F0] rounded-lg text-base font-semibold hover:bg-[#F8FAFC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-lg text-base font-semibold text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50"
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
