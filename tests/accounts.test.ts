import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { POST as register } from "@/app/api/account/register/route";

function registerRequest(body: unknown, ip = "203.0.113.1") {
  return new NextRequest("http://localhost/api/account/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/account/register", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("rejects reserved usernames (instructor and region codes)", async () => {
    for (const username of ["instructor", "afro", "AFRO", "Instructor"]) {
      const res = await register(registerRequest({ username, name: "Someone" }));
      expect(res.status).toBe(400);
    }
  });

  it("rejects usernames containing @ or -", async () => {
    const atRes = await register(registerRequest({ username: "foo@bar", name: "Someone" }));
    expect(atRes.status).toBe(400);
    const dashRes = await register(registerRequest({ username: "foo-bar", name: "Someone" }));
    expect(dashRes.status).toBe(400);
  });

  it("case-insensitive uniqueness on username", async () => {
    const first = await register(registerRequest({ username: "profsmith", name: "Prof Smith" }));
    expect(first.status).toBe(200);
    const second = await register(registerRequest({ username: "ProfSmith", name: "Prof Smith Again" }, "203.0.113.2"));
    expect(second.status).toBe(409);
  });

  it("bcrypt round-trips a generated password, and it's never stored in plaintext", async () => {
    const res = await register(registerRequest({ username: "profjones", name: "Prof Jones" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.generatedPassword).toBeTruthy();

    const row = await db.query.users.findFirst({ where: eq(users.username, "profjones") });
    expect(row).toBeDefined();
    expect(row!.passwordHash).not.toBe(json.generatedPassword);
    const bcrypt = await import("bcryptjs");
    expect(await bcrypt.compare(json.generatedPassword, row!.passwordHash)).toBe(true);
  });

  it("rate-limits repeated registration attempts from the same IP", async () => {
    const ip = "203.0.113.9";
    const results: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await register(registerRequest({ username: `user${i}`, name: "Someone" }, ip));
      results.push(res.status);
    }
    expect(results.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});
