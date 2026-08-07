import type { Metadata, Viewport } from "next";
import { Caprasimo, Figtree } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { InstallPrompt } from "@/components/install-prompt";

const caprasimo = Caprasimo({
  variable: "--font-heading",
  weight: "400",
  subsets: ["latin"],
});

const figtree = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://who-sim-game.vercel.app"),
  title: {
    default: "Operation Veiled Horizon — WHO Pandemic Response Simulation",
    template: "%s — Operation Veiled Horizon",
  },
  description:
    "A live, multi-team simulation for teaching global health policy: six teams each run a WHO regional office, responding to a pandemic in real time while every decision feeds a shared epidemic model.",
  openGraph: {
    title: "Operation Veiled Horizon — WHO Pandemic Response Simulation",
    description:
      "Six teams, one epidemic, and a scoring model that rewards evidence, political realism, and equity rather than correctness.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#2e2b25",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${caprasimo.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <Providers>{children}</Providers>
        <InstallPrompt />
      </body>
    </html>
  );
}
