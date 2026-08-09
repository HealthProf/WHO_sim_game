import { readFile } from "node:fs/promises";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { AppFooter } from "@/components/app-footer";

export const dynamic = "force-static";

export const metadata = {
  title: "License — Operation Veiled Horizon",
};

// Update 2: renders LICENSE.md in-app from the repo file itself (read at
// request time from disk) rather than a copy pasted into a component, so the
// in-app text can never drift from the repo's LICENSE.md — the single
// source of truth the author asked for. The build's file tracer needs an
// explicit hint that this route depends on a file outside app/ — see
// next.config.ts's outputFileTracingIncludes, without which this 500s on
// Vercel while working fine locally.
//
// react-markdown has no CSS of its own and this project has no Tailwind
// typography plugin installed, so every element below is styled explicitly
// via the `components` map using the app's existing design tokens, rather
// than relying on a "prose" class that doesn't exist here.
const GITHUB_LICENSE_URL = "https://github.com/HealthProf/WHO_sim_game/blob/main/LICENSE.md";

// LICENSE.md's own headings start at `#` (the document title) and `##`
// (Part I / Part II and their sections). This page owns the single page-level
// <h1>, so every markdown heading is shifted down one level to keep the
// outline valid (WCAG 1.3.1) — `#` -> h2, `##` -> h3.
const components: Components = {
  h1: ({ children }) => <h2 className="font-heading text-[26px] text-text mt-10 mb-3 first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="font-heading text-[20px] text-text mt-8 mb-2">{children}</h3>,
  h3: ({ children }) => <h4 className="font-heading text-[17px] text-text mt-6 mb-2">{children}</h4>,
  p: ({ children }) => <p className="text-[15px] text-neutral-800 leading-[1.65] mb-4 break-words">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 text-[15px] text-neutral-800 leading-[1.65] mb-4 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 text-[15px] text-neutral-800 leading-[1.65] mb-4 space-y-1">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-divider pl-4 py-1 my-4 text-[15px] text-neutral-700 italic">{children}</blockquote>
  ),
  hr: () => <hr className="border-divider my-8" />,
  strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
  code: ({ children }) => <code className="font-mono text-[13px] bg-surface rounded px-1.5 py-0.5 break-words">{children}</code>,
  a: ({ href, children }) => {
    const isExternal = /^https?:\/\//.test(href ?? "");
    return (
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="text-accent-700 underline decoration-1 underline-offset-2 hover:text-accent-600 break-words"
      >
        {children}
        {isExternal && <span className="sr-only"> (opens in a new tab)</span>}
      </a>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-[14px] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="text-left border-b-2 border-divider py-1.5 pr-4 font-semibold text-text">{children}</th>,
  td: ({ children }) => <td className="border-b border-divider py-1.5 pr-4 text-neutral-800">{children}</td>,
};

export default async function LicensePage() {
  const licenseMd = await readFile(path.join(process.cwd(), "LICENSE.md"), "utf8");

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent-700 mb-2">Operation Veiled Horizon</p>
        <h1 className="font-heading text-[32px] text-text mb-4">License</h1>

        <p className="text-[14px] text-neutral-700 leading-[1.6] mb-8 rounded-lg bg-surface p-4">
          This page renders the license terms directly from the repository so they remain available regardless of
          network conditions. The{" "}
          <a
            href={GITHUB_LICENSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-700 underline decoration-1 underline-offset-2 hover:text-accent-600"
          >
            canonical LICENSE.md on GitHub
            <span className="sr-only"> (opens in a new tab)</span>
          </a>{" "}
          is the authoritative source if this copy and the repository ever disagree.
        </p>

        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {licenseMd}
        </ReactMarkdown>
      </div>
      <AppFooter />
    </div>
  );
}
