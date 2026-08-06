import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { InstallPrompt } from "@/components/install-prompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
  themeColor: "#0f172a",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <Providers>{children}</Providers>
        <InstallPrompt />
      </body>
    </html>
  );
}
