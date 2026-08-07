"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-neutral-400 hover:text-white text-sm"
    >
      Sign out
    </button>
  );
}
