"use client";

import { useEffect, useState } from "react";
import { PillButton } from "@/components/ui/pill-button";

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

  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/account")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ account }: { account: Account }) => {
        setAccount(account);
        setName(account.name);
        setEmail(account.email ?? "");
        setInstitution(account.institution ?? "");
        setUsername(account.username);
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

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCredentialsError(null);
    setCredentialsSaved(false);

    if (newPassword && newPassword !== confirmPassword) {
      setCredentialsError("New passwords don't match.");
      return;
    }

    const usernameChanged = account && username.trim().toLowerCase() !== account.username;
    if (!usernameChanged && !newPassword) {
      setCredentialsError("Change your username, password, or both.");
      return;
    }

    setCredentialsLoading(true);
    try {
      const res = await fetch("/api/account/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newUsername: usernameChanged ? username : undefined,
          newPassword: newPassword || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCredentialsError(json.error ?? "Couldn't save your changes.");
        return;
      }
      setAccount((prev) => (prev ? { ...prev, username: json.username } : prev));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCredentialsSaved(true);
    } finally {
      setCredentialsLoading(false);
    }
  }

  if (error) {
    return <div className="max-w-lg mx-auto p-8 text-[15px] text-neutral-700">{error}</div>;
  }
  if (!account) {
    return <div className="max-w-lg mx-auto p-8 text-[15px] text-neutral-700">Loading…</div>;
  }

  const inputClass =
    "w-full rounded-full border-2 border-divider bg-bg px-[18px] py-[10px] text-[15px] text-neutral-700";
  const labelClass = "block text-[13px] font-semibold text-text mb-1.5";

  return (
    <div className="max-w-lg mx-auto p-8 space-y-10">
      <div>
        <h1 className="font-heading text-[32px] text-text mb-2">Your account</h1>
        <p className="text-[15px] text-neutral-800 mb-6 leading-[1.55]">
          Username: <span className="font-semibold text-text">{account.username}</span>. Everything below is
          optional and used only to contact you about updates to the simulation — an email on file is also the only
          way to recover this account if you lose your password.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email (optional)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Institution (optional)</label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className={inputClass}
            />
          </div>
          {saved && <p className="text-[14px] text-accent-2-700">Saved.</p>}
          <PillButton type="submit">Save</PillButton>
        </form>
      </div>

      <div className="border-t-2 border-divider pt-8">
        <h2 className="font-heading text-[21px] text-text mb-2">Username &amp; password</h2>
        <p className="text-[15px] text-neutral-800 mb-6 leading-[1.55]">
          Confirm your current password to change your username, your password, or both.
        </p>
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Username</label>
            <input
              type="text"
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>New password (optional)</label>
            <input
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep your current password"
              className={inputClass}
            />
          </div>
          {newPassword && (
            <div>
              <label className={labelClass}>Confirm new password</label>
              <input
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className={labelClass}>Current password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          {credentialsError && <p className="text-[14px] text-accent-700">{credentialsError}</p>}
          {credentialsSaved && <p className="text-[14px] text-accent-2-700">Saved.</p>}
          <PillButton type="submit" disabled={credentialsLoading}>
            {credentialsLoading ? "Saving…" : "Update credentials"}
          </PillButton>
        </form>
      </div>

      <div className="border-t-2 border-divider pt-8 text-[13px] text-neutral-700 leading-[1.5]">
        <p>
          For updates on development or to recommend changes/report issues please follow me (Tim Curry) on{" "}
          <a
            href="https://www.linkedin.com/in/health-prof/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-700 hover:text-accent"
          >
            LinkedIn
          </a>{" "}
          or{" "}
          <a
            href="https://github.com/HealthProf/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-700 hover:text-accent"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </div>
  );
}
