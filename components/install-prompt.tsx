"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "vh-install-prompt-dismissed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

// Item Phase 6: install affordance. Android/Chrome fires `beforeinstallprompt`
// and we can trigger the native install flow directly; iOS Safari has no such
// event, so we fall back to a one-line "Share > Add to Home Screen" hint.
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY) === "1") return;

    if (isIOS()) {
      queueMicrotask(() => setShowIosHint(true));
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDeferredPrompt(null);
    setShowIosHint(false);
  };

  if (!deferredPrompt && !showIosHint) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-50 bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl text-sm text-slate-200">
      {showIosHint ? (
        <p>
          Install this app: tap <span className="font-semibold">Share</span>, then{" "}
          <span className="font-semibold">Add to Home Screen</span>.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p>Install Operation Veiled Horizon for quicker access and a full-screen view.</p>
          <button
            type="button"
            onClick={async () => {
              await deferredPrompt?.prompt();
              await deferredPrompt?.userChoice;
              setDeferredPrompt(null);
              dismiss();
            }}
            className="shrink-0 rounded-md bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-white font-medium"
          >
            Install
          </button>
        </div>
      )}
      <button type="button" onClick={dismiss} className="mt-2 text-xs text-slate-500 hover:text-slate-300">
        Dismiss
      </button>
    </div>
  );
}
