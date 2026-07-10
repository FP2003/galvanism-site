import Link from "next/link";
import { ExternalLink } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

/*
 * Shared renderer for free-text fields (card description/descriptiveText,
 * character bio, mission briefing) that support Markdown. Overrides drop the
 * browser default margins/list markers so output inherits the caller's
 * typography instead of fighting it, and remarkBreaks turns a single Enter
 * in a textarea into a real line break (CommonMark otherwise collapses it to
 * a space).
 *
 * A link to /registry/... (Phase 8) renders as an in-app Link with a
 * trailing icon flagging "this navigates elsewhere in the app," instead of
 * opening in a new tab like every other link here.
 */
const components: Components = {
  p: ({ children }) => <p className="m-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-0.5 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-0.5 pl-4">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => {
    if (href?.startsWith("/registry/")) {
      return (
        <Link href={href} className="underline underline-offset-2">
          {children}
          <ExternalLink size={11} className="ml-0.5 inline-block align-baseline" aria-hidden="true" />
        </Link>
      );
    }
    return (
      <a href={href} className="underline" target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
