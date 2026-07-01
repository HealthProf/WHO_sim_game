// Fixed passwords for each shared login. Deliberately NOT a predictable
// per-region pattern (e.g. "horizon-afro") since if one leaks, guessing the
// others should not be trivial. Edit these directly if you want different
// ones — re-run `npm run db:seed` (or the "Database setup / reset" GitHub
// Actions workflow) to apply changes. These are bcrypt-hashed before being
// stored; nothing here is kept in plaintext in the database.
export const fixedPasswords: Record<string, string> = {
  instructor: "Quetzal-9247-Ridge",
  AFRO: "Marlin-3081-Ember",
  AMRO: "Basalt-7714-Fern",
  EMRO: "Copper-2659-Wren",
  EURO: "Thistle-5192-Loom",
  SEARO: "Granite-8036-Vale",
  WPRO: "Amber-4425-Kestrel",
};
