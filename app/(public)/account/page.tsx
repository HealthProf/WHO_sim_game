"use client";

import { useEffect, useState } from "react";

interface Account {
  username: string;
  name: string;
  email: string | null;
  institution: string | null;
}

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ account }: { account: Account }) => {
        setAccount(account);
        setName(account.name);
        setEmail(account.email ?? "");
        setInstitution(account.institution ?? "");
      })
      .catch(() => setError("Couldn't load your account — region logins don't have a profile page."));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, institution }),
    });
    if (!res.ok) {
      setError("Couldn't save your changes.");
      return;
    }
    setSaved(true);
  }

  if (error) {
    return <div className="max-w-lg mx-auto p-8 text-sm text-slate-400">{error}</div>;
  }
  if (!account) {
    return <div className="max-w-lg mx-auto p-8 text-sm text-slate-400">Loading…</div>;
  }

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="text-xl font-semibold text-slate-100 mb-1">Your account</h1>
      <p className="text-sm text-slate-400 mb-6">
        Username: <span className="text-slate-200">{account.username}</span>. Everything below is optional and used
        only to contact you about updates to the simulation — an email on file is also the only way to recover this
        account if you lose your password.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Institution (optional)</label>
          <input
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        {saved && <p className="text-sm text-emerald-400">Saved.</p>}
        <button
          type="submit"
          className="rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 px-4 transition"
        >
          Save
        </button>
      </form>
    </div>
  );
}
