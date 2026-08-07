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
          <strong key={i} className="font-semibold text-text">
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
        <div key={i} className="rounded-md bg-bg p-3">
          {s.header && <p className="mb-1 text-xs uppercase tracking-wide text-neutral-700">{s.header}</p>}
          <p className="text-sm text-neutral-800">
            <InlineMarkdown text={s.body} />
          </p>
        </div>
      ))}
    </div>
  );
}
