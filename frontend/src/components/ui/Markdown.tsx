import { memo } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

interface MarkdownProps {
  content: string;
}

/** Markdown renderer with GFM tables and syntax-highlighted, copyable code. */
export const Markdown = memo(({ content }: MarkdownProps) => (
  <div className="prose-ai">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className ?? "");
          const text = String(children).replace(/\n$/, "");
          const isInline = !className && !text.includes("\n");
          if (isInline) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
          const language = match?.[1] ?? "text";
          return (
            <CodeBlock code={text} language={language}>
              <SyntaxHighlighter
                language={language}
                style={oneDark}
                customStyle={{ margin: 0, background: "#0d0d14", fontSize: "0.82rem" }}
                PreTag="div"
              >
                {text}
              </SyntaxHighlighter>
            </CodeBlock>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
));
Markdown.displayName = "Markdown";
