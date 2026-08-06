// ID/secret generation for the multi-tenant refactor. No id library is
// installed and none is needed — node:crypto covers both cases used here.
import { randomUUID, randomBytes } from "node:crypto";

// gameSessions.id — a session's primary key. Never exposed in a public URL
// (that's displayToken below).
export function generateSessionId(): string {
  return randomUUID();
}

// gameSessions.displayToken and generated region-credential passwords.
// base64url so it's URL-safe with no padding to escape.
export function generateSecret(byteLength = 24): string {
  return randomBytes(byteLength).toString("base64url");
}

// Short lowercase-alphanumeric suffix for generated region usernames (e.g.
// "afro-7f3k9q") — see lib/session-lifecycle.ts. Deliberately excludes
// base64url's "-"/"_" so the suffix can never be mistaken for (or collide
// with) the "-"-delimited region prefix it's appended to.
const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
export function generateUsernameSuffix(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += SUFFIX_ALPHABET[bytes[i] % SUFFIX_ALPHABET.length];
  return out;
}
