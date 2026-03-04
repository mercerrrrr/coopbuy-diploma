"use client";

import { useState } from "react";

export function CopyLinkButton({ textToCopy, label = "Скопировать" }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
    >
      {copied ? "Скопировано ✓" : label}
    </button>
  );
}
