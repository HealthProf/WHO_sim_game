// Fixed, memorable passwords for each shared login (see AGENTS.md discussion
// on shared-per-region logins for a fast-paced compressed session). Edit
// these directly if you want different ones — re-run `npm run db:seed` to
// apply changes. These are hashed before being stored; nothing here is
// stored in plaintext in the database.
export const fixedPasswords: Record<string, string> = {
  instructor: "horizon-lead",
  AFRO: "horizon-afro",
  AMRO: "horizon-amro",
  EMRO: "horizon-emro",
  EURO: "horizon-euro",
  SEARO: "horizon-searo",
  WPRO: "horizon-wpro",
};
