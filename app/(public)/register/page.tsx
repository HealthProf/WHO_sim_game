"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [useOwnPassword, setUseOwnPassword] = useState(false);
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({
          username,
          name,
          password: useOwnPassword ? password : undefined,
        }),
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

      setResult({ username: json.user!.username, password: json.generatedPassword ?? password });
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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-8">
          <h1 className="text-xl font-semibold text-slate-100 mb-1">Account created</h1>
          <p className="text-sm text-slate-400 mb-4">
            Username: <span className="text-slate-200">{result.username}</span>
          </p>
          {result.password && (
            <>
              <p className="text-sm text-amber-400 font-medium mb-2">
                Save this password now — there is no recovery without an email on file, and it will never be shown again.
              </p>
              <div className="flex gap-2 mb-6">
                <code className="flex-1 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm break-all">
                  {result.password}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(result.password!);
                    setCopied(true);
                  }}
                  className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={handleContinue}
            className="w-full rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 transition"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-8">
        <h1 className="text-xl font-semibold text-slate-100 mb-1">Create an account</h1>
        <p className="text-sm text-slate-400 mb-6">
          Used to run an instructor session or explore on your own. No email required — optional profile fields come after.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Your name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Username</label>
            <input
              type="text"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={useOwnPassword} onChange={(e) => setUseOwnPassword(e.target.checked)} />
            Set my own password instead of generating one
          </label>
          {useOwnPassword && (
            <div>
              <label className="block text-sm text-slate-300 mb-1">Password</label>
              <input
                type="password"
                required={useOwnPassword}
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2 transition"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="text-sm text-slate-500 mt-6 text-center">
          Already have an account? <a href="/login" className="text-blue-400 hover:text-blue-300">Sign in</a>
        </p>
      </div>
    </div>
  );
}
