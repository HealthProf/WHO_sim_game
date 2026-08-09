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

// Generated region-credential passwords (lib/session-lifecycle.ts). Unlike
// generateSecret()'s base64url output — mixed case plus "-"/"_", alongside
// visually-similar l/1/I and O/0 — this is printed on a paper credential
// sheet in a monospace font and hand-typed into a phone by someone who
// didn't choose it, so transcription error is the whole risk model. Same
// approach as SUFFIX_ALPHABET above, just uppercase (easier to read on a
// printed sheet) and with the ambiguous characters dropped.
const READABLE_PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function generateReadablePassword(length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += READABLE_PASSWORD_ALPHABET[bytes[i] % READABLE_PASSWORD_ALPHABET.length];
  return out;
}
