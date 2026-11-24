"use client";

import React from "react";

export interface DismissibleToastProps {
  message: string | null;
  onDismiss: () => void;
  type?: "error" | "warning" | "info" | "success";
}

export function DismissibleToast({
  message,
  onDismiss,
  type = "error",
}: DismissibleToastProps) {
  if (!message) return null;

  const config = {
    error: {
      bg: "bg-red-50",
      border: "border-[#B91C1C]",
      text: "text-[#B91C1C]",
      icon: "⛔",
      label: "Error",
    },
    warning: {
      bg: "bg-amber-50",
      border: "border-[#D97706]",
      text: "text-[#D97706]",
      icon: "⚠️",
      label: "Warning",
    },
    info: {
      bg: "bg-blue-50",
      border: "border-[#2563EB]",
      text: "text-[#2563EB]",
      icon: "ℹ️",
      label: "Info",
    },
    success: {
      bg: "bg-emerald-50",
      border: "border-emerald-600",
      text: "text-emerald-800",
      icon: "✓",
      label: "Success",
    },
  }[type];

  return (
    <div
      role="alert"
      className={`p-4 ${config.bg} border ${config.border} ${config.text} rounded-xl text-base font-medium flex items-start justify-between gap-3 shadow-sm transition-all`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-lg leading-none mt-0.5">
          {config.icon}
        </span>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider block">
            {config.label}
          </span>
          <p className="text-slate-800 text-sm sm:text-base font-normal mt-0.5">
            {message}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-black/5 transition focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
      >
        <span aria-hidden="true" className="text-base leading-none font-bold">
          ✕
        </span>
      </button>
    </div>
  );
}

export default DismissibleToast;
