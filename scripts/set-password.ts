import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npm run db:set-password -- <email> <new-password>");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.email, email.toLowerCase().trim()))
    .returning();

  if (result.length === 0) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  console.log(`Password updated for ${email}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
