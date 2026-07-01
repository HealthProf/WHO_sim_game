import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  if (pathname.startsWith("/login")) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(role === "instructor" ? "/control" : "/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/display")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/display") || pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const instructorOnly = ["/control", "/scoring", "/model", "/debrief", "/log"];
  if (instructorOnly.some((p) => pathname.startsWith(p)) && role !== "instructor") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const teamOnly = ["/dashboard", "/events", "/coordination", "/profile"];
  if (teamOnly.some((p) => pathname.startsWith(p)) && role === "instructor") {
    return NextResponse.redirect(new URL("/control", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
