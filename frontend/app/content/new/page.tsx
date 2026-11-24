"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";
import DismissibleToast from "@/components/Toast";

export default function NewContentPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("Social");
  const [text, setText] = useState("");
  const [hasImage, setHasImage] = useState(false);
  const [altText, setAltText] = useState("");
  const [logoBg, setLogoBg] = useState("");
  const [fg, setFg] = useState("#1E293B");
  const [bg, setBg] = useState("#FFFFFF");

  const [approvedLogoBgs, setApprovedLogoBgs] = useState<string[]>(["#FFFFFF", "#2E7D32"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);

  useEffect(() => {
    apiRequest<{ approved_logo_backgrounds?: string[] }>("/kb/asset")
      .then((data) => {
        if (data && data.approved_logo_backgrounds && data.approved_logo_backgrounds.length > 0) {
          setApprovedLogoBgs(data.approved_logo_backgrounds);
          setLogoBg(data.approved_logo_backgrounds[0]);
        }
      })
      .catch(() => {
        setLogoBg("#FFFFFF");
      });
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("File size exceeds 5 MB limit.");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadSuccess(null);
    setUploadWarnings([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await apiRequest<{
        text: string;
        meta_suggestions: Record<string, any>;
        warnings: string[];
      }>("/upload", {
        method: "POST",
        body: formData,
      });

      if (result.text) {
        setText(result.text);
      }

      if (result.meta_suggestions) {
        const ms = result.meta_suggestions;
        if (ms.has_image !== undefined) setHasImage(Boolean(ms.has_image));
        if (ms.alt_text) setAltText(ms.alt_text);
        if (ms.logo_bg) setLogoBg(ms.logo_bg);
        if (ms.fg) setFg(ms.fg);
        if (ms.bg) setBg(ms.bg);
      }

      if (result.warnings && result.warnings.length > 0) {
        setUploadWarnings(result.warnings);
      }

      if (!title.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }

      setUploadSuccess(`Extracted content from "${file.name}" successfully.`);
    } catch (err: any) {
      setError(err?.message || "File upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !text.trim()) {
      setError("Please fill in both title and content text.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const meta: any = {
        has_image: hasImage,
        alt_text: hasImage ? altText.trim() : "",
        logo_bg: logoBg,
        fg: fg,
        bg: bg,
      };

      const result = await apiRequest<{ id: string }>("/content", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          channel,
          text: text.trim(),
          meta,
        }),
      });

      router.push(`/content/${result.id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to create content");
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#142D4E] tracking-tight">Create New Content</h1>
            <p className="text-base text-slate-600 mt-1">
              Draft content or import from documents for automated brand governance review.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-base font-semibold text-[#2563EB] hover:underline"
          >
            ← Back to dashboard
          </Link>
        </div>

        {/* Dismissible Error Toast */}
        <DismissibleToast message={error} onDismiss={() => setError(null)} />

        {/* Drag and Drop Upload Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 ${
            isDragging
              ? "border-[#2563EB] bg-blue-50/60"
              : "border-[#E2E8F0] bg-white hover:bg-slate-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Upload document or image file"
            accept=".txt,.pdf,.docx,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          <div className="text-3xl">{uploading ? "⏳" : "📁"}</div>
          <div className="text-base font-semibold text-[#142D4E]">
            {uploading ? "Extracting file content & metadata..." : "Drop a document or image here, or click to upload"}
          </div>
          <p className="text-xs text-slate-500">
            Accepts .txt, .pdf (pdfplumber), .docx (Word), .png, .jpg (OCR & dominant colour) • Max 5 MB
          </p>
        </div>

        {uploadSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-sm font-medium flex items-center gap-2">
            <span>✓</span>
            <span>{uploadSuccess}</span>
          </div>
        )}

        {uploadWarnings.length > 0 && (
          <div className="p-4 bg-amber-50 border border-[#D97706] text-[#D97706] rounded-xl text-sm space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <span>⚠️</span> Extraction Notice:
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {uploadWarnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
          <div>
            <label htmlFor="title" className="block text-base font-semibold text-[#1E293B] mb-1.5">
              Title / Campaign Name *
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer Single-Origin Launch"
              className="w-full px-4 py-2.5 text-base border border-[#E2E8F0] rounded-lg text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label htmlFor="channel" className="block text-base font-semibold text-[#1E293B] mb-1.5">
              Channel *
            </label>
            <select
              id="channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full px-4 py-2.5 text-base border border-[#E2E8F0] rounded-lg text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="Social">Social</option>
              <option value="Web">Web</option>
              <option value="Email">Email</option>
              <option value="Brochure">Brochure</option>
            </select>
          </div>

          <div>
            <label htmlFor="text" className="block text-base font-semibold text-[#1E293B] mb-1.5">
              Content Text *
            </label>
            <textarea
              id="text"
              rows={8}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your campaign copy, social post, or email text here..."
              className="w-full px-4 py-2.5 text-base border border-[#E2E8F0] rounded-lg text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] font-sans"
            />
          </div>

          {/* Media & Visual Metadata */}
          <div className="pt-4 border-t border-[#E2E8F0] space-y-4">
            <h3 className="text-lg font-bold text-[#142D4E]">Visual & Accessibility Metadata</h3>

            <div className="flex items-center gap-3">
              <input
                id="has_image"
                type="checkbox"
                checked={hasImage}
                onChange={(e) => setHasImage(e.target.checked)}
                className="w-5 h-5 text-[#2563EB] border-[#E2E8F0] rounded focus:ring-[#38BDF8]"
              />
              <label htmlFor="has_image" className="text-base font-medium text-[#1E293B] cursor-pointer">
                Includes an image
              </label>
            </div>

            {hasImage && (
              <div className="pl-8">
                <label htmlFor="alt_text" className="block text-base font-semibold text-[#1E293B] mb-1.5">
                  Image Alt Text (A11Y-1 requirement)
                </label>
                <input
                  id="alt_text"
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Describe what the image shows for screen readers..."
                  className="w-full px-4 py-2.5 text-base border border-[#E2E8F0] rounded-lg text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
            )}

            <div>
              <label htmlFor="logo_bg" className="block text-base font-semibold text-[#1E293B] mb-1.5">
                Logo Background Color
              </label>
              <select
                id="logo_bg"
                value={logoBg}
                onChange={(e) => setLogoBg(e.target.value)}
                className="w-full px-4 py-2.5 text-base border border-[#E2E8F0] rounded-lg text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="">None / Custom</option>
                {approvedLogoBgs.map((hex) => (
                  <option key={hex} value={hex}>
                    {hex} (Brand Approved)
                  </option>
                ))}
                {logoBg && !approvedLogoBgs.includes(logoBg) && (
                  <option value={logoBg}>
                    {logoBg} (Detected from Image)
                  </option>
                )}
                <option value="#D32F2F">#D32F2F (Unapproved Red)</option>
                <option value="#000000">#000000 (Black)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fg" className="block text-base font-semibold text-[#1E293B] mb-1.5">
                  Text Colour (fg)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="fg"
                    type="color"
                    value={fg.startsWith("#") && fg.length === 7 ? fg : "#1E293B"}
                    onChange={(e) => setFg(e.target.value)}
                    className="h-10 w-16 p-1 border border-[#E2E8F0] rounded cursor-pointer"
                  />
                  <span className="text-base font-mono text-slate-700">{fg}</span>
                </div>
              </div>

              <div>
                <label htmlFor="bg" className="block text-base font-semibold text-[#1E293B] mb-1.5">
                  Background Colour (bg)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="bg"
                    type="color"
                    value={bg.startsWith("#") && bg.length === 7 ? bg : "#FFFFFF"}
                    onChange={(e) => setBg(e.target.value)}
                    className="h-10 w-16 p-1 border border-[#E2E8F0] rounded cursor-pointer"
                  />
                  <span className="text-base font-mono text-slate-700">{bg}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-4 border-t border-[#E2E8F0]">
            <Link
              href="/dashboard"
              className="px-5 py-2.5 border border-[#E2E8F0] rounded-lg text-base font-semibold text-[#1E293B] hover:bg-[#F8FAFC] transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || uploading}
              className="px-6 py-2.5 rounded-lg text-base font-semibold text-white bg-[#2563EB] hover:bg-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF8] focus:ring-offset-2 transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Save & Review Draft"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
