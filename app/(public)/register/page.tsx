"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PillButton } from "@/components/ui/pill-button";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ username: string; password: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/account/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name }),
      });

      let json: { error?: string; user?: { username: string }; generatedPassword?: string | null };
      try {
        json = await res.json();
      } catch {
        setError("Registration failed — the server sent an unexpected response. Please try again.");
        return;
      }

      if (!res.ok) {
        setError(json.error ?? "Registration failed.");
        return;
      }

      setResult({ username: json.user!.username, password: json.generatedPassword ?? null });
    } catch {
      setError("Registration failed — couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    if (!result) return;
    await signIn("credentials", { username: result.username, password: result.password, redirect: false });
    router.push("/");
    router.refresh();
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm rounded-lg bg-bg shadow-lg p-10">
          <h1 className="font-heading text-[34px] leading-[1.1] text-text mb-2.5">You&apos;re in, {result.username}</h1>
          <p className="text-[15px] text-neutral-800 mb-5">
            Username <span className="font-semibold text-text">{result.username}</span>
          </p>
          {result.password && (
            <div className="rounded-lg bg-accent-100 p-5 mb-5">
              <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent-700 mb-2">
                Save this now
              </p>
              <code className="block font-mono text-[18px] font-bold text-accent-900 mb-2.5 break-all">
                {result.password}
              </code>
              <p className="text-[13px] text-accent-800 leading-[1.5] mb-3.5">
                There is no recovery without an email on file, and it will never be shown again. You can change it
                any time from your Account page.
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(result.password!);
                  setCopied(true);
                }}
                className="inline-flex items-center justify-center rounded-full border-2 border-accent-400 text-accent-800 px-[18px] py-[8px] text-[13px] font-semibold hover:bg-accent-200 transition-colors"
              >
                {copied ? "Copied" : "Copy password"}
              </button>
            </div>
          )}
          <PillButton type="button" onClick={handleContinue} className="w-full">
            Continue
          </PillButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-lg bg-bg shadow-lg p-10">
        <h1 className="font-heading text-[34px] leading-[1.1] text-text mb-2.5">Create an account</h1>
        <p className="text-[15px] text-neutral-800 mb-6">
          Used to run an instructor session or explore on your own. No email required — optional profile fields come
          after. We&apos;ll generate a password for you; you can change it any time from your Account page.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-text mb-1.5">Your name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-full border-2 border-divider bg-bg px-[18px] py-[10px] text-[15px] text-neutral-700"
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-text mb-1.5">Username</label>
            <input
              type="text"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-full border-2 border-divider bg-bg px-[18px] py-[10px] text-[15px] text-neutral-700"
            />
          </div>
          {error && <p className="text-sm text-accent-700">{error}</p>}
          <PillButton type="submit" disabled={loading} className="w-full">
            {loading ? "Creating account..." : "Create account"}
          </PillButton>
        </form>
        <p className="text-[13px] text-neutral-700 mt-5 text-center">
          Already have an account?{" "}
          <a href="/login" className="text-accent-700 hover:text-accent">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
