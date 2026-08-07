// Shared username validation for both account registration (POST
// /api/account/register) and later username changes (PATCH
// /api/account/credentials) — the reserved/format rules must stay identical
// wherever a username is chosen or changed.
import { REGIONS } from "./regions";

// Reserved usernames from the old fixed-login prototype, plus near-misses
// (non-alphanumeric characters stripped, lowercased) so "in-structor" or
// "AFRO!" can't sneak past a literal string comparison.
const RESERVED = new Set(["instructor", ...REGIONS.map((r) => r.toLowerCase())]);
function normalizeForReservedCheck(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Returns an error message if the username is invalid or reserved, or null
// if it's fine to use.
export function usernameError(rawUsername: string): string | null {
  if (rawUsername.includes("@")) {
    return 'Usernames can\'t contain "@" — that\'s reserved so region-login usernames (e.g. "afro-7f3k9q") never collide with a public account.';
  }
  if (rawUsername.includes("-")) {
    return 'Usernames can\'t contain "-" — that pattern is reserved for generated per-session region logins (e.g. "afro-7f3k9q").';
  }
  if (RESERVED.has(normalizeForReservedCheck(rawUsername))) {
    return "That username is reserved. Please choose another.";
  }
  return null;
}
