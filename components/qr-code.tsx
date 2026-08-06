"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: "svg", margin: 1, width: size, color: { dark: "#e2e8f0", light: "#0000" } }).then(
      (markup) => {
        if (!cancelled) setSvg(markup);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!svg) return <div style={{ width: size, height: size }} className="bg-slate-800/50 rounded-md animate-pulse" />;

  return <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
