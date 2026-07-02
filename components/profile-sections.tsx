// Region profileMarkdown (lib/db/seed-data/regions.ts) is written as a
// series of "**Header:** body" paragraphs separated by blank lines. It used
// to be dumped through whitespace-pre-wrap, which rendered the literal
// double-asterisks instead of bold text and produced one dense scrolling
// block. This renders it as scannable, labeled cards instead, with no
// changes needed to the underlying seed content.

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-slate-100">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface ProfileSection {
  header: string | null;
  body: string;
}

function parseSections(markdown: string): ProfileSection[] {
  return markdown
    .split(/\n\n+/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => {
      const match = para.match(/^\*\*(.+?):\*\*\s*([\s\S]*)$/);
      if (match) return { header: match[1], body: match[2] };
      return { header: null, body: para };
    });
}

export function ProfileSections({ markdown }: { markdown: string }) {
  const sections = parseSections(markdown);
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {sections.map((s, i) => (
        <div key={i} className="bg-slate-800/50 rounded-lg p-3">
          {s.header && <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{s.header}</p>}
          <p className="text-sm text-slate-300">
            <InlineMarkdown text={s.body} />
          </p>
        </div>
      ))}
    </div>
  );
}
