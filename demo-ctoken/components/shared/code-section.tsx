"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { codeToHtml } from "shiki";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

interface CodeSectionProps {
  code: string;
  language?: "solidity" | "typescript" | "javascript";
}

export function CodeSection({ code, language = "solidity" }: CodeSectionProps) {
  const { copied, copy } = useCopyToClipboard();
  const { resolvedTheme } = useTheme();
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");

  useEffect(() => {
    if (!resolvedTheme) return;
    codeToHtml(code, {
      lang: language,
      theme: resolvedTheme === "dark" ? "github-dark" : "github-light",
    }).then(setHighlightedHtml).catch(() => {});
  }, [code, language, resolvedTheme]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 rounded-2xl border border-surface-border bg-surface px-5 py-3 backdrop-blur-sm md:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary">
            <span aria-hidden="true" className="material-icons text-[24px]! text-primary-foreground">
              code
            </span>
          </div>
          <span className="font-mulish text-sm font-bold text-text-heading">
            Function called
          </span>
        </div>
        <button
          type="button"
          onClick={() => copy(code)}
          className="flex cursor-pointer items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-surface-border/50"
          aria-label="Copy code"
        >
          <span aria-hidden="true" className="material-icons text-[18px]! text-text-muted transition-colors">
            {copied ? "check" : "content_copy"}
          </span>
        </button>
      </div>
      {highlightedHtml ? (
        <div
          className="overflow-x-auto font-mono text-xs leading-[19.5px] [&_pre]:bg-transparent! [&_code]:bg-transparent!"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="overflow-x-auto font-mono text-xs leading-[19.5px] text-code-text">
          {code}
        </pre>
      )}
    </div>
  );
}
