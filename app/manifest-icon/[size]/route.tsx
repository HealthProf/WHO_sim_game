import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

// Serves the 192/512/512-maskable PNG icons referenced from app/manifest.ts.
// A maskable icon must keep its content inside the center ~80% "safe zone"
// since Android crops the outer edge to whatever shape the launcher wants.
const VARIANTS: Record<string, { px: number; maskable: boolean }> = {
  "192": { px: 192, maskable: false },
  "512": { px: 512, maskable: false },
  "512-maskable": { px: 512, maskable: true },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const variant = VARIANTS[size];
  if (!variant) return new Response("Not found", { status: 404 });

  const { px, maskable } = variant;
  const fontSize = maskable ? px * 0.28 : px * 0.4;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#38bdf8",
          fontSize,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        VH
      </div>
    ),
    { width: px, height: px }
  );
}
