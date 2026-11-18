import { memo, type FC } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Message/markdown renderer. Links open in a new tab; raw HTML is not rendered (XSS-safe by default). */
export const Markdown: FC<{ children: string; className?: string }> = memo(({ children, className }) => (
  <div className={cn("prose-chat break-words", className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children: c }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {c}
          </a>
        ),
        table: ({ children: c }) => (
          <div className="my-3 overflow-x-auto rounded-md border border-hairline">
            <table className="!my-0">{c}</table>
          </div>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  </div>
));
Markdown.displayName = "Markdown";
