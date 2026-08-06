import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Operation Veiled Horizon — WHO Pandemic Response Simulation",
    short_name: "Veiled Horizon",
    description:
      "A live, multi-team simulation for teaching global health policy: six teams each run a WHO regional office, responding to a pandemic in real time.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#0f172a",
    icons: [
      { src: "/manifest-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/manifest-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/manifest-icon/512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
