import { memo, type FC, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "react-router-dom";
import { inAppPath } from "@/lib/links";
import { cn } from "@/lib/utils";

/** In-app links navigate inside the app (desktop/phone included); everything else opens in a new tab. */
const MarkdownLink: FC<{ href?: string; children?: ReactNode }> = ({ href, children }) => {
  const navigate = useNavigate();
  const path = inAppPath(href);
  if (!path) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <a
      href={path}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(path);
      }}
    >
      {children}
    </a>
  );
};

/** Message/markdown renderer. In-app links navigate within the app, others open in a new tab; raw HTML is not rendered (XSS-safe by default). */
export const Markdown: FC<{ children: string; className?: string }> = memo(({ children, className }) => (
  <div className={cn("prose-chat break-words", className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children: c }) => <MarkdownLink href={href}>{c}</MarkdownLink>,
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
