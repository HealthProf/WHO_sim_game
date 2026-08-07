"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PillButton } from "@/components/ui/pill-button";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid username or password.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-lg bg-bg shadow-lg p-10">
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent-700 mb-2">
          Operation Veiled Horizon
        </p>
        <h1 className="font-heading text-[34px] leading-[1.1] text-text mb-2.5">Sign in</h1>
        <p className="text-[15px] text-neutral-800 mb-6">Your team, instructor, or personal credentials.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-text mb-1.5">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-full border-2 border-divider bg-bg px-[18px] py-[10px] text-[15px] text-neutral-700"
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-text mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-full border-2 border-divider bg-bg px-[18px] py-[10px] text-[15px] text-neutral-700"
            />
          </div>
          {error && <p className="text-sm text-accent-700">{error}</p>}
          <PillButton type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </PillButton>
        </form>
        <p className="text-[13px] text-neutral-700 mt-5 text-center">
          No account?{" "}
          <a href="/register" className="text-accent-700 hover:text-accent">
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
