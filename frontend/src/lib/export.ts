import type { StoredMessage } from "@/types/engine";

/** Renders a conversation as a readable Markdown document. */
export const conversationToMarkdown = (title: string, messages: StoredMessage[]): string => {
  const parts = [`# ${title}`, "", `_Exported ${new Date().toLocaleString()}_`, ""];

  messages.forEach((m, i) => {
    parts.push("---", "", `## ${i + 1}. ${m.prompt}`, "", m.optimizedAnswer, "");
    if (m.ranking.length > 0) {
      parts.push("| Rank | Model | Score | Confidence |", "| --- | --- | --- | --- |");
      for (const r of m.ranking) {
        parts.push(`| ${r.rank} | ${r.label} | ${r.score} | ${r.confidence}% |`);
      }
      parts.push("");
    }
  });

  return parts.join("\n");
};

/** Triggers a browser download of `content` as a text file. */
export const downloadText = (filename: string, content: string, type = "text/markdown"): void => {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke after the click has been handled, or some browsers cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Filesystem-safe slug for download names. */
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "conversation";
