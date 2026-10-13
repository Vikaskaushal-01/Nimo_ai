import { Check, Copy, Download } from "lucide-react";
import { useState, type ReactNode } from "react";

interface CodeBlockProps {
  code: string;
  language: string;
  children: ReactNode;
}

/** Wraps a highlighted code block with a header offering copy + download. */
export const CodeBlock = ({ code, language, children }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure origin or permission denied) */
    }
  };

  const download = () => {
    const ext = EXT[language] ?? "txt";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snippet.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/10">
      <div className="flex items-center justify-between bg-white/5 px-3 py-1.5 text-[11px] text-slate-400">
        <span className="font-mono uppercase tracking-wide">{language}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/10 hover:text-white"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={download}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/10 hover:text-white"
          >
            <Download size={12} />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
};

const EXT: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  tsx: "tsx",
  jsx: "jsx",
  python: "py",
  bash: "sh",
  shell: "sh",
  json: "json",
  html: "html",
  css: "css",
  go: "go",
  rust: "rs",
  java: "java",
  sql: "sql",
};
