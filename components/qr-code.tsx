"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Renders a QR code for a same-origin path (e.g. "/login"). The absolute
// URL is resolved from window.location.origin inside this component's own
// effect — which only ever runs client-side, so window is always defined —
// rather than by the caller computing it during render. A caller-side
// `typeof window !== "undefined" ? ... : "/path"` ternary looks safe but
// isn't: React still renders the `else` branch during the server pass, so
// an SSR render (or hydration mismatch) could encode the bare relative
// string instead of an absolute, scannable URL.
export function QrCode({ path, size = 160 }: { path: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const value = `${window.location.origin}${path}`;
    // Update 4a: was near-white modules (`#e2e8f0`) on a transparent
    // background — a leftover from the app's dark projector surface,
    // rendered here on the light credential-sheet background at roughly
    // 1.1:1 contrast, unscannable. Solid black-on-white with a wider quiet
    // zone (margin 2, the practical minimum for reliable scanning) fixes
    // both the contrast and the scan reliability.
    QRCode.toString(value, { type: "svg", margin: 2, width: size, color: { dark: "#000000", light: "#ffffff" } }).then(
      (markup) => {
        if (!cancelled) setSvg(markup);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [path, size]);

  if (!svg) return <div style={{ width: size, height: size }} className="bg-neutral-300 rounded-md animate-pulse" />;

  return (
    <div
      role="img"
      aria-label={`QR code linking to ${path}`}
      style={{ width: size, height: size }}
      className="rounded-md bg-white p-1"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
