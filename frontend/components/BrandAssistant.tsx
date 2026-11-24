"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { apiRequest } from "@/lib/api";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  source_ids?: string[];
  grounded?: boolean;
  feedback?: "up" | "down" | null;
}

const STARTER_QUESTIONS = [
  "What is our rule on superlatives?",
  "Can we compare against competitors?",
  "What are our certified claims?",
  "How should the brand name be written?",
];

export default function BrandAssistant() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract content_id if on /content/[id] page
  const contentIdMatch = pathname?.match(/\/content\/([^/]+)/);
  const contentId = contentIdMatch && contentIdMatch[1] !== "new" ? contentIdMatch[1] : null;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputValue).trim();
    if (!textToSend || sending) return;

    const userMsg: ChatMessage = {
      id: "u-" + Date.now(),
      sender: "user",
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setSending(true);

    try {
      const res = await apiRequest<{
        id: string;
        answer: string;
        source_ids: string[];
        grounded: boolean;
      }>("/assistant", {
        method: "POST",
        body: JSON.stringify({
          question: textToSend,
          content_id: contentId,
        }),
      });

      const assistantMsg: ChatMessage = {
        id: res.id,
        sender: "assistant",
        text: res.answer,
        source_ids: res.source_ids || [],
        grounded: res.grounded,
        feedback: null,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: "err-" + Date.now(),
        sender: "assistant",
        text: err?.message || "Sorry, I encountered an error checking the guidelines.",
        grounded: false,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleFeedback = async (messageId: string, feedback: "up" | "down") => {
    try {
      await apiRequest(`/assistant/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({ feedback }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback } : m))
      );
    } catch {
      // Ignore feedback error
    }
  };

  return (
    <>
      {/* Floating round button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open Brand Assistant"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#38BDF8] hover:bg-[#0284C7] text-[#142D4E] hover:text-white shadow-xl flex items-center justify-center text-2xl transition focus:outline-none focus:ring-4 focus:ring-[#38BDF8]/50"
      >
        {isOpen ? "✕" : "💬"}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Brand Assistant Chat"
          className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[540px] max-h-[calc(100vh-8rem)] bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* Header */}
          <div className="bg-[#142D4E] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <div>
                <h3 className="font-bold text-base leading-tight">Brand Assistant</h3>
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-[#38BDF8] text-[#142D4E] px-1.5 py-0.2 rounded mt-0.5">
                  AI-assisted
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant panel"
              className="text-slate-300 hover:text-white p-1 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFC]">
            {messages.length === 0 ? (
              <div className="space-y-4 pt-2">
                <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] text-sm text-[#1E293B]">
                  👋 Hello! I'm your Brand Compliance Assistant. Ask me anything about our brand rules, spelling, claims, or active findings.
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Suggested Questions
                  </div>
                  <div className="space-y-1.5">
                    {STARTER_QUESTIONS.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSend(q)}
                        className="w-full text-left text-xs font-medium p-2 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB] text-[#1E293B] transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${
                      m.sender === "user"
                        ? "bg-[#2563EB] text-white rounded-br-none"
                        : "bg-white text-[#1E293B] border border-[#E2E8F0] rounded-bl-none shadow-sm space-y-2"
                    }`}
                  >
                    <div>{m.text}</div>

                    {m.sender === "assistant" && (
                      <div className="pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                        <span className="font-semibold text-slate-400">AI-assisted</span>

                        {m.id.startsWith("u-") || m.id.startsWith("err-") ? null : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleFeedback(m.id, "up")}
                              className={`p-1 rounded hover:bg-slate-100 transition ${
                                m.feedback === "up" ? "text-emerald-600 font-bold" : "text-slate-400"
                              }`}
                              title="Helpful"
                              aria-label="Thumbs up"
                            >
                              👍
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedback(m.id, "down")}
                              className={`p-1 rounded hover:bg-slate-100 transition ${
                                m.feedback === "down" ? "text-red-600 font-bold" : "text-slate-400"
                              }`}
                              title="Not helpful"
                              aria-label="Thumbs down"
                            >
                              👎
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Cited source chips under assistant answers */}
                  {m.sender === "assistant" && m.source_ids && m.source_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 pl-1">
                      {m.source_ids.map((sid) => (
                        <span
                          key={sid}
                          className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#142D4E] font-mono text-[10px] font-semibold"
                        >
                          📖 {sid}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            {sending && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white p-2.5 rounded-xl border border-[#E2E8F0] w-fit">
                <span className="animate-spin">🔄</span> Checking brand guidelines...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-[#E2E8F0] flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a brand rule question..."
              className="flex-1 px-3 py-2 text-sm border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
            <button
              type="submit"
              disabled={sending || !inputValue.trim()}
              className="px-3 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm transition disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
