import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Coarse logged-in/logged-out gating and public-route allowlisting only.
// Fine-grained role gating (instructor-only vs. team-only pages) moved
// server-side into lib/session-context.ts's requireActor()/
// requireInstructorActor()/requireTeamActor() — role is a property of
// session ownership (see lib/auth.ts), which can change without a new JWT
// being issued (the client calls next-auth's update() after creating a
// session), so middleware can no longer assume the token's role is current.
const PUBLIC_PATHS = ["/login", "/register", "/account/recover", "/display"];
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/display", "/api/cron", "/api/account/register"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  if (pathname.startsWith("/login")) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest-icon|manifest\\.webmanifest|sw\\.js).*)",
  ],
};
