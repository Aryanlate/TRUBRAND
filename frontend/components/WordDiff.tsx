"use client";

import React from "react";

interface WordDiffProps {
  oldText: string;
  newText: string;
}

export function computeWordDiff(oldStr: string, newStr: string) {
  const oldWords = oldStr.split(/(\s+)/);
  const newWords = newStr.split(/(\s+)/);

  const n = oldWords.length;
  const m = newWords.length;

  // Standard Myers-style LCS DP matrix for word tokens
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to generate diff tokens
  const diff: { type: "same" | "add" | "del"; value: string }[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      diff.unshift({ type: "same", value: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: "add", value: newWords[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: "del", value: oldWords[i - 1] });
      i--;
    }
  }

  return diff;
}

export default function WordDiff({ oldText, newText }: WordDiffProps) {
  const diff = computeWordDiff(oldText, newText);

  return (
    <div className="font-sans leading-relaxed text-base p-4 bg-white border border-[#E2E8F0] rounded-xl whitespace-pre-wrap">
      {diff.map((part, index) => {
        if (part.type === "add") {
          return (
            <span
              key={index}
              className="bg-emerald-100 text-emerald-800 font-semibold px-0.5 rounded"
              title="Added"
            >
              {part.value}
            </span>
          );
        }
        if (part.type === "del") {
          return (
            <span
              key={index}
              className="bg-red-100 text-[#B91C1C] line-through px-0.5 rounded"
              title="Deleted"
            >
              {part.value}
            </span>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </div>
  );
}
