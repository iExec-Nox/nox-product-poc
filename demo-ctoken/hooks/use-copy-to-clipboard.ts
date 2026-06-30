"use client";

import { useState, useCallback } from "react";

export function useCopyToClipboard(delay = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), delay);
      }).catch(() => {});
    },
    [delay],
  );

  return { copied, copy };
}
