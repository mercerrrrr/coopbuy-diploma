"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function CopyLinkButton({ textToCopy, label = "Скопировать" }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // no-op
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      variant={copied ? "success" : "secondary"}
      size="sm"
      className="min-w-[108px] justify-center"
    >
      {copied ? "Скопировано" : label}
    </Button>
  );
}
